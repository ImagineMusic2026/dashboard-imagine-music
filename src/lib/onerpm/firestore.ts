import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { enxugarAgregado, loteIdDe, reconciliarArtistas, type ArtistaRoster } from './aggregate'
import { onerpmConfig } from './config'
import { receitaPorPlataformaDisplay } from './display'
import type {
  ArtistaAgregado,
  ArtistaImportado,
  MoneyByCurrency,
  OneRpmAggregate,
  OneRpmLote,
  ReceitaArtistaDoc,
  ReceitaArtistaHistoricoItem,
} from './types'

/** Líquido por moeda na base configurada (net/gross). Nunca soma moedas. */
function netExibicao(totais: OneRpmAggregate['totais']): MoneyByCurrency {
  return onerpmConfig.base === 'gross' ? totais.grossPorMoeda : totais.netPorMoeda
}

/**
 * Persistência da importação da OneRPM (⚠️ só servidor — usa o Admin SDK).
 *
 * Um relatório traz o selo inteiro, então uma importação grava:
 *  - `importacoes/{loteId}` -> um doc por ARQUIVO: metadados, totais e o resumo
 *                              de cada artista — admin
 *  - `receitas/{slug}`      -> receita pronta p/ o perfil, um doc por artista —
 *                              SÓ ADMIN lê
 *  - `artistas/{slug}`      -> garante o cadastro do artista (nome/label) — público
 *
 * A receita (dado sensível) fica numa coleção SEPARADA de `artistas` de propósito:
 * assim o marketing pode ver a lista/cadastro sem ver receita (regras do Firestore).
 * Guardamos os valores por moeda ORIGINAL (bruto e líquido) e NÃO convertemos —
 * a cliente consolida o câmbio manualmente, na data do saque (ver `config.ts`).
 */

const IMPORTACOES = 'importacoes'
const ARTISTAS = 'artistas'
const RECEITAS = 'receitas'
const RECEITAS_IMPORTADAS = 'receitas-importadas'

/** Limite real do batch é 500 operações; folga pra não estourar. */
const OPS_POR_BATCH = 400

export interface ImportMeta {
  arquivoNome: string
  tamanhoBytes: number
  uid: string
  email: string
}

export interface ImportacaoResumo {
  id: string
  periodoKey: string
  arquivoNome: string
  tamanhoBytes: number
  fonte: 'onerpm'
  label: string
  status: 'processado' | 'erro'
  artistas: number
  artistasCriados: number
  linhas: number
  streams: number
  /** Líquido do arquivo inteiro, por moeda original (nunca somado). */
  netPorMoeda: MoneyByCurrency
  moedas: string[]
  periodo: OneRpmAggregate['periodo']
  artistasDetalhes: ArtistaImportado[]
  pagoTerceirosPorMoeda: MoneyByCurrency
  naoAtribuido: { linhas: number; streams: number; netPorMoeda: MoneyByCurrency } | null
  avisos: string[]
  criadoEmISO: string | null
  criadoPorEmail: string
}

export class OneRpmImportacaoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneRpmImportacaoError'
  }
}

function tsParaISO(ts: unknown): string | null {
  return ts instanceof admin.firestore.Timestamp ? ts.toDate().toISOString() : null
}

function periodoKeyDe(periodo: OneRpmAggregate['periodo']): string {
  return loteIdDe(periodo)
}

function novoImportacaoId(periodo: OneRpmAggregate['periodo'], criadoEmMs: number): string {
  return `${periodoKeyDe(periodo)}_${criadoEmMs}`
}

function receitaImportadaId(importacaoId: string, slug: string): string {
  return `${importacaoId}__${slug}`
}

function receitaDocDe(
  agg: ArtistaAgregado,
  rec: { slug: string },
  meta: ImportMeta,
  importacaoId: string,
  periodoKey: string,
  criadoEmMs: number
) {
  return {
    slug: rec.slug,
    nome: agg.artistaNome,
    label: agg.label,
    fonte: 'onerpm' as const,
    receitaPorPlataforma: receitaPorPlataformaDisplay(agg),
    totais: agg.totais,
    streams: agg.totais.streams,
    moedas: agg.moedas,
    periodo: agg.periodo,
    origens: agg.origens,
    repassePorMoeda: agg.repassePorMoeda,
    agregado: enxugarAgregado(agg),
    configUsada: onerpmConfig,
    ultimaImportacaoId: importacaoId,
    periodoKey,
    arquivoNome: meta.arquivoNome,
    tamanhoBytes: meta.tamanhoBytes,
    criadoEmMs,
    criadoEmISO: new Date(criadoEmMs).toISOString(),
    criadoPorEmail: meta.email,
  }
}

async function rematerializarReceitaAtual(slug: string): Promise<void> {
  const snap = await adminDb.collection(RECEITAS_IMPORTADAS).where('slug', '==', slug).get()
  const docs = snap.docs.sort((a, b) => Number(b.data().criadoEmMs ?? 0) - Number(a.data().criadoEmMs ?? 0))

  const receitaRef = adminDb.collection(RECEITAS).doc(slug)
  if (!docs.length) {
    await receitaRef.delete()
    return
  }

  const receita = docs[0].data().receita
  if (!receita) {
    await receitaRef.delete()
    return
  }

  await receitaRef.set({
    ...receita,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  })
}

export async function salvarLote(
  lote: OneRpmLote,
  meta: ImportMeta
): Promise<{ loteId: string; artistas: ArtistaImportado[]; avisos: string[] }> {
  const agora = admin.firestore.FieldValue.serverTimestamp()
  const agoraMs = Date.now()
  const periodoKey = periodoKeyDe(lote.periodo)
  const loteId = novoImportacaoId(lote.periodo, agoraMs)
  const avisos: string[] = []

  // O slug da OneRPM pode não ser o slug do roster (o roster tem "Netto Brito"
  // como `neto-brito`). Reconciliar antes de gravar evita criar um artista
  // duplicado E evita gravar a receita num doc que o perfil dele nunca lê.
  const rosterSnap = await adminDb.collection(ARTISTAS).select('nome').get()
  const roster: ArtistaRoster[] = rosterSnap.docs.map((d) => ({
    slug: d.id,
    nome: String(d.data().nome ?? ''),
  }))
  const reconciliacao = reconciliarArtistas(lote.artistas, roster)

  const reaproveitados = lote.artistas.filter(
    (a) => reconciliacao.get(a.artistaSlug)?.slug !== a.artistaSlug
  )
  if (reaproveitados.length) {
    const detalhe = reaproveitados
      .map((a) => `${a.artistaNome} → ${reconciliacao.get(a.artistaSlug)?.slug}`)
      .join(', ')
    avisos.push(`${reaproveitados.length} artistas casaram com um cadastro já existente: ${detalhe}.`)
  }
  const duvidosos = lote.artistas.filter((a) => reconciliacao.get(a.artistaSlug)?.possivelDuplicata)
  if (duvidosos.length) {
    const detalhe = duvidosos
      .map((a) => `"${a.artistaNome}" x "${reconciliacao.get(a.artistaSlug)?.possivelDuplicata}"`)
      .join(', ')
    avisos.push(
      `POSSÍVEIS DUPLICATAS — cadastrei separado, confira se é a mesma pessoa: ${detalhe}.`
    )
  }

  const artistas: ArtistaImportado[] = lote.artistas.map((a) => {
    const rec = reconciliacao.get(a.artistaSlug)!
    return {
      slug: rec.slug,
      nome: a.artistaNome,
      linhas: a.totais.linhas,
      streams: a.totais.streams,
      netPorMoeda: netExibicao(a.totais),
      repassePorMoeda: a.repassePorMoeda,
      semConta: a.origens.conta === 0,
      criado: rec.criado,
    }
  })

  // Escreve em blocos: são 2 writes por artista + 1 do lote.
  const operacoes: Array<(b: admin.firestore.WriteBatch) => void> = []

  for (const agg of lote.artistas) {
    const rec = reconciliacao.get(agg.artistaSlug)!
    const receitaRef = adminDb.collection(RECEITAS).doc(rec.slug)
    const historicoRef = adminDb.collection(RECEITAS_IMPORTADAS).doc(receitaImportadaId(loteId, rec.slug))
    const artistaRef = adminDb.collection(ARTISTAS).doc(rec.slug)
    const receita = receitaDocDe(agg, rec, meta, loteId, periodoKey, agoraMs)

    // Receita (SENSÍVEL): coleção separada, admin-only.
    operacoes.push((b) =>
      b.set(receitaRef, {
        ...receita,
        atualizadoEm: agora,
      })
    )
    operacoes.push((b) =>
      b.set(historicoRef, {
        importacaoId: loteId,
        periodoKey,
        slug: rec.slug,
        artistaNome: agg.artistaNome,
        arquivoNome: meta.arquivoNome,
        tamanhoBytes: meta.tamanhoBytes,
        label: agg.label,
        periodo: agg.periodo,
        netPorMoeda: netExibicao(agg.totais),
        streams: agg.totais.streams,
        receita,
        criadoEm: agora,
        criadoEmMs: agoraMs,
        criadoPorUid: meta.uid,
        criadoPorEmail: meta.email,
      })
    )

    // Cadastro (NÃO sensível): só garante que o artista existe na lista pública.
    // Em quem já existe, não tocamos no `nome` — o roster pode ter uma grafia
    // curada que a OneRPM não tem.
    if (!rec.criado) {
      operacoes.push((b) => b.set(artistaRef, { label: agg.label, atualizadoEm: agora }, { merge: true }))
    } else {
      operacoes.push((b) =>
        b.set(
          artistaRef,
          {
            nome: agg.artistaNome,
            slug: rec.slug,
            label: agg.label,
            fonteCadastro: 'onerpm',
            // Nasceu de um relatório de receita: não tem redes sociais nem gênero.
            // A página de Alertas cobra a configuração enquanto isto for true.
            pendenteConfiguracao: true,
            pendenteDesde: agoraMs,
            criadoEm: agora,
            atualizadoEm: agora,
          },
          { merge: true }
        )
      )
    }
  }

  const importRef = adminDb.collection(IMPORTACOES).doc(loteId)
  operacoes.push((b) =>
    b.set(importRef, {
      id: loteId,
      fonte: 'onerpm',
      periodoKey,
      arquivoNome: meta.arquivoNome,
      tamanhoBytes: meta.tamanhoBytes,
      label: lote.label,
      status: 'processado',
      linhas: lote.totais.linhas,
      streams: lote.totais.streams,
      moedas: lote.moedas,
      periodo: lote.periodo,
      totais: lote.totais,
      artistas,
      artistasCriados: artistas.filter((a) => a.criado).length,
      pagoTerceirosPorMoeda: lote.pagoTerceirosPorMoeda,
      naoAtribuido: lote.naoAtribuido
        ? {
            linhas: lote.naoAtribuido.totais.linhas,
            streams: lote.naoAtribuido.totais.streams,
            netPorMoeda: netExibicao(lote.naoAtribuido.totais),
          }
        : null,
      avisos: [...lote.avisos, ...avisos],
      configUsada: onerpmConfig,
      criadoEm: agora,
      criadoEmMs: agoraMs,
      criadoPorUid: meta.uid,
      criadoPorEmail: meta.email,
    })
  )

  for (let i = 0; i < operacoes.length; i += OPS_POR_BATCH) {
    const batch = adminDb.batch()
    for (const op of operacoes.slice(i, i + OPS_POR_BATCH)) op(batch)
    await batch.commit()
  }

  return { loteId, artistas, avisos }
}

export async function listarImportacoes(max = 20): Promise<ImportacaoResumo[]> {
  const snap = await adminDb.collection(IMPORTACOES).orderBy('criadoEm', 'desc').limit(max).get()
  return snap.docs.map((d) => {
    const x = d.data()
    const ts = x.criadoEm as admin.firestore.Timestamp | undefined
    // Docs antigos eram de um artista só e não tinham `artistas`/`label`.
    const artistasDetalhes = Array.isArray(x.artistas) ? (x.artistas as ArtistaImportado[]) : []
    const artistas = artistasDetalhes.length || 1
    return {
      id: d.id,
      periodoKey: x.periodoKey ?? d.id,
      arquivoNome: x.arquivoNome ?? '',
      tamanhoBytes: x.tamanhoBytes ?? 0,
      fonte: 'onerpm',
      label: x.label || x.artistaNome || '',
      status: x.status ?? 'processado',
      artistas,
      artistasCriados: x.artistasCriados ?? 0,
      linhas: x.linhas ?? 0,
      streams: x.streams ?? 0,
      // `totais.netPorMoeda` sempre existiu; `totalBRL` era o campo dos docs antigos.
      netPorMoeda: x.totais?.netPorMoeda ?? {},
      moedas: x.moedas ?? [],
      periodo: x.periodo ?? { transactionMonths: [], accountedFrom: null, accountedTo: null },
      artistasDetalhes,
      pagoTerceirosPorMoeda: x.pagoTerceirosPorMoeda ?? {},
      naoAtribuido: x.naoAtribuido ?? null,
      avisos: x.avisos ?? [],
      criadoEmISO: ts ? ts.toDate().toISOString() : x.criadoEmMs ? new Date(Number(x.criadoEmMs)).toISOString() : null,
      criadoPorEmail: x.criadoPorEmail ?? '',
    }
  })
}

function historicoItemDeDoc(d: admin.firestore.QueryDocumentSnapshot): ReceitaArtistaHistoricoItem | null {
  const x = d.data()
  const receita = x.receita as ReceitaArtistaDoc | undefined
  if (!receita) return null
  const ts = x.criadoEm as admin.firestore.Timestamp | undefined
  return {
    ...receita,
    importacaoId: String(x.importacaoId ?? receita.ultimaImportacaoId ?? d.id),
    periodoKey: String(x.periodoKey ?? receita.periodoKey ?? ''),
    arquivoNome: String(x.arquivoNome ?? receita.arquivoNome ?? ''),
    tamanhoBytes: Number(x.tamanhoBytes ?? receita.tamanhoBytes ?? 0),
    criadoEmISO: tsParaISO(ts) ?? (x.criadoEmMs ? new Date(Number(x.criadoEmMs)).toISOString() : receita.criadoEmISO ?? null),
    criadoPorEmail: String(x.criadoPorEmail ?? receita.criadoPorEmail ?? ''),
  }
}

export async function listarReceitasArtista(slug: string): Promise<ReceitaArtistaHistoricoItem[]> {
  const s = (slug ?? '').trim()
  if (!s) throw new OneRpmImportacaoError('Artista inválido.')

  const snap = await adminDb.collection(RECEITAS_IMPORTADAS).where('slug', '==', s).get()
  const historico = snap.docs
    .map(historicoItemDeDoc)
    .filter((x): x is ReceitaArtistaHistoricoItem => Boolean(x))
    .sort((a, b) => {
      const at = a.criadoEmISO ? new Date(a.criadoEmISO).getTime() : 0
      const bt = b.criadoEmISO ? new Date(b.criadoEmISO).getTime() : 0
      return bt - at
    })

  if (historico.length) return historico

  // Compatibilidade: docs antigos só têm o snapshot em `receitas/{slug}`.
  const atual = await adminDb.collection(RECEITAS).doc(s).get()
  if (!atual.exists) return []
  const data = atual.data() as ReceitaArtistaDoc
  if (!data?.receitaPorPlataforma?.length) return []
  return [
    {
      ...data,
      importacaoId: data.ultimaImportacaoId ?? 'snapshot-atual',
      periodoKey: data.periodoKey ?? data.ultimaImportacaoId ?? 'snapshot-atual',
      arquivoNome: data.arquivoNome ?? 'Importação antiga',
      tamanhoBytes: data.tamanhoBytes ?? 0,
      criadoEmISO: data.criadoEmISO ?? tsParaISO(atual.data()?.atualizadoEm),
      criadoPorEmail: data.criadoPorEmail ?? '',
    },
  ]
}

export async function excluirImportacao(
  importacaoId: string,
  meta: { uid: string; email: string }
): Promise<{ id: string; artistasAfetados: number }> {
  const id = (importacaoId ?? '').trim()
  if (!id) throw new OneRpmImportacaoError('Importação inválida.')

  const importRef = adminDb.collection(IMPORTACOES).doc(id)
  const importSnap = await importRef.get()
  if (!importSnap.exists) throw new OneRpmImportacaoError('Importação não encontrada.')

  const importData = importSnap.data() ?? {}
  const artistasDoResumo = Array.isArray(importData.artistas) ? (importData.artistas as ArtistaImportado[]) : []
  const histSnap = await adminDb.collection(RECEITAS_IMPORTADAS).where('importacaoId', '==', id).get()
  const slugs = new Set<string>()
  for (const a of artistasDoResumo) if (a.slug) slugs.add(a.slug)
  for (const d of histSnap.docs) {
    const slug = String(d.data().slug ?? '')
    if (slug) slugs.add(slug)
  }

  const batch = adminDb.batch()
  for (const d of histSnap.docs) batch.delete(d.ref)
  batch.delete(importRef)
  await batch.commit()

  for (const slug of Array.from(slugs)) {
    const atual = await adminDb.collection(RECEITAS).doc(slug).get()
    if (!atual.exists || atual.data()?.ultimaImportacaoId === id) {
      await rematerializarReceitaAtual(slug)
    }
  }

  await adminDb.collection('cadastros').add({
    fonte: 'exclusao-importacao-onerpm',
    importacaoId: id,
    artistasAfetados: slugs.size,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    criadoPorUid: meta.uid,
    criadoPorEmail: meta.email,
  })

  return { id, artistasAfetados: slugs.size }
}

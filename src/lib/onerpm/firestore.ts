import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { enxugarAgregado, loteIdDe, mesclarAgregados, reconciliarArtistas, type ArtistaRoster } from './aggregate'
import { onerpmConfig } from './config'
import { receitaPorPlataformaDisplay } from './display'
import { ID_CONSOLIDADO } from './types'
import type {
  ArtistaAgregado,
  ArtistaImportado,
  MoneyByCurrency,
  OneRpmAggregate,
  OneRpmLote,
  ReceitaArtistaDoc,
  ReceitaArtistaHistoricoItem,
  ReceitaArtistaPayload,
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

/** Rematerializações simultâneas: cada uma é 1 query + 1 write. */
const REMATERIALIZAR_POR_VEZ = 10

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

/**
 * Recalcula `receitas/{slug}` como o CONSOLIDADO de todas as importações do artista.
 *
 * Cada relatório da OneRPM é um mês de LANÇAMENTO, e o perfil mostra a SOMA dos meses
 * importados — não o último arquivo que subiu. (O modelo antigo gravava só o último:
 * quem importasse jan, fev e mar via só mar, e os outros dois sumiam do painel.)
 *
 * Se o mesmo mês foi importado duas vezes (re-envio), só a versão mais recente entra
 * na soma — senão aquele mês contaria dobrado.
 *
 * É a ÚNICA porta de escrita de `receitas/{slug}`: tanto importar quanto excluir
 * passam por aqui, então o consolidado nunca diverge do histórico.
 */
async function rematerializarReceitaAtual(slug: string): Promise<void> {
  const snap = await adminDb.collection(RECEITAS_IMPORTADAS).where('slug', '==', slug).get()
  const receitaRef = adminDb.collection(RECEITAS).doc(slug)

  // Mais recente primeiro: a identidade e os metadados do doc saem daqui.
  const versoes = snap.docs
    .map((d) => d.data())
    .sort((a, b) => Number(b.criadoEmMs ?? 0) - Number(a.criadoEmMs ?? 0))

  const porPeriodo = new Map<string, admin.firestore.DocumentData>()
  for (const v of versoes) {
    const key = String(v.periodoKey ?? v.importacaoId ?? '')
    if (!porPeriodo.has(key)) porPeriodo.set(key, v)
  }

  const escolhidas = Array.from(porPeriodo.values())
  const agregados = escolhidas
    .map((v) => (v.receita as ReceitaArtistaDoc | undefined)?.agregado as ArtistaAgregado | undefined)
    .filter((a): a is ArtistaAgregado => Array.isArray(a?.porPlataforma))

  // Sem histórico não há o que consolidar: o artista perdeu toda a receita.
  if (!agregados.length) {
    await receitaRef.delete()
    return
  }

  const mesclado = mesclarAgregados(agregados)
  const recente = escolhidas[0]
  const base = (recente.receita ?? {}) as ReceitaArtistaDoc

  await receitaRef.set({
    slug,
    nome: base.nome,
    label: base.label,
    fonte: 'onerpm' as const,
    receitaPorPlataforma: receitaPorPlataformaDisplay(mesclado),
    totais: mesclado.totais,
    streams: mesclado.totais.streams,
    moedas: mesclado.moedas,
    periodo: mesclado.periodo,
    origens: mesclado.origens,
    repassePorMoeda: mesclado.repassePorMoeda,
    agregado: mesclado,
    configUsada: onerpmConfig,
    // Este doc é a SOMA destas importações — uma por mês de lançamento.
    importacoesIds: escolhidas.map((v) => String(v.importacaoId ?? '')),
    periodoKeys: Array.from(porPeriodo.keys()).sort(),
    // Metadados do envio mais recente (o consolidado não tem "um" arquivo).
    ultimaImportacaoId: String(recente.importacaoId ?? ''),
    periodoKey: String(recente.periodoKey ?? ''),
    arquivoNome: String(recente.arquivoNome ?? ''),
    tamanhoBytes: Number(recente.tamanhoBytes ?? 0),
    criadoEmMs: Number(recente.criadoEmMs ?? 0),
    criadoEmISO: recente.criadoEmMs ? new Date(Number(recente.criadoEmMs)).toISOString() : null,
    criadoPorEmail: String(recente.criadoPorEmail ?? ''),
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

  // Escreve em blocos: 1 write de histórico por artista + 1 do cadastro + 1 do lote.
  const operacoes: Array<(b: admin.firestore.WriteBatch) => void> = []

  for (const agg of lote.artistas) {
    const rec = reconciliacao.get(agg.artistaSlug)!
    const historicoRef = adminDb.collection(RECEITAS_IMPORTADAS).doc(receitaImportadaId(loteId, rec.slug))
    const artistaRef = adminDb.collection(ARTISTAS).doc(rec.slug)
    const receita = receitaDocDe(agg, rec, meta, loteId, periodoKey, agoraMs)

    // Só o HISTÓRICO deste mês é gravado aqui (receita é sensível: coleção separada,
    // admin-only). `receitas/{slug}` é o consolidado de todos os meses e sai da
    // rematerialização, no fim — gravar o snapshot deste mês direto ali apagaria os
    // outros meses, que era exatamente o bug do modelo antigo.
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

  // Com o histórico deste mês já gravado, recalcula o consolidado de cada artista.
  // Em blocos: são ~80 artistas, e disparar tudo de uma vez arriscaria o tempo da
  // função serverless.
  for (let i = 0; i < artistas.length; i += REMATERIALIZAR_POR_VEZ) {
    await Promise.all(
      artistas.slice(i, i + REMATERIALIZAR_POR_VEZ).map((a) => rematerializarReceitaAtual(a.slug))
    )
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

/**
 * O que o perfil do artista lê: o consolidado (soma dos meses) + cada mês separado.
 *
 * O consolidado é o doc `receitas/{slug}`, mantido por `rematerializarReceitaAtual`;
 * os meses são os docs de `receitas-importadas`. Devolver os dois deixa o card abrir
 * no total e permitir drilar num mês.
 */
export async function carregarReceitasArtista(slug: string): Promise<ReceitaArtistaPayload> {
  const s = (slug ?? '').trim()
  if (!s) throw new OneRpmImportacaoError('Artista inválido.')

  const [histSnap, atualSnap] = await Promise.all([
    adminDb.collection(RECEITAS_IMPORTADAS).where('slug', '==', s).get(),
    adminDb.collection(RECEITAS).doc(s).get(),
  ])

  const historico = histSnap.docs
    .map(historicoItemDeDoc)
    .filter((x): x is ReceitaArtistaHistoricoItem => Boolean(x))
    .sort((a, b) => {
      const at = a.criadoEmISO ? new Date(a.criadoEmISO).getTime() : 0
      const bt = b.criadoEmISO ? new Date(b.criadoEmISO).getTime() : 0
      return bt - at
    })

  const atual = atualSnap.exists ? (atualSnap.data() as ReceitaArtistaDoc) : null

  // Compatibilidade: importações anteriores ao versionamento só existem como snapshot
  // em `receitas/{slug}`. Não há o que consolidar — é a única versão que sobrou.
  if (!historico.length) {
    if (!atual?.receitaPorPlataforma?.length) return { consolidado: null, historico: [] }
    return {
      consolidado: null,
      historico: [
        {
          ...atual,
          importacaoId: atual.ultimaImportacaoId ?? 'snapshot-atual',
          periodoKey: atual.periodoKey ?? atual.ultimaImportacaoId ?? 'snapshot-atual',
          arquivoNome: atual.arquivoNome ?? 'Importação antiga',
          tamanhoBytes: atual.tamanhoBytes ?? 0,
          criadoEmISO: atual.criadoEmISO ?? tsParaISO(atualSnap.data()?.atualizadoEm),
          criadoPorEmail: atual.criadoPorEmail ?? '',
        },
      ],
    }
  }

  // Um mês só: o consolidado seria uma cópia dele — não polui o seletor.
  if (historico.length === 1 || !atual?.receitaPorPlataforma?.length) {
    return { consolidado: null, historico }
  }

  return {
    consolidado: {
      ...atual,
      importacaoId: ID_CONSOLIDADO,
      periodoKey: ID_CONSOLIDADO,
      arquivoNome: '',
      tamanhoBytes: 0,
      criadoEmISO: atual.criadoEmISO ?? null,
      criadoPorEmail: atual.criadoPorEmail ?? '',
    },
    historico,
  }
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

  // TODO artista afetado é rematerializado, sem exceção: o consolidado soma TODOS os
  // meses, então excluir março muda o total mesmo que o doc aponte para abril como
  // importação mais recente. (No modelo antigo, que só guardava o último arquivo,
  // bastava recalcular quando o excluído era justamente o que estava à mostra.)
  const afetados = Array.from(slugs)
  for (let i = 0; i < afetados.length; i += REMATERIALIZAR_POR_VEZ) {
    await Promise.all(afetados.slice(i, i + REMATERIALIZAR_POR_VEZ).map((s) => rematerializarReceitaAtual(s)))
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

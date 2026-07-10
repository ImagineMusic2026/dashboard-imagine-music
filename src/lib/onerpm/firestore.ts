import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { enxugarAgregado, loteIdDe, reconciliarArtistas, type ArtistaRoster } from './aggregate'
import { onerpmConfig } from './config'
import { paraBRL, receitaPorPlataformaDisplay, repasseAoSeloBRL, totalReceitaBRL } from './display'
import type { ArtistaImportado, OneRpmAggregate, OneRpmLote } from './types'

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
 * Guardamos os valores ORIGINAIS por moeda, então a exibição (base net/gross e
 * câmbio) pode ser recalculada sem reimportar.
 */

const IMPORTACOES = 'importacoes'
const ARTISTAS = 'artistas'
const RECEITAS = 'receitas'

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
  arquivoNome: string
  tamanhoBytes: number
  fonte: 'onerpm'
  label: string
  status: 'processado' | 'erro'
  artistas: number
  artistasCriados: number
  linhas: number
  streams: number
  totalBRL: number
  moedas: string[]
  periodo: OneRpmAggregate['periodo']
  avisos: string[]
  criadoEmISO: string | null
  criadoPorEmail: string
}

export async function salvarLote(
  lote: OneRpmLote,
  meta: ImportMeta
): Promise<{ loteId: string; artistas: ArtistaImportado[]; totalBRL: number; avisos: string[] }> {
  const agora = admin.firestore.FieldValue.serverTimestamp()
  const agoraMs = Date.now()
  const loteId = loteIdDe(lote.periodo)
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
      totalBRL: totalReceitaBRL(a),
      repasseBRL: repasseAoSeloBRL(a.repassePorMoeda),
      semConta: a.origens.conta === 0,
      criado: rec.criado,
    }
  })
  const totalBRL = totalReceitaBRL(lote)

  // Escreve em blocos: são 2 writes por artista + 1 do lote.
  const operacoes: Array<(b: admin.firestore.WriteBatch) => void> = []

  for (const agg of lote.artistas) {
    const rec = reconciliacao.get(agg.artistaSlug)!
    const receitaRef = adminDb.collection(RECEITAS).doc(rec.slug)
    const artistaRef = adminDb.collection(ARTISTAS).doc(rec.slug)
    const repasseBRL = repasseAoSeloBRL(agg.repassePorMoeda)

    // Receita (SENSÍVEL): coleção separada, admin-only.
    operacoes.push((b) =>
      b.set(receitaRef, {
        slug: rec.slug,
        nome: agg.artistaNome,
        label: agg.label,
        fonte: 'onerpm',
        receitaPorPlataforma: receitaPorPlataformaDisplay(agg), // já no formato que o painel exibe
        totais: agg.totais,
        totalBRL: totalReceitaBRL(agg),
        streams: agg.totais.streams,
        moedas: agg.moedas,
        periodo: agg.periodo,
        origens: agg.origens,
        repassePorMoeda: agg.repassePorMoeda, // fatia do selo; JÁ dentro de totalBRL
        repasseBRL,
        agregado: enxugarAgregado(agg), // p/ recálculo sem reimportar (o cliente já enxuga; aqui é garantia)
        configUsada: onerpmConfig,
        ultimaImportacaoId: loteId,
        atualizadoEm: agora,
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
      fonte: 'onerpm',
      arquivoNome: meta.arquivoNome,
      tamanhoBytes: meta.tamanhoBytes,
      label: lote.label,
      status: 'processado',
      linhas: lote.totais.linhas,
      streams: lote.totais.streams,
      moedas: lote.moedas,
      periodo: lote.periodo,
      totais: lote.totais,
      totalBRL,
      artistas,
      artistasCriados: artistas.filter((a) => a.criado).length,
      pagoTerceirosPorMoeda: lote.pagoTerceirosPorMoeda,
      pagoTerceirosBRL: paraBRL(lote.pagoTerceirosPorMoeda),
      naoAtribuido: lote.naoAtribuido
        ? {
            linhas: lote.naoAtribuido.totais.linhas,
            streams: lote.naoAtribuido.totais.streams,
            totalBRL: totalReceitaBRL(lote.naoAtribuido),
          }
        : null,
      avisos: [...lote.avisos, ...avisos],
      configUsada: onerpmConfig,
      criadoEm: agora,
      criadoPorUid: meta.uid,
      criadoPorEmail: meta.email,
    })
  )

  for (let i = 0; i < operacoes.length; i += OPS_POR_BATCH) {
    const batch = adminDb.batch()
    for (const op of operacoes.slice(i, i + OPS_POR_BATCH)) op(batch)
    await batch.commit()
  }

  return { loteId, artistas, totalBRL, avisos }
}

export async function listarImportacoes(max = 20): Promise<ImportacaoResumo[]> {
  const snap = await adminDb.collection(IMPORTACOES).orderBy('criadoEm', 'desc').limit(max).get()
  return snap.docs.map((d) => {
    const x = d.data()
    const ts = x.criadoEm as admin.firestore.Timestamp | undefined
    // Docs antigos eram de um artista só e não tinham `artistas`/`label`.
    const artistas = Array.isArray(x.artistas) ? x.artistas.length : 1
    return {
      id: d.id,
      arquivoNome: x.arquivoNome ?? '',
      tamanhoBytes: x.tamanhoBytes ?? 0,
      fonte: 'onerpm',
      label: x.label || x.artistaNome || '',
      status: x.status ?? 'processado',
      artistas,
      artistasCriados: x.artistasCriados ?? 0,
      linhas: x.linhas ?? 0,
      streams: x.streams ?? 0,
      totalBRL: x.totalBRL ?? 0,
      moedas: x.moedas ?? [],
      periodo: x.periodo ?? { transactionMonths: [], accountedFrom: null, accountedTo: null },
      avisos: x.avisos ?? [],
      criadoEmISO: ts ? ts.toDate().toISOString() : null,
      criadoPorEmail: x.criadoPorEmail ?? '',
    }
  })
}

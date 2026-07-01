import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatNumber } from '@/lib/utils'
import { listarArtistas, type ContaVinculadaRef } from '@/lib/artistas/client'
import type {
  HistoricoDiaDoc,
  HistoricoHealthDiaDoc,
  HistoricoStreamingDiaDoc,
  HistoricoTikTokDiaDoc,
  HistoricoYouTubeDiaDoc,
  IntegracaoMetaDoc,
  IntegracaoOneRpmDoc,
  IntegracaoTikTokDoc,
  IntegracaoYouTubeDoc,
  MetricasSociaisDoc,
  StreamingDetalheDoc,
} from './types'

/**
 * Leitura client (Firestore) das métricas sociais. Liberada para qualquer
 * membro ativo (admin ou marketing) — diferente da receita, métricas de redes
 * NÃO são sensíveis. A escrita é exclusiva do servidor (regras + Admin SDK).
 */

export async function getMetricasSociais(slug: string): Promise<MetricasSociaisDoc | null> {
  const s = await getDoc(doc(db, 'metricas-sociais', slug))
  return s.exists() ? ({ slug: s.id, ...(s.data() as object) } as MetricasSociaisDoc) : null
}

/** Mapa slug -> métricas, para uso em listagens. */
export async function listarMetricasSociais(): Promise<Map<string, MetricasSociaisDoc>> {
  const snap = await getDocs(collection(db, 'metricas-sociais'))
  const m = new Map<string, MetricasSociaisDoc>()
  snap.docs.forEach((d) =>
    m.set(d.id, { slug: d.id, ...(d.data() as object) } as MetricasSociaisDoc),
  )
  return m
}

/**
 * Artistas com dados de streaming (OneRPM) — para a lista de "ver contas" na
 * integração. Não há @handle; mostramos nome + total de streams na janela.
 *
 * Caminho rápido: lê a lista já pronta no doc `integracoes/onerpm` (1 leitura).
 * Fallback (doc antigo, antes do próximo sync popular `artistas`): varre
 * `metricas-sociais` e casa com o cadastro — mais pesado, mas mantém a feature viva.
 */
export async function listarArtistasComStreaming(): Promise<ContaVinculadaRef[]> {
  const status = await getStatusOneRpm()
  if (status?.artistas?.length) {
    return [...status.artistas]
      .sort((a, b) => b.streams - a.streams || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((a) => ({ slug: a.slug, nome: a.nome, handle: null, detalhe: `${formatNumber(a.streams)} streams` }))
  }

  const [artistas, metricas] = await Promise.all([listarArtistas(), listarMetricasSociais()])
  const nomePorSlug = new Map(artistas.map((a) => [a.slug, a.nome]))
  const comStreaming: { conta: ContaVinculadaRef; streams: number }[] = []
  metricas.forEach((m, slug) => {
    if (!m.streaming) return
    const streams = m.streaming.streams ?? 0
    comStreaming.push({
      conta: { slug, nome: nomePorSlug.get(slug) ?? slug, handle: null, detalhe: `${formatNumber(streams)} streams` },
      streams,
    })
  })
  return comStreaming
    .sort((a, b) => b.streams - a.streams || a.conta.nome.localeCompare(b.conta.nome, 'pt-BR'))
    .map((x) => x.conta)
}

/** Histórico diário (ordenado por dia asc), limitado aos últimos `limite` dias. */
export async function getHistoricoInstagram(
  slug: string,
  limite = 90,
): Promise<HistoricoDiaDoc[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, 'historico'),
    orderBy('dia', 'asc'),
  )
  const snap = await getDocs(q)
  const arr = snap.docs.map((d) => d.data() as HistoricoDiaDoc)
  return arr.slice(-limite)
}

/** Status da integração Meta (doc `integracoes/meta`). */
export async function getStatusMeta(): Promise<IntegracaoMetaDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'meta'))
  return s.exists() ? (s.data() as IntegracaoMetaDoc) : null
}

/** Histórico diário do TikTok (ordenado por dia asc), últimos `limite` dias. */
export async function getHistoricoTikTok(
  slug: string,
  limite = 90,
): Promise<HistoricoTikTokDiaDoc[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, 'historico-tiktok'),
    orderBy('dia', 'asc'),
  )
  const snap = await getDocs(q)
  const arr = snap.docs.map((d) => d.data() as HistoricoTikTokDiaDoc)
  return arr.slice(-limite)
}

/** Status da integração TikTok (doc `integracoes/tiktok`). */
export async function getStatusTikTok(): Promise<IntegracaoTikTokDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'tiktok'))
  return s.exists() ? (s.data() as IntegracaoTikTokDoc) : null
}

/** Histórico diário do YouTube (ordenado por dia asc), últimos `limite` dias. */
export async function getHistoricoYouTube(
  slug: string,
  limite = 90,
): Promise<HistoricoYouTubeDiaDoc[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, 'historico-youtube'),
    orderBy('dia', 'asc'),
  )
  const snap = await getDocs(q)
  const arr = snap.docs.map((d) => d.data() as HistoricoYouTubeDiaDoc)
  return arr.slice(-limite)
}

/** Série diária do Health Score (ordenada por dia asc), últimos `limite` dias. */
export async function getHistoricoHealth(
  slug: string,
  limite = 90,
): Promise<HistoricoHealthDiaDoc[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, 'historico-health'),
    orderBy('dia', 'asc'),
  )
  const snap = await getDocs(q)
  const arr = snap.docs.map((d) => d.data() as HistoricoHealthDiaDoc)
  return arr.slice(-limite)
}

/** Status da integração YouTube (doc `integracoes/youtube`). */
export async function getStatusYouTube(): Promise<IntegracaoYouTubeDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'youtube'))
  return s.exists() ? (s.data() as IntegracaoYouTubeDoc) : null
}

/** Status da integração OneRPM (doc `integracoes/onerpm`). */
export async function getStatusOneRpm(): Promise<IntegracaoOneRpmDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'onerpm'))
  return s.exists() ? (s.data() as IntegracaoOneRpmDoc) : null
}

/** Histórico diário de streaming (ordenado por dia asc), últimos `limite` dias. */
export async function getHistoricoStreaming(
  slug: string,
  limite = 90,
): Promise<HistoricoStreamingDiaDoc[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, 'historico-streaming'),
    orderBy('dia', 'asc'),
  )
  const snap = await getDocs(q)
  const arr = snap.docs.map((d) => d.data() as HistoricoStreamingDiaDoc)
  return arr.slice(-limite)
}

/** Detalhe granular de streaming (faixas + geografia com skip) de um artista. */
export async function getStreamingDetalhe(slug: string): Promise<StreamingDetalheDoc | null> {
  const s = await getDoc(doc(db, 'metricas-sociais', slug, 'streaming-detalhe', 'atual'))
  return s.exists() ? (s.data() as StreamingDetalheDoc) : null
}

import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
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

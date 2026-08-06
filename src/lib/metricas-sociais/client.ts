import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta, memoCurtaPorChave, registrarInvalidacao } from '@/lib/cache-leitura'
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

const TTL_METRICAS = 60_000
const cacheMetricas = new Map<string, { promessa: Promise<MetricasSociaisDoc | null>; em: number }>()
// Sincronizar uma fonte reescreve estes docs — o cache por slug entra no
// invalidador geral pra não devolver o número de antes do sync.
registrarInvalidacao(() => cacheMetricas.clear())

/**
 * `getMetricasSociais` com cache curto por slug: os ~8 cards do perfil do
 * artista montam juntos e cada um pedia o MESMO doc — com o cache, a visita
 * inteira divide uma única leitura do Firestore. Falha não fica cacheada.
 */
export function getMetricasSociaisCached(slug: string): Promise<MetricasSociaisDoc | null> {
  const agora = Date.now()
  const hit = cacheMetricas.get(slug)
  if (hit && agora - hit.em < TTL_METRICAS) return hit.promessa
  const promessa = getMetricasSociais(slug).catch((e) => {
    cacheMetricas.delete(slug)
    throw e
  })
  cacheMetricas.set(slug, { promessa, em: agora })
  return promessa
}

async function lerMetricasDeTodos(): Promise<Map<string, MetricasSociaisDoc>> {
  const snap = await getDocs(collection(db, 'metricas-sociais'))
  const m = new Map<string, MetricasSociaisDoc>()
  snap.docs.forEach((d) =>
    m.set(d.id, { slug: d.id, ...(d.data() as object) } as MetricasSociaisDoc),
  )
  return m
}

/**
 * Mapa slug -> métricas, para uso em listagens. Cacheado por um minuto pelo mesmo
 * motivo do roster: home, lista, conteúdo, busca e o badge do sino varrem esta
 * coleção quase ao mesmo tempo.
 */
export const listarMetricasSociais = memoCurta(lerMetricasDeTodos).ler

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

/** Janela padrão das séries diárias. Era o mesmo número do corte em JS de antes. */
const DIAS_SERIE = 90

/**
 * As séries mudam UMA vez por dia (os syncs rodam de madrugada), então segurar
 * cinco minutos não mostra nada velho — e cobre a navegação entre perfis e a volta
 * pra lista dentro de uma mesma sessão de trabalho. Sincronizar pelo painel
 * invalida na hora, como nos outros caches.
 */
const TTL_SERIE = 5 * 60_000

/**
 * Uma série diária (`historico*`) de um artista: os `limite` dias MAIS RECENTES,
 * em ordem crescente.
 *
 * O `limit` vai na CONSULTA de propósito. Antes a série vinha inteira do Firestore
 * e o corte acontecia em JS — ou seja, o banco já tinha cobrado por todos os dias.
 * Como os syncs gravam 1 doc por dia por artista, o custo de abrir um perfil crescia
 * sozinho a cada dia que passava (foi o que estourou a cota diária em 2026-08-06).
 * Pedir em ordem DECRESCENTE com `limit` e inverter devolve exatamente o mesmo
 * array de antes — nenhuma tela enxerga diferença.
 *
 * `orderBy` de um campo só usa o índice automático: não há índice composto a criar.
 */
async function lerSerie(slug: string, sub: string, limite: number): Promise<unknown[]> {
  const q = query(
    collection(db, 'metricas-sociais', slug, sub),
    orderBy('dia', 'desc'),
    limit(limite),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data()).reverse()
}

const serieCached = memoCurtaPorChave(
  lerSerie,
  (slug, sub, limite) => `${sub}|${slug}|${limite}`,
  TTL_SERIE,
)

/**
 * Série cacheada, sempre devolvendo uma CÓPIA: o array é compartilhado entre os
 * cards que pedem a mesma série, e um `sort`/`reverse` no consumidor envenenaria o
 * cache dos outros.
 */
async function serie<T>(slug: string, sub: string, limite: number): Promise<T[]> {
  return [...((await serieCached(slug, sub, limite)) as T[])]
}

/** Histórico diário (ordenado por dia asc), limitado aos últimos `limite` dias. */
export function getHistoricoInstagram(
  slug: string,
  limite = DIAS_SERIE,
): Promise<HistoricoDiaDoc[]> {
  return serie<HistoricoDiaDoc>(slug, 'historico', limite)
}

/** Status da integração Meta (doc `integracoes/meta`). */
export async function getStatusMeta(): Promise<IntegracaoMetaDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'meta'))
  return s.exists() ? (s.data() as IntegracaoMetaDoc) : null
}

/** Histórico diário do TikTok (ordenado por dia asc), últimos `limite` dias. */
export function getHistoricoTikTok(
  slug: string,
  limite = DIAS_SERIE,
): Promise<HistoricoTikTokDiaDoc[]> {
  return serie<HistoricoTikTokDiaDoc>(slug, 'historico-tiktok', limite)
}

/** Status da integração TikTok (doc `integracoes/tiktok`). */
export async function getStatusTikTok(): Promise<IntegracaoTikTokDoc | null> {
  const s = await getDoc(doc(db, 'integracoes', 'tiktok'))
  return s.exists() ? (s.data() as IntegracaoTikTokDoc) : null
}

/** Histórico diário do YouTube (ordenado por dia asc), últimos `limite` dias. */
export function getHistoricoYouTube(
  slug: string,
  limite = DIAS_SERIE,
): Promise<HistoricoYouTubeDiaDoc[]> {
  return serie<HistoricoYouTubeDiaDoc>(slug, 'historico-youtube', limite)
}

/** Série diária do Health Score (ordenada por dia asc), últimos `limite` dias. */
export function getHistoricoHealth(
  slug: string,
  limite = DIAS_SERIE,
): Promise<HistoricoHealthDiaDoc[]> {
  return serie<HistoricoHealthDiaDoc>(slug, 'historico-health', limite)
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
export function getHistoricoStreaming(
  slug: string,
  limite = DIAS_SERIE,
): Promise<HistoricoStreamingDiaDoc[]> {
  return serie<HistoricoStreamingDiaDoc>(slug, 'historico-streaming', limite)
}

/** Detalhe granular de streaming (faixas + geografia com skip) de um artista. */
export async function getStreamingDetalhe(slug: string): Promise<StreamingDetalheDoc | null> {
  const s = await getDoc(doc(db, 'metricas-sociais', slug, 'streaming-detalhe', 'atual'))
  return s.exists() ? (s.data() as StreamingDetalheDoc) : null
}

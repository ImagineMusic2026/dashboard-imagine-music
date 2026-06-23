import { dataGet, dataGetAuth } from './client'
import type { YouTubeSnapshot, YouTubeVideoItem } from '@/lib/metricas-sociais/types'

/**
 * Camada PÚBLICA do YouTube (Data API v3, via API key). SERVER-ONLY.
 *
 * Resolve a URL/@handle cadastrada num channelId e coleta estatísticas do canal
 * (inscritos, views totais, nº de vídeos) + o agregado dos vídeos recentes
 * (views/curtidas/comentários). Funciona para qualquer canal público, sem
 * autorização do artista.
 */

const VIDEOS_AGREGADO = 15

interface ChannelItem {
  id?: string
  snippet?: {
    title?: string
    customUrl?: string
    thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } }
  }
  statistics?: {
    viewCount?: string
    subscriberCount?: string
    hiddenSubscriberCount?: boolean
    videoCount?: string
  }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

interface ChannelsResp {
  items?: ChannelItem[]
}

interface PlaylistItemsResp {
  items?: { contentDetails?: { videoId?: string } }[]
}

interface VideoItemResp {
  id?: string
  snippet?: {
    title?: string
    publishedAt?: string
    thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } }
  }
  statistics?: Record<string, string | undefined>
}

interface VideosResp {
  items?: VideoItemResp[]
}

/* ── Resolução de channelId ── */

type Alvo =
  | { tipo: 'id'; valor: string }
  | { tipo: 'handle'; valor: string }
  | { tipo: 'user'; valor: string }
  | { tipo: 'busca'; valor: string }

/** Interpreta uma URL/@handle/ID do YouTube. */
export function parseYouTube(valor: string | null | undefined): Alvo | null {
  if (!valor) return null
  const s = valor.trim()

  // URLs
  const mChannel = s.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i)
  if (mChannel) return { tipo: 'id', valor: mChannel[1] }
  const mHandleUrl = s.match(/youtube\.com\/@([^/?#\s]+)/i)
  if (mHandleUrl) return { tipo: 'handle', valor: mHandleUrl[1] }
  const mUser = s.match(/youtube\.com\/user\/([^/?#\s]+)/i)
  if (mUser) return { tipo: 'user', valor: mUser[1] }
  const mCustom = s.match(/youtube\.com\/c\/([^/?#\s]+)/i)
  if (mCustom) return { tipo: 'busca', valor: decodeURIComponent(mCustom[1]) }

  // Valores diretos
  if (/^UC[\w-]{20,}$/.test(s)) return { tipo: 'id', valor: s }
  if (s.startsWith('@')) return { tipo: 'handle', valor: s.slice(1) }
  return { tipo: 'busca', valor: s }
}

/** Resolve a URL/@handle cadastrada num channelId (UC...). null se não achar. */
export async function resolverChannelId(handleOuUrl: string | null | undefined): Promise<string | null> {
  const alvo = parseYouTube(handleOuUrl)
  if (!alvo) return null
  if (alvo.tipo === 'id') return alvo.valor

  if (alvo.tipo === 'handle') {
    const r = await dataGet<ChannelsResp>('/channels', { part: 'id', forHandle: `@${alvo.valor}` })
    return r.items?.[0]?.id ?? null
  }
  if (alvo.tipo === 'user') {
    const r = await dataGet<ChannelsResp>('/channels', { part: 'id', forUsername: alvo.valor })
    return r.items?.[0]?.id ?? null
  }
  // Busca textual (custom URL / nome) — último recurso (custa mais quota).
  const r = await dataGet<{ items?: { id?: { channelId?: string } }[] }>('/search', {
    part: 'id',
    type: 'channel',
    q: alvo.valor,
    maxResults: 1,
  })
  return r.items?.[0]?.id?.channelId ?? null
}

/* ── Coleta ── */

/** Estatísticas públicas do canal + agregado dos vídeos recentes. */
export async function buscarMetricasCanal(channelId: string): Promise<YouTubeSnapshot> {
  const avisos: string[] = []
  const coletadoEm = new Date().toISOString()

  const resp = await dataGet<ChannelsResp>('/channels', {
    part: 'snippet,statistics,contentDetails',
    id: channelId,
  })
  const c = resp.items?.[0]
  if (!c) {
    return {
      contaId: channelId,
      inscritos: null,
      viewsTotais: null,
      videos: null,
      viewsRecentes: null,
      curtidasRecentes: null,
      comentariosRecentes: null,
      videosConsiderados: null,
      coletadoEm,
      avisos: ['canal não encontrado pela Data API'],
    }
  }

  const ocultos = c.statistics?.hiddenSubscriberCount === true
  const uploads = c.contentDetails?.relatedPlaylists?.uploads

  // Agregado dos vídeos recentes (engajamento).
  let viewsRecentes: number | null = null
  let curtidasRecentes: number | null = null
  let comentariosRecentes: number | null = null
  let videosConsiderados: number | null = null
  let videosRecentes: YouTubeVideoItem[] = []
  if (uploads) {
    try {
      const pl = await dataGet<PlaylistItemsResp>('/playlistItems', {
        part: 'contentDetails',
        playlistId: uploads,
        maxResults: VIDEOS_AGREGADO,
      })
      const ids = (pl.items ?? [])
        .map((i) => i.contentDetails?.videoId)
        .filter((v): v is string => Boolean(v))
      if (ids.length) {
        const vids = await dataGet<VideosResp>('/videos', {
          part: 'snippet,statistics',
          id: ids.join(','),
        })
        const items = vids.items ?? []
        videosConsiderados = items.length
        viewsRecentes = somaStat(items, 'viewCount')
        curtidasRecentes = somaStat(items, 'likeCount')
        comentariosRecentes = somaStat(items, 'commentCount')
        videosRecentes = items
          .filter((v) => v.id)
          .map((v) => ({
            id: v.id as string,
            titulo: v.snippet?.title ?? '(sem título)',
            thumbUrl:
              v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
            publicadoEm: v.snippet?.publishedAt ?? null,
            views: numStr(v.statistics?.viewCount),
            curtidas: numStr(v.statistics?.likeCount),
            comentarios: numStr(v.statistics?.commentCount),
            url: `https://www.youtube.com/watch?v=${v.id}`,
          }))
      } else {
        videosConsiderados = 0
      }
    } catch (e) {
      avisos.push(`vídeos recentes: ${mensagem(e)}`)
    }
  }

  return {
    contaId: channelId,
    titulo: c.snippet?.title ?? null,
    handle: c.snippet?.customUrl ? c.snippet.customUrl.replace(/^@/, '') : null,
    thumbUrl: c.snippet?.thumbnails?.medium?.url ?? c.snippet?.thumbnails?.default?.url ?? null,
    inscritos: ocultos ? null : numStr(c.statistics?.subscriberCount),
    inscritosOcultos: ocultos,
    viewsTotais: numStr(c.statistics?.viewCount),
    videos: numStr(c.statistics?.videoCount),
    viewsRecentes,
    curtidasRecentes,
    comentariosRecentes,
    videosConsiderados,
    videosRecentes,
    coletadoEm,
    avisos: avisos.length ? avisos : undefined,
  }
}

/** Descobre o canal do usuário autorizado (callback do OAuth). */
export async function getCanalAutorizado(
  accessToken: string,
): Promise<{ channelId: string; handle: string | null; titulo: string | null } | null> {
  const r = await dataGetAuth<ChannelsResp>('/channels', accessToken, { part: 'id,snippet', mine: true })
  const c = r.items?.[0]
  if (!c?.id) return null
  return {
    channelId: c.id,
    handle: c.snippet?.customUrl ? c.snippet.customUrl.replace(/^@/, '') : null,
    titulo: c.snippet?.title ?? null,
  }
}

function somaStat(
  items: { statistics?: Record<string, string | undefined> }[],
  campo: string,
): number {
  return items.reduce((s, it) => s + (numStr(it.statistics?.[campo]) ?? 0), 0)
}

function numStr(v: string | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

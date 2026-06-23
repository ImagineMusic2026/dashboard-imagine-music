import { displayGet, displayPost } from './client'
import type { TikTokSnapshot, TikTokVideoItem } from '@/lib/metricas-sociais/types'

/**
 * Coleta de métricas de uma conta TikTok (Display API). SERVER-ONLY.
 *
 * A Display API NÃO expõe alcance/impressões no nível de conta (isso é da
 * Business API). O que dá para coletar de forma orgânica:
 *  - perfil + estatísticas (`/user/info/`): seguidores, seguindo, curtidas
 *    totais, nº de vídeos — exige escopos `user.info.profile` + `user.info.stats`.
 *  - agregado dos vídeos públicos recentes (`/video/list/`): views/curtidas/
 *    comentários/compartilhamentos — exige escopo `video.list`.
 *
 * A coleta é tolerante a falha: um escopo ausente ou endpoint indisponível vira
 * `null` + entra em `avisos`, sem derrubar o restante.
 */

const CAMPOS_PERFIL =
  'open_id,union_id,avatar_url,display_name,username,is_verified,follower_count,following_count,likes_count,video_count'
const CAMPOS_VIDEO =
  'id,title,video_description,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count'
/** Quantos vídeos recentes entram no agregado de engajamento. */
const VIDEOS_AGREGADO = 20

interface UserInfoData {
  user?: {
    open_id?: string
    union_id?: string
    avatar_url?: string
    display_name?: string
    username?: string
    is_verified?: boolean
    follower_count?: number
    following_count?: number
    likes_count?: number
    video_count?: number
  }
}

interface VideoRaw {
  id?: string
  title?: string
  video_description?: string
  cover_image_url?: string
  share_url?: string
  /** Unix em segundos. */
  create_time?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

interface VideoListData {
  videos?: VideoRaw[]
  cursor?: number
  has_more?: boolean
}

export async function buscarMetricas(
  accessToken: string,
  usernameFallback?: string | null,
): Promise<TikTokSnapshot> {
  const avisos: string[] = []
  const coletadoEm = new Date().toISOString()

  // 1) Perfil + estatísticas.
  let user: NonNullable<UserInfoData['user']> = {}
  try {
    const data = await displayGet<UserInfoData>('/user/info/', accessToken, { fields: CAMPOS_PERFIL })
    user = data.user ?? {}
  } catch (e) {
    avisos.push(`perfil: ${mensagem(e)}`)
  }

  // 2) Agregado dos vídeos recentes (único sinal de engajamento da Display API).
  let viewsRecentes: number | null = null
  let curtidasRecentes: number | null = null
  let comentariosRecentes: number | null = null
  let compartilhamentosRecentes: number | null = null
  let videosConsiderados: number | null = null
  let videosRecentes: TikTokVideoItem[] = []
  try {
    const data = await displayPost<VideoListData>(
      '/video/list/',
      accessToken,
      { fields: CAMPOS_VIDEO },
      { max_count: VIDEOS_AGREGADO },
    )
    const vids = data.videos ?? []
    videosConsiderados = vids.length
    if (vids.length) {
      viewsRecentes = soma(vids, 'view_count')
      curtidasRecentes = soma(vids, 'like_count')
      comentariosRecentes = soma(vids, 'comment_count')
      compartilhamentosRecentes = soma(vids, 'share_count')
      videosRecentes = vids
        .filter((v): v is VideoRaw & { id: string } => Boolean(v.id))
        .map((v) => ({
          id: v.id,
          titulo: (v.title || v.video_description || '').trim() || '(sem legenda)',
          thumbUrl: v.cover_image_url ?? null,
          publicadoEm: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          url: v.share_url ?? null,
          views: numOuNull(v.view_count),
          curtidas: numOuNull(v.like_count),
          comentarios: numOuNull(v.comment_count),
          compartilhamentos: numOuNull(v.share_count),
        }))
    }
  } catch (e) {
    avisos.push(`vídeos: ${mensagem(e)}`)
  }

  return {
    contaId: user.open_id ?? '',
    username: (user.username || usernameFallback || '').toLowerCase(),
    displayName: user.display_name ?? null,
    avatarUrl: user.avatar_url ?? null,
    verificado: user.is_verified ?? null,
    seguidores: numOuNull(user.follower_count),
    segue: numOuNull(user.following_count),
    curtidas: numOuNull(user.likes_count),
    videos: numOuNull(user.video_count),
    viewsRecentes,
    curtidasRecentes,
    comentariosRecentes,
    compartilhamentosRecentes,
    videosConsiderados,
    videosRecentes: videosRecentes.length ? videosRecentes : undefined,
    coletadoEm,
    avisos: avisos.length ? avisos : undefined,
  }
}

function soma(vids: VideoRaw[], campo: keyof VideoRaw): number {
  return vids.reduce((s, v) => s + (typeof v[campo] === 'number' ? (v[campo] as number) : 0), 0)
}

function numOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

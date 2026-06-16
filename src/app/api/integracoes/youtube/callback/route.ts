import { NextResponse } from 'next/server'
import {
  resolverRedirectUriYT,
  youtubeDataConfigurado,
  youtubeOAuthConfigurado,
} from '@/lib/youtube/config'
import { verificarState } from '@/lib/youtube/oauth'
import { trocarCodePorToken } from '@/lib/youtube/client'
import { buscarMetricasCanal, getCanalAutorizado } from '@/lib/youtube/channel'
import { buscarAnalytics } from '@/lib/youtube/analytics'
import {
  gravarStatusYouTube,
  listarArtistasYouTube,
  listarTokensYouTube,
  salvarSnapshotYouTube,
  salvarTokenYouTube,
  salvarVinculoYouTube,
} from '@/lib/metricas-sociais/firestore'
import type { YouTubeSnapshot, YouTubeTokenDoc } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Callback do OAuth do Google (camada Analytics). O navegador do ARTISTA chega
 * aqui após o consentimento (sem header de auth) — a confiança vem do `state`
 * assinado, que diz a qual artista (slug) o token pertence. Troca o `code`,
 * descobre o canal autorizado, grava token + vínculo, faz uma coleta inicial e
 * volta para `returnTo` com `?youtube=ok|erro|negado`.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') ?? ''
  const erroParam = searchParams.get('error')

  if (!youtubeOAuthConfigurado()) return NextResponse.redirect(destino(origin, '/integracoes', 'erro'))

  const estado = verificarState(state)
  const returnTo = estado?.returnTo ?? '/integracoes'

  if (erroParam) return NextResponse.redirect(destino(origin, returnTo, 'negado'))
  if (!estado) return NextResponse.redirect(destino(origin, '/integracoes', 'erro'))
  if (!code) return NextResponse.redirect(destino(origin, returnTo, 'erro'))

  try {
    const tok = await trocarCodePorToken(code, resolverRedirectUriYT(req.url))
    const agora = Date.now()

    // Descobre o canal autorizado (Bearer, não precisa de API key).
    let canal: { channelId: string; handle: string | null; titulo: string | null } | null = null
    try {
      canal = await getCanalAutorizado(tok.access_token)
    } catch (e) {
      console.error('[youtube/callback] getCanalAutorizado falhou', e)
    }

    const tokenDoc: YouTubeTokenDoc = {
      slug: estado.slug,
      channelId: canal?.channelId ?? null,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? '',
      accessExpiraEm: new Date(agora + tok.expires_in * 1000).toISOString(),
      scope: tok.scope ?? '',
      atualizadoEm: new Date(agora).toISOString(),
    }
    await salvarTokenYouTube(tokenDoc)
    if (canal?.channelId) await salvarVinculoYouTube(estado.slug, canal.channelId, canal.handle)

    // Coleta inicial (best-effort): base pública (se houver API key) + analytics.
    try {
      const dia = new Date(agora).toISOString().slice(0, 10)
      let snap: YouTubeSnapshot
      if (canal?.channelId && youtubeDataConfigurado()) {
        snap = await buscarMetricasCanal(canal.channelId)
      } else {
        snap = snapshotMinimo(canal, new Date(agora).toISOString())
      }
      try {
        snap.analytics = await buscarAnalytics(tok.access_token)
      } catch (e) {
        snap.avisos = [...(snap.avisos ?? []), `analytics: ${mensagem(e)}`]
      }
      await salvarSnapshotYouTube(estado.slug, snap, dia)
    } catch (e) {
      console.error('[youtube/callback] coleta inicial falhou (token salvo mesmo assim)', e)
    }

    const [tokens, artistas] = await Promise.all([listarTokensYouTube(), listarArtistasYouTube()])
    await gravarStatusYouTube({
      status: 'conectado',
      contasConectadas: tokens.length,
      canaisMapeados: artistas.filter((a) => a.channelId).length,
      totalArtistas: artistas.length,
      erro: null,
    })

    return NextResponse.redirect(destino(origin, returnTo, 'ok'))
  } catch (e) {
    console.error('[api/integracoes/youtube/callback]', e)
    await gravarStatusYouTube({ status: 'erro', erro: mensagem(e) }).catch(() => {})
    return NextResponse.redirect(destino(origin, returnTo, 'erro'))
  }
}

function snapshotMinimo(
  canal: { channelId: string; handle: string | null; titulo: string | null } | null,
  coletadoEm: string,
): YouTubeSnapshot {
  return {
    contaId: canal?.channelId ?? '',
    titulo: canal?.titulo ?? null,
    handle: canal?.handle ?? null,
    inscritos: null,
    viewsTotais: null,
    videos: null,
    viewsRecentes: null,
    curtidasRecentes: null,
    comentariosRecentes: null,
    videosConsiderados: null,
    coletadoEm,
  }
}

function destino(origin: string, returnTo: string, youtube: 'ok' | 'erro' | 'negado'): URL {
  const url = new URL(returnTo, origin)
  url.searchParams.set('youtube', youtube)
  return url
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

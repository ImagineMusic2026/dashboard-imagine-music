import { NextResponse } from 'next/server'
import { resolverRedirectUri, tiktokConfigurado } from '@/lib/tiktok/config'
import { verificarState } from '@/lib/tiktok/oauth'
import { trocarCodePorToken } from '@/lib/tiktok/client'
import { buscarMetricas } from '@/lib/tiktok/insights'
import {
  gravarStatusTikTok,
  listarArtistasTikTok,
  listarTokensTikTok,
  salvarSnapshotTikTok,
  salvarTokenTikTok,
  salvarVinculoTikTok,
} from '@/lib/metricas-sociais/firestore'
import type { TikTokTokenDoc } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Callback do OAuth do TikTok. O navegador do ARTISTA chega aqui após o
 * consentimento (sem header de auth) — a confiança vem do `state` assinado, que
 * diz a qual artista (slug) o token pertence. Troca o `code` por tokens, grava
 * em `tiktok-tokens/{slug}`, faz uma coleta inicial e volta para `returnTo` com
 * `?tiktok=ok|erro|negado`.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') ?? ''
  const erroParam = searchParams.get('error')

  if (!tiktokConfigurado()) return NextResponse.redirect(destino(origin, '/integracoes', 'erro'))

  const estado = verificarState(state)
  const returnTo = estado?.returnTo ?? '/integracoes'

  // Consentimento negado pelo usuário, ou state adulterado/expirado.
  if (erroParam) return NextResponse.redirect(destino(origin, returnTo, 'negado'))
  if (!estado) return NextResponse.redirect(destino(origin, '/integracoes', 'erro'))
  if (!code) return NextResponse.redirect(destino(origin, returnTo, 'erro'))

  try {
    const tok = await trocarCodePorToken(code, resolverRedirectUri(req.url))
    const agora = Date.now()
    const tokenDoc: TikTokTokenDoc = {
      slug: estado.slug,
      openId: tok.open_id,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      accessExpiraEm: new Date(agora + tok.expires_in * 1000).toISOString(),
      refreshExpiraEm: new Date(agora + tok.refresh_expires_in * 1000).toISOString(),
      scope: tok.scope ?? '',
      atualizadoEm: new Date(agora).toISOString(),
    }
    await salvarTokenTikTok(tokenDoc)

    // Coleta inicial (best-effort): já mostra métricas e captura o @username.
    let username: string | null = null
    try {
      const m = await buscarMetricas(tok.access_token, null)
      username = m.username || null
      await salvarSnapshotTikTok(estado.slug, m, new Date(agora).toISOString().slice(0, 10))
    } catch (e) {
      console.error('[tiktok/callback] coleta inicial falhou (token salvo mesmo assim)', e)
    }
    await salvarVinculoTikTok(estado.slug, tok.open_id, username)

    const [tokens, artistas] = await Promise.all([listarTokensTikTok(), listarArtistasTikTok()])
    await gravarStatusTikTok({
      status: 'conectado',
      contasConectadas: tokens.length,
      totalArtistas: artistas.length,
      erro: null,
    })

    return NextResponse.redirect(destino(origin, returnTo, 'ok'))
  } catch (e) {
    console.error('[api/integracoes/tiktok/callback]', e)
    await gravarStatusTikTok({ status: 'erro', erro: mensagem(e) }).catch(() => {})
    return NextResponse.redirect(destino(origin, returnTo, 'erro'))
  }
}

function destino(origin: string, returnTo: string, tiktok: 'ok' | 'erro' | 'negado'): URL {
  const url = new URL(returnTo, origin)
  url.searchParams.set('tiktok', tiktok)
  return url
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

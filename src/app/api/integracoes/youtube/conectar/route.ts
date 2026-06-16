import { NextResponse } from 'next/server'
import { exigirSessaoAtiva } from '@/lib/server-auth'
import { resolverRedirectUriYT, youtubeOAuthConfigurado, YouTubeConfigError } from '@/lib/youtube/config'
import { montarUrlAutorizacao } from '@/lib/youtube/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Gera a URL de consentimento do Google para a camada Analytics do YouTube.
 * NÃO completa o OAuth — devolve o link. Quem autoriza é o ARTISTA, com a conta
 * Google/YouTube dele:
 *  - Artista (portal): autoriza só o próprio slug (vem da sessão).
 *  - Admin: gera o link de qualquer artista (`?slug=`) para enviar a ele.
 * Marketing não gerencia conexões (403).
 */
export async function GET(req: Request) {
  const sessao = await exigirSessaoAtiva(req)
  if (sessao instanceof NextResponse) return sessao

  if (!youtubeOAuthConfigurado()) {
    return NextResponse.json(
      { error: 'Camada Analytics do YouTube não configurada. Defina YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const ehAdmin = sessao.role === 'admin'
  const ehArtista = sessao.role === 'artista'
  if (!ehAdmin && !ehArtista) {
    return NextResponse.json({ error: 'Apenas admin ou o próprio artista podem conectar uma conta.' }, { status: 403 })
  }

  const slug = ehArtista ? sessao.artistaSlug : searchParams.get('slug')?.trim() || null
  if (!slug) {
    return NextResponse.json(
      { error: ehArtista ? 'Seu login não está vinculado a um artista.' : 'Informe o artista (?slug=).' },
      { status: 400 },
    )
  }

  const returnTo = sanitizarReturnTo(searchParams.get('returnTo'), ehArtista ? '/meu-perfil' : '/youtube-conectado')

  try {
    const url = montarUrlAutorizacao({ slug, returnTo, redirectUri: resolverRedirectUriYT(req.url) })
    return NextResponse.json({ ok: true, slug, url })
  } catch (e) {
    const msg = e instanceof YouTubeConfigError ? e.message : 'Falha ao montar a autorização do YouTube.'
    console.error('[api/integracoes/youtube/conectar]', e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

function sanitizarReturnTo(v: string | null, fallback: string): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('://')) return fallback
  return v
}

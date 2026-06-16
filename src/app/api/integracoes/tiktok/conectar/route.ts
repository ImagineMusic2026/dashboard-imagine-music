import { NextResponse } from 'next/server'
import { exigirSessaoAtiva } from '@/lib/server-auth'
import { resolverRedirectUri, tiktokConfigurado, TikTokConfigError } from '@/lib/tiktok/config'
import { montarUrlAutorizacao } from '@/lib/tiktok/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Gera a URL de consentimento do TikTok para um artista. NÃO completa o OAuth —
 * apenas devolve o link. Quem deve abrir o link e autorizar é o ARTISTA, com a
 * própria conta TikTok:
 *  - Artista (portal): autoriza só o próprio slug (o slug vem da sessão).
 *  - Admin: gera o link de qualquer artista (`?slug=`) para enviar a ele.
 *
 * Marketing não gerencia conexões (403). O destino pós-callback vai em
 * `?returnTo=` (caminho relativo) — default conforme o papel.
 */
export async function GET(req: Request) {
  const sessao = await exigirSessaoAtiva(req)
  if (sessao instanceof NextResponse) return sessao

  if (!tiktokConfigurado()) {
    return NextResponse.json(
      { error: 'Integração TikTok não configurada. Defina TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no ambiente.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const ehAdmin = sessao.role === 'admin'
  const ehArtista = sessao.role === 'artista'
  if (!ehAdmin && !ehArtista) {
    return NextResponse.json({ error: 'Apenas admin ou o próprio artista podem conectar uma conta.' }, { status: 403 })
  }

  // Artista só conecta o próprio slug; admin escolhe via querystring.
  const slug = ehArtista ? sessao.artistaSlug : searchParams.get('slug')?.trim() || null
  if (!slug) {
    return NextResponse.json(
      { error: ehArtista ? 'Seu login não está vinculado a um artista.' : 'Informe o artista (?slug=).' },
      { status: 400 },
    )
  }

  // Artista volta pro próprio portal; o link gerado pelo admin é aberto pelo
  // artista (que pode não ter login no painel), então cai numa página pública.
  const returnTo = sanitizarReturnTo(searchParams.get('returnTo'), ehArtista ? '/meu-perfil' : '/tiktok-conectado')

  try {
    const url = montarUrlAutorizacao({ slug, returnTo, redirectUri: resolverRedirectUri(req.url) })
    return NextResponse.json({ ok: true, slug, url })
  } catch (e) {
    const msg = e instanceof TikTokConfigError ? e.message : 'Falha ao montar a autorização do TikTok.'
    console.error('[api/integracoes/tiktok/conectar]', e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/** Aceita só caminhos relativos seguros (evita open redirect). */
function sanitizarReturnTo(v: string | null, fallback: string): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('://')) return fallback
  return v
}

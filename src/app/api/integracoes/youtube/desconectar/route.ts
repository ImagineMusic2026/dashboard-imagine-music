import { NextResponse } from 'next/server'
import { exigirSessaoAtiva } from '@/lib/server-auth'
import {
  gravarStatusYouTube,
  limparAnalyticsYouTube,
  listarArtistasYouTube,
  listarTokensYouTube,
  removerTokenYouTube,
} from '@/lib/metricas-sociais/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Remove a camada Analytics (tokens OAuth) de um artista. A base PÚBLICA do
 * canal continua sendo coletada normalmente — só os dados privados de Analytics
 * param. Admin desconecta qualquer artista (`?slug=`); o artista só o próprio.
 */
export async function POST(req: Request) {
  const sessao = await exigirSessaoAtiva(req)
  if (sessao instanceof NextResponse) return sessao

  const ehAdmin = sessao.role === 'admin'
  const ehArtista = sessao.role === 'artista'
  if (!ehAdmin && !ehArtista) {
    return NextResponse.json({ error: 'Apenas admin ou o próprio artista podem desconectar.' }, { status: 403 })
  }

  const slugQuery = new URL(req.url).searchParams.get('slug')?.trim() || null
  const slug = ehArtista ? sessao.artistaSlug : slugQuery
  if (!slug) {
    return NextResponse.json(
      { error: ehArtista ? 'Seu login não está vinculado a um artista.' : 'Informe o artista (?slug=).' },
      { status: 400 },
    )
  }

  try {
    await removerTokenYouTube(slug)
    await limparAnalyticsYouTube(slug)
    const [tokens, artistas] = await Promise.all([listarTokensYouTube(), listarArtistasYouTube()])
    await gravarStatusYouTube({
      contasConectadas: tokens.length,
      canaisMapeados: artistas.filter((a) => a.channelId).length,
      totalArtistas: artistas.length,
    })
    return NextResponse.json({ ok: true, slug })
  } catch (e) {
    console.error('[api/integracoes/youtube/desconectar]', e)
    return NextResponse.json({ error: 'Falha ao desconectar a camada Analytics do YouTube.' }, { status: 502 })
  }
}

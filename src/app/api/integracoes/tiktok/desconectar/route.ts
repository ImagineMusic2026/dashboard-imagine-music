import { NextResponse } from 'next/server'
import { exigirSessaoAtiva } from '@/lib/server-auth'
import {
  gravarStatusTikTok,
  listarArtistasTikTok,
  listarTokensTikTok,
  removerTokenTikTok,
} from '@/lib/metricas-sociais/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Remove o vínculo (tokens) do TikTok de um artista, parando a coleta. Admin
 * desconecta qualquer artista (`?slug=`); o artista desconecta só o próprio (o
 * slug vem da sessão). O histórico já coletado permanece.
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
    await removerTokenTikTok(slug)
    const [tokens, artistas] = await Promise.all([listarTokensTikTok(), listarArtistasTikTok()])
    await gravarStatusTikTok({
      status: tokens.length ? 'conectado' : 'nao_configurado',
      contasConectadas: tokens.length,
      totalArtistas: artistas.length,
    })
    return NextResponse.json({ ok: true, slug })
  } catch (e) {
    console.error('[api/integracoes/tiktok/desconectar]', e)
    return NextResponse.json({ error: 'Falha ao desconectar o TikTok.' }, { status: 502 })
  }
}

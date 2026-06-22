import { NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/server-auth'
import { ArtistaInputError, atualizarArtistaManual } from '@/lib/roster/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Edição de 1 artista já cadastrado. Só admin. Ao contrário de `/criar`, uma rede
 * enviada vazia é REMOVIDA do artista (e trocar a URL re-extrai o id, pra o
 * "descobrir" re-mapear). O slug é estável — editar o nome não muda o slug.
 */
export async function POST(req: Request) {
  const auth = await exigirAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    slug?: string
    nome?: string
    genero?: string
    spotifyUrl?: string
    youtubeUrl?: string
    instagramUrl?: string
    tiktokUrl?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  if (!body.slug) {
    return NextResponse.json({ error: 'Informe o artista (slug).' }, { status: 400 })
  }

  try {
    const res = await atualizarArtistaManual(
      {
        slug: body.slug,
        nome: body.nome ?? '',
        genero: body.genero,
        spotifyUrl: body.spotifyUrl,
        youtubeUrl: body.youtubeUrl,
        instagramUrl: body.instagramUrl,
        tiktokUrl: body.tiktokUrl,
      },
      { uid: auth.uid, email: auth.email }
    )
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    if (e instanceof ArtistaInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/artistas/atualizar]', e)
    return NextResponse.json({ error: 'Não foi possível atualizar o artista.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/server-auth'
import { ArtistaInputError, salvarArtistaManual } from '@/lib/roster/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cadastro manual de 1 artista. Só admin. Recebe nome + URLs das redes (todas
 * opcionais menos o nome) e faz UPSERT em `artistas/{slug}` preservando o que já
 * existir (receita, redes não informadas).
 */
export async function POST(req: Request) {
  const auth = await exigirAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    nome?: string
    genero?: string
    spotifyUrl?: string
    youtubeUrl?: string
    instagramUrl?: string
    tiktokUrl?: string
    contaArtistaSelo?: string
    emailProjeto?: string
    servicosPrevistos?: unknown
    anotacoesGerais?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  try {
    const res = await salvarArtistaManual(
      {
        nome: body.nome ?? '',
        genero: body.genero,
        spotifyUrl: body.spotifyUrl,
        youtubeUrl: body.youtubeUrl,
        instagramUrl: body.instagramUrl,
        tiktokUrl: body.tiktokUrl,
        contaArtistaSelo: body.contaArtistaSelo,
        emailProjeto: body.emailProjeto,
        // Só strings: o corpo vem do cliente e o Admin SDK rejeita o doc inteiro
        // se um item vier `undefined`.
        servicosPrevistos: Array.isArray(body.servicosPrevistos)
          ? body.servicosPrevistos.filter((s): s is string => typeof s === 'string')
          : undefined,
        anotacoesGerais: body.anotacoesGerais,
      },
      { uid: auth.uid, email: auth.email }
    )
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    if (e instanceof ArtistaInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/artistas/criar]', e)
    return NextResponse.json({ error: 'Não foi possível salvar o artista.' }, { status: 500 })
  }
}

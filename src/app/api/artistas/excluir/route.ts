import { NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/server-auth'
import { ArtistaInputError, excluirArtista } from '@/lib/roster/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Exclusão DEFINITIVA de um artista. Só admin. Remove o cadastro + métricas
 * (com histórico) + receita + tokens, tudo keyed por slug. Irreversível.
 *
 * Body: { slug: string }
 */
export async function POST(req: Request) {
  const auth = await exigirAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: { slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  if (!body.slug) {
    return NextResponse.json({ error: 'Informe o artista (slug).' }, { status: 400 })
  }

  try {
    const res = await excluirArtista(body.slug, { uid: auth.uid, email: auth.email })
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    if (e instanceof ArtistaInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/artistas/excluir]', e)
    return NextResponse.json({ error: 'Não foi possível excluir o artista.' }, { status: 500 })
  }
}

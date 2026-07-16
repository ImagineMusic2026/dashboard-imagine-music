import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { carregarReceitasArtista, OneRpmImportacaoError } from '@/lib/onerpm/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = {
  params: { slug: string }
}

export async function GET(req: Request, { params }: Props) {
  const auth = await exigirPermissao(req, 'verReceita')
  if (auth instanceof NextResponse) return auth

  try {
    const { consolidado, historico } = await carregarReceitasArtista(params.slug)
    return NextResponse.json({ consolidado, historico })
  } catch (e) {
    if (e instanceof OneRpmImportacaoError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/artistas/[slug]/receitas GET]', e)
    return NextResponse.json({ error: 'Não foi possível carregar a receita do artista.' }, { status: 500 })
  }
}

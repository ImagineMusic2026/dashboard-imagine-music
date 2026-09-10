import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import {
  carregarImportacaoDeReceita,
  carregarReceitasArtista,
  OneRpmImportacaoError,
} from '@/lib/onerpm/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = {
  params: { slug: string }
}

export async function GET(req: Request, { params }: Props) {
  const auth = await exigirPermissao(req, 'verReceita')
  if (auth instanceof NextResponse) return auth

  try {
    /*
     * `?versao=<importacaoId>` devolve UMA importação inteira; sem ele, vem o
     * consolidado mais a lista de meses em versão leve.
     *
     * A separação existe porque o detalhe de cada mês pesa ~300 KB e o card
     * mostra um mês por vez: mandar os 33 do maior artista custava 8,8 MB e
     * sete segundos para exibir um só.
     */
    const versao = new URL(req.url).searchParams.get('versao')
    if (versao) {
      const item = await carregarImportacaoDeReceita(params.slug, versao)
      if (!item) {
        return NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 })
      }
      return NextResponse.json({ versao: item })
    }

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

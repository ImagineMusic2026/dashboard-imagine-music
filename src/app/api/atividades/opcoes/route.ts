import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { mapaNomesArtistas } from '@/lib/metricas-sociais/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Artistas para o seletor do quadro de atividades do COLABORADOR.
 *
 * Ele não lê a coleção `artistas` direto (a regra é da equipe: o documento traz
 * redes, label e foto), mas precisa marcar de que artista é a demanda. Então
 * pede aqui, e recebe SÓ o endereço e o nome — mesmo dado que já vai
 * denormalizado em cada card.
 *
 * A equipe não passa por aqui: ela já lê o roster pelo cliente, com cache.
 */
export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'atividades')
  if (auth instanceof NextResponse) return auth

  try {
    const nomes = await mapaNomesArtistas()
    const artistas = Array.from(nomes, ([slug, nome]) => ({ slug, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    return NextResponse.json({ artistas })
  } catch (e) {
    console.error('[api/atividades/opcoes]', e)
    return NextResponse.json({ error: 'Não foi possível carregar os artistas.' }, { status: 500 })
  }
}

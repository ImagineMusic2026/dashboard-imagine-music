import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { nomeDoArquivo, type AbaPlanilha } from '@/lib/artistas/exportar'
import { renderizarPlanilha } from '@/lib/artistas/planilha'

// ExcelJS precisa do runtime Node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface Props {
  params: { slug: string }
}

/** Teto por aba e no total — impede um corpo gigante de virar memória do serverless. */
const MAX_ABAS = 12
const MAX_LINHAS = 5_000
const MAX_COLUNAS = 40
const MAX_TEXTO = 4_000

/**
 * Formata em .xlsx as abas que o cliente já montou.
 *
 * É FORMATADOR, não fonte de dados: quem chama envia o conteúdo que já leu com
 * as próprias permissões, e recebe o mesmo conteúdo estilizado de volta. Não há
 * ganho de privilégio possível — ninguém recebe daqui nada que não tenha
 * mandado. A alternativa (o servidor reler tudo) duplicaria a montagem que já
 * existe no cliente e faria as duas versões divergirem com o tempo.
 *
 * A validação abaixo existe só para tamanho: corpo enorme derruba o serverless.
 */
export async function POST(req: Request, { params }: Props) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  let corpo: { abas?: unknown; artista?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const abas = corpo.abas
  if (!Array.isArray(abas) || !abas.length || abas.length > MAX_ABAS) {
    return NextResponse.json({ error: 'Abas inválidas.' }, { status: 400 })
  }

  const limpas: AbaPlanilha[] = []
  for (const bruta of abas) {
    const a = bruta as Partial<AbaPlanilha>
    if (typeof a?.nome !== 'string' || !Array.isArray(a.linhas) || !Array.isArray(a.larguras)) {
      return NextResponse.json({ error: 'Aba malformada.' }, { status: 400 })
    }
    if (a.linhas.length > MAX_LINHAS || a.larguras.length > MAX_COLUNAS) {
      return NextResponse.json({ error: 'Planilha grande demais.' }, { status: 413 })
    }
    limpas.push({
      // O nome da aba vira nome de planilha no Excel, que proíbe : \ / ? * [ ]
      nome: a.nome.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Dados',
      larguras: a.larguras.map((l) => (typeof l === 'number' && l > 0 ? Math.min(l, 120) : 14)),
      linhas: a.linhas.map((linha) =>
        (Array.isArray(linha) ? linha : []).slice(0, MAX_COLUNAS).map((c) => {
          if (typeof c === 'number' && Number.isFinite(c)) return c
          if (c == null) return null
          return String(c).slice(0, MAX_TEXTO)
        }),
      ),
      formatos: a.formatos && typeof a.formatos === 'object' ? a.formatos : undefined,
    })
  }

  const artista = typeof corpo.artista === 'string' ? corpo.artista.slice(0, 120) : params.slug

  try {
    const arquivo = await renderizarPlanilha(limpas, { artista })
    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeDoArquivo(params.slug, 'xlsx')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[api/artistas/[slug]/planilha]', e)
    return NextResponse.json({ error: 'Não foi possível gerar a planilha.' }, { status: 500 })
  }
}

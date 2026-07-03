import { NextResponse } from 'next/server'
import { exigirSessaoAtiva } from '@/lib/server-auth'
import { getCatalogoFaixas, salvarCatalogoFaixasLote } from '@/lib/metricas-sociais/firestore'
import type { CatalogoFaixaDoc } from '@/lib/onerpm/catalogo-faixas'
import { resolverISRCDeezer } from '@/lib/onerpm/deezer'

// fetch (Deezer) + firebase-admin precisam do runtime Node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_ISRCS = 80
const MAX_RESOLVER = 50 // máx. de buscas no Deezer por request (bound de tempo)

/**
 * Resolve ISRC → título a partir de `catalogo-faixas` (catálogo oficial da
 * OneRPM importado + fallback Deezer pros ISRCs sem doc). O card da análise de
 * faixas manda os ISRCs visíveis e recebe título + link (o link só existe
 * quando veio do Deezer — o catálogo da OneRPM não tem link). Os títulos NÃO
 * ficam no detalhe (que o cron reconstrói) — ficam neste cache à parte.
 * Qualquer membro ativo pode chamar (título de faixa não é sensível).
 */
export async function POST(req: Request) {
  const auth = await exigirSessaoAtiva(req)
  if (auth instanceof NextResponse) return auth

  let body: { isrcs?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const isrcs = Array.isArray(body.isrcs)
    ? Array.from(
        new Set(
          body.isrcs.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9]{12}$/.test(x)),
        ),
      ).slice(0, MAX_ISRCS)
    : []
  if (!isrcs.length) return NextResponse.json({ titulos: {} })

  const cache = await getCatalogoFaixas(isrcs)
  const titulos: Record<string, { titulo: string; link: string | null }> = {}
  const aResolver: string[] = []
  for (const isrc of isrcs) {
    const c = cache.get(isrc)
    if (c) {
      if (c.titulo) titulos[isrc] = { titulo: c.titulo, link: c.link ?? null }
      // c.naoEncontrado: já sabemos que o Deezer não tem — não re-busca.
    } else {
      aResolver.push(isrc)
    }
  }

  const agora = new Date().toISOString()
  const novos: CatalogoFaixaDoc[] = []
  const fila = aResolver.slice(0, MAX_RESOLVER)
  for (let i = 0; i < fila.length; i += 6) {
    const lote = fila.slice(i, i + 6)
    const resolvidos = await Promise.all(
      lote.map((isrc) => resolverISRCDeezer(isrc).then((r) => ({ isrc, r }))),
    )
    for (const { isrc, r } of resolvidos) {
      if (r) {
        titulos[isrc] = { titulo: r.titulo, link: r.link }
        novos.push({ isrc, titulo: r.titulo, link: r.link, releaseDate: r.releaseDate, fonte: 'deezer', atualizadoEm: agora })
      } else {
        novos.push({ isrc, titulo: null, link: null, releaseDate: null, naoEncontrado: true, fonte: 'deezer', atualizadoEm: agora })
      }
    }
  }
  if (novos.length) await salvarCatalogoFaixasLote(novos).catch(() => {})

  return NextResponse.json({ titulos })
}

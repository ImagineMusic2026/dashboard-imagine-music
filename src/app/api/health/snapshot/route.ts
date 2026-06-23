import { NextResponse } from 'next/server'
import { autorizarCronOuAdmin } from '@/lib/server-auth'
import { carregarParaHealth, salvarHistoricoHealthLote } from '@/lib/metricas-sociais/firestore'
import { derivarHealthScores } from '@/lib/health/score'
import type { HistoricoHealthDiaDoc } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Carimba 1×/dia o Health Score de cada artista em
 * `metricas-sociais/{slug}/historico-health/{dia}` — a série que alimenta a
 * tendência do score. Deriva do snapshot consolidado (`derivarHealthScores`,
 * a MESMA lib da home/perfil), então roda DEPOIS dos syncs de plataforma
 * (cron 9h, após meta/tiktok/youtube). Não escreve nada nas redes.
 *
 * Auth: CRON_SECRET (Vercel Cron, GET) ou admin (POST manual pelo painel).
 */
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  const auth = await autorizarCronOuAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { mapa, nomePorSlug } = await carregarParaHealth()
    const dia = new Date().toISOString().slice(0, 10)
    const coletadoEm = new Date().toISOString()
    const saudes = derivarHealthScores(mapa, nomePorSlug)

    const pontos: { slug: string; doc: HistoricoHealthDiaDoc }[] = saudes.map((s) => ({
      slug: s.slug,
      doc: {
        dia,
        score: s.score,
        audiencia: s.breakdown.audiencia,
        crescimento: s.breakdown.crescimento,
        engajamento: s.breakdown.engajamento,
        conteudo: s.breakdown.conteudo,
        seguidoresTotal: s.seguidoresTotal,
        coletadoEm,
      },
    }))

    await salvarHistoricoHealthLote(pontos)

    return NextResponse.json({ ok: true, dia, avaliados: saudes.length, gravados: pontos.length })
  } catch (e) {
    console.error('[api/health/snapshot]', e)
    return NextResponse.json({ error: 'Falha ao carimbar o Health Score.' }, { status: 502 })
  }
}

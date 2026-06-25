/**
 * Roda o Health Score (já com o pilar de streaming) contra o dado real e mostra
 * o impacto: média do portfólio, composição média e top artistas.
 *   npx tsx scripts/check-health-streaming.ts
 */
import { adminDb } from '../src/lib/firebase-admin'
import { derivarHealthScores, resumirSaude } from '../src/lib/health/score'
import type { MetricasSociaisDoc } from '../src/lib/metricas-sociais/types'

async function main() {
  const [metr, art] = await Promise.all([
    adminDb.collection('metricas-sociais').get(),
    adminDb.collection('artistas').get(),
  ])
  const mapa = new Map<string, MetricasSociaisDoc>()
  metr.forEach((d) => mapa.set(d.id, { slug: d.id, ...(d.data() as object) } as MetricasSociaisDoc))
  const nome = new Map<string, string>()
  art.forEach((d) => nome.set(d.id, (d.data() as { nome?: string }).nome ?? d.id))

  const saudes = derivarHealthScores(mapa, nome)
  const resumo = resumirSaude(saudes)
  const b = resumo.breakdownMedio

  console.log(`avaliados: ${resumo.avaliados}  ·  média: ${resumo.media}`)
  console.log(`distribuição: ${JSON.stringify(resumo.distribuicao)}`)
  console.log(
    `composição média → aud ${b.audiencia} · cresc ${b.crescimento} · eng ${b.engajamento} · cont ${b.conteudo} · STREAM ${b.streaming}`,
  )
  console.log('\ntop 10 por score (pilar de streaming entre colchetes):')
  for (const s of saudes.slice(0, 10)) {
    console.log(`  ${s.nome.slice(0, 22).padEnd(24)} ${String(s.score).padStart(3)}  [str ${s.breakdown.streaming ?? '—'}]`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

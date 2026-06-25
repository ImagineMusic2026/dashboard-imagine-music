/**
 * Lê o detalhe granular de streaming de um artista (faixas + países com skip).
 *   node scripts/check-streaming-detalhe.mjs neto-brito
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const slug = process.argv[2] || 'neto-brito'
const doc = await db.doc(`metricas-sociais/${slug}/streaming-detalhe/atual`).get()
if (!doc.exists) {
  console.log(`(sem streaming-detalhe para ${slug})`)
  process.exit(0)
}
const d = doc.data()
const int = (n) => Number(n).toLocaleString('pt-BR')

console.log(`${slug}: ${d.porFaixa.length} faixas · ${d.periodo.de} → ${d.periodo.ate} (${d.periodo.dias}d)\n`)

const puladas = d.porFaixa
  .filter((f) => f.streams >= 200)
  .map((f) => ({ ...f, rate: f.skips / f.streams }))
  .sort((a, b) => b.rate - a.rate)

console.log('TOP 12 MAIS PULADAS (>= 200 streams):')
for (const f of puladas.slice(0, 12)) {
  console.log(`  ${f.isrc.padEnd(14)} ${int(f.streams).padStart(9)} str  ${int(f.skips).padStart(8)} skips  ${(f.rate * 100).toFixed(0)}%`)
}

console.log('\nPaíses (skip rate):')
for (const p of d.porPais.slice(0, 6)) {
  console.log(`  ${p.pais}  ${int(p.streams).padStart(10)} str  ${(p.skips / Math.max(1, p.streams) * 100).toFixed(0)}% skip`)
}
process.exit(0)

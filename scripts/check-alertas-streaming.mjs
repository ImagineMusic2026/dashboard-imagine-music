/**
 * Replica a lógica de `alertaStreaming` (derivar.ts) em JS puro pra conferir,
 * com dado real, quantos artistas disparariam alerta de streaming hoje.
 *   node scripts/check-alertas-streaming.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const fmt = (n) => Number(n).toLocaleString('pt-BR')
const snap = await db.collection('metricas-sociais').get()

let vir = 0
let queda = 0
const rows = []
snap.forEach((d) => {
  const st = d.data().streaming
  if (!st) return
  const s28 = st.streams28d ?? 0
  const s7 = st.streams7d ?? 0
  const prior = (s28 - s7) / 3
  if (prior < 1000) return
  const pct = (s7 - prior) / prior
  if (pct >= 0.5) {
    vir++
    rows.push(['VIRAL', d.id, s7, pct])
  } else if (pct <= -0.4) {
    queda++
    rows.push([pct <= -0.6 ? 'QUEDA!' : 'queda', d.id, s7, pct])
  }
})
rows.sort((a, b) => Math.abs(b[3]) - Math.abs(a[3]))

console.log(`De ${snap.size} docs: ${vir} viralização + ${queda} queda de streaming\n`)
for (const [tag, slug, s7, pct] of rows.slice(0, 15)) {
  console.log(`  ${tag.padEnd(6)} ${slug.padEnd(24)} ${fmt(s7).padStart(11)} streams/sem  ${(pct * 100).toFixed(0)}%`)
}
process.exit(0)

/**
 * Lê de volta o snapshot de streaming gravado pelo sync, pra conferência.
 *   node scripts/check-streaming.mjs rock-salles
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const slug = process.argv[2] || 'rock-salles'
const doc = await db.doc(`metricas-sociais/${slug}`).get()
const s = doc.data()?.streaming
if (!s) {
  console.log(`(sem streaming em metricas-sociais/${slug})`)
  process.exit(0)
}

const int = (n) => Number(n).toLocaleString('pt-BR')
console.log(`=== streaming de ${slug} (${s.artistaNome}) ===`)
console.log('período   :', s.periodo.de, '->', s.periodo.ate, `(${s.periodo.dias} dias)`)
console.log('streams   :', int(s.streams), '| 28d:', int(s.streams28d), '| 7d:', int(s.streams7d))
console.log('skips     :', int(s.skips), `(${(s.skipRate * 100).toFixed(1)}%)`)
console.log('faixas    :', s.faixas, '| lojas:', s.lojas.join(', '))
console.log('plataforma:', s.porPlataforma.map((p) => `${p.plataforma} ${int(p.streams)}`).join('  '))
console.log('países    :', s.porPais.slice(0, 8).map((p) => `${p.pais} ${int(p.streams)}`).join('  '))

const hist = await db.collection(`metricas-sociais/${slug}/historico-streaming`).orderBy('dia').get()
console.log(`\nhistorico-streaming: ${hist.size} dias`)
const ds = hist.docs.map((d) => d.data())
for (const x of ds.slice(-7)) console.log('  ', x.dia, int(x.streams), 'str', x.skips, 'skips')
process.exit(0)

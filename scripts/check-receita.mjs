/**
 * Panorama de quantos artistas têm RECEITA vs STREAMING hoje.
 *   node scripts/check-receita.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const [art, rec, metr, imp] = await Promise.all([
  db.collection('artistas').get(),
  db.collection('receitas').get(),
  db.collection('metricas-sociais').get(),
  db.collection('importacoes').get(),
])
const comStreaming = metr.docs.filter((d) => d.data().streaming).length

console.log('artistas no roster      :', art.size)
console.log('com STREAMING (plays)   :', comStreaming)
console.log('com RECEITA (R$)        :', rec.size)
console.log('importações de receita  :', imp.size, '(uploads manuais de XLSX)')

console.log('\nartistas COM receita:')
if (rec.empty) console.log('  (nenhum)')
rec.forEach((d) => {
  const x = d.data()
  console.log(`  ${x.nome ?? d.id} — R$ ${Number(x.totalBRL ?? 0).toFixed(2)} | ${x.streams ?? 0} streams`)
})
process.exit(0)

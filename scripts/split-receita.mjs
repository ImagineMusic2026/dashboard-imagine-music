import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

// Campos de receita (sensíveis) que saem de artistas/ e vão pra receitas/.
const CAMPOS_RECEITA = [
  'receitaPorPlataforma',
  'totais',
  'totalBRL',
  'streams',
  'moedas',
  'periodo',
  'configUsada',
  'ultimaImportacaoId',
  'fonte',
]

const arts = await db.collection('artistas').get()
let migrados = 0

for (const d of arts.docs) {
  const x = d.data()
  if (!x.receitaPorPlataforma) continue // só docs que ainda têm receita embutida

  const receita = {
    slug: d.id,
    nome: x.nome ?? d.id,
    label: x.label ?? '',
    atualizadoEm: FieldValue.serverTimestamp(),
  }
  for (const c of CAMPOS_RECEITA) if (x[c] !== undefined) receita[c] = x[c]
  await db.collection('receitas').doc(d.id).set(receita, { merge: true })

  const del = {}
  for (const c of CAMPOS_RECEITA) del[c] = FieldValue.delete()
  await db.collection('artistas').doc(d.id).update(del)

  migrados++
  console.log('migrado:', d.id)
}

console.log('\ntotal migrados:', migrados)

const a = (await db.doc('artistas/rock-salles').get()).data() ?? {}
const r = (await db.doc('receitas/rock-salles').get()).data() ?? {}
console.log('\n=== conferência rock-salles ===')
console.log('artistas/ -> receita removida?', !a.receitaPorPlataforma, '| mantém redes?', !!a.redes, '| nome:', a.nome)
console.log('receitas/ -> totalBRL: R$', Number(r.totalBRL ?? 0).toFixed(2), '| streams:', r.streams, '| plataformas:', r.receitaPorPlataforma?.length)
process.exit(0)

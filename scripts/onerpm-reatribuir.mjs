/**
 * Reatribui o streaming de um slug (grafia do feed) para outro (slug do roster),
 * SEM re-baixar do SFTP: copia o snapshot + a subcoleção historico-streaming e
 * apaga o órfão. Para quando um alias novo é descoberto depois do backfill.
 *   node scripts/onerpm-reatribuir.mjs <fromSlug> <toSlug>
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const from = process.argv[2]
const to = process.argv[3]
if (!from || !to) {
  console.error('uso: node scripts/onerpm-reatribuir.mjs <fromSlug> <toSlug>')
  process.exit(1)
}

const fromRef = db.doc(`metricas-sociais/${from}`)
const s = (await fromRef.get()).data()?.streaming
if (!s) {
  console.log(`nada a reatribuir em ${from}`)
  process.exit(0)
}

const toRef = db.doc(`metricas-sociais/${to}`)
await toRef.set({ slug: to, streaming: s, atualizadoEm: s.coletadoEm }, { merge: true })

const hist = await fromRef.collection('historico-streaming').get()
let n = 0
for (let i = 0; i < hist.docs.length; i += 400) {
  const batch = db.batch()
  for (const d of hist.docs.slice(i, i + 400)) {
    batch.set(toRef.collection('historico-streaming').doc(d.id), d.data(), { merge: true })
    n++
  }
  await batch.commit()
}

await db.recursiveDelete(fromRef)
console.log(`reatribuído ${from} -> ${to}: snapshot + ${n} dias de histórico copiados; órfão removido.`)
process.exit(0)

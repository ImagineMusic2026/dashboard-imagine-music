/**
 * Cadastra no roster os artistas novos que só apareceram pelo streaming da OneRPM
 * (sem similar no roster). O slug bate com o que o sync já gravou em
 * metricas-sociais, então o card casa na hora. Idempotente (não sobrescreve).
 *   node scripts/onerpm-register-novos.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()
const agora = admin.firestore.FieldValue.serverTimestamp()

const novos = [
  { slug: 'cesar-figueredo', nome: 'Cesar Figueredo' },
  { slug: 'marianna-lola', nome: 'Marianna Lola' },
]

for (const a of novos) {
  const ref = db.collection('artistas').doc(a.slug)
  const snap = await ref.get()
  if (snap.exists) {
    console.log('já existe, pulando:', a.slug)
    continue
  }
  await ref.set(
    {
      nome: a.nome,
      slug: a.slug,
      fonteCadastro: 'onerpm-streaming',
      criadoEm: agora,
      cadastroAtualizadoEm: agora,
      criadoPorEmail: 'onerpm-sync',
      cadastroPorEmail: 'onerpm-sync',
    },
    { merge: true },
  )
  console.log('cadastrado:', a.nome, `(${a.slug})`)
}
process.exit(0)

// Troca a role de um usuário (pra testar os gates). Usa o Admin SDK.
// Uso: node scripts/set-role.mjs admin        (muda o usuário admin padrão)
//      node scripts/set-role.mjs marketing <uid>
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const role = process.argv[2]
const uid = process.argv[3] ?? 'FJ7DlqqAFsYwGj6Lcr4E3Br5NqY2'

if (!['admin', 'marketing'].includes(role)) {
  console.error('uso: node scripts/set-role.mjs admin|marketing [uid]')
  process.exit(1)
}

await admin.firestore().doc(`users/${uid}`).update({ role })
console.log(`✓ role de ${uid} = ${role}`)
process.exit(0)

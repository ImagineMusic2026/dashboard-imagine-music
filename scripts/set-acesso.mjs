// Ativa/desativa o acesso de um membro pelas DUAS pontas (espelha /api/membros/ativo).
// Útil pra administrar via terminal enquanto o painel novo não está deployado.
// Uso:
//   node scripts/set-acesso.mjs <email-ou-uid> off   # desativa (bloqueia o login de verdade)
//   node scripts/set-acesso.mjs <email-ou-uid> on    # reativa
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const arg = process.argv[2]
const acao = process.argv[3]
if (!arg || !['on', 'off'].includes(acao)) {
  console.error('uso: node scripts/set-acesso.mjs <email-ou-uid> on|off')
  process.exit(1)
}
const ativo = acao === 'on'

const auth = admin.auth()
const db = admin.firestore()

const user = arg.includes('@') ? await auth.getUserByEmail(arg) : await auth.getUser(arg)

await auth.updateUser(user.uid, { disabled: !ativo })
if (!ativo) await auth.revokeRefreshTokens(user.uid) // derruba sessões abertas
await db.doc(`users/${user.uid}`).set({ ativo }, { merge: true })

console.log(`${ativo ? '🔓 reativado' : '🔒 desativado'}: ${user.email} (${user.uid})`)
console.log(`  Auth.disabled = ${!ativo}  ·  Firestore.ativo = ${ativo}`)
process.exit(0)

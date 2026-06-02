// Mostra o estado de acesso de um membro nas DUAS pontas:
//   - Auth.disabled   (a credencial pode logar?)
//   - Firestore.ativo (o flag de perfil)
// Uso: node scripts/check-acesso.mjs <email-ou-uid>
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const arg = process.argv[2]
if (!arg) {
  console.error('uso: node scripts/check-acesso.mjs <email-ou-uid>')
  process.exit(1)
}

const auth = admin.auth()
const db = admin.firestore()

const user = arg.includes('@') ? await auth.getUserByEmail(arg) : await auth.getUser(arg)
const snap = await db.doc(`users/${user.uid}`).get()
const perfil = snap.exists ? snap.data() : null

const linha = '—'.repeat(44)
console.log(linha)
console.log('UID:             ', user.uid)
console.log('E-mail:          ', user.email)
console.log('Auth.disabled:   ', user.disabled, user.disabled ? '🔒 login BLOQUEADO' : '🔓 login permitido')
console.log('Firestore.ativo: ', perfil ? perfil.ativo : '(sem doc de perfil)')
console.log('Firestore.role:  ', perfil ? perfil.role : '—')
console.log(linha)

if (perfil && perfil.ativo === false && user.disabled === false) {
  console.log('⚠️  INCONSISTENTE: inativo no Firestore, mas o login no Auth ainda está liberado.')
  console.log('   → Re-desative pelo painel (Reativar → Desativar) pra desabilitar a credencial.')
} else if (perfil && perfil.ativo === false && user.disabled === true) {
  console.log('✓ Coerente: desativado nas duas pontas (login bloqueado de verdade).')
}

process.exit(0)

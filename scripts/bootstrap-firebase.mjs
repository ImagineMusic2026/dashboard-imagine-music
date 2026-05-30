// Bootstrap do Firebase via Admin SDK (ignora as security rules).
// Faz 2 coisas: publica as firestore.rules e cria o doc do usuário admin.
//
// Uso: salve a chave de service account como serviceAccountKey.json na raiz
// do projeto e rode:  node scripts/bootstrap-firebase.mjs
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ADMIN_UID = 'FJ7DlqqAFsYwGj6Lcr4E3Br5NqY2'
const ADMIN_DOC = {
  email: 'talisfilipe74@outlook.com',
  nome: 'Talis',
  role: 'admin',
  ativo: true,
}

const serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

async function publicarRegras() {
  try {
    const source = readFileSync(join(root, 'firestore.rules'), 'utf8')
    await admin.securityRules().releaseFirestoreRulesetFromSource(source)
    console.log('✓ Regras do Firestore publicadas')
  } catch (e) {
    console.error('✗ Não consegui publicar as regras:', e.message)
    console.error('  → Publique manualmente: Console → Firestore → Regras → cole firestore.rules → Publicar')
  }
}

async function criarAdmin() {
  try {
    await admin.firestore().doc(`users/${ADMIN_UID}`).set(ADMIN_DOC, { merge: true })
    const snap = await admin.firestore().doc(`users/${ADMIN_UID}`).get()
    console.log(`✓ Doc admin criado em users/${ADMIN_UID}:`, JSON.stringify(snap.data()))
  } catch (e) {
    console.error('✗ Não consegui criar o doc admin:', e.message)
  }
}

await publicarRegras()
await criarAdmin()
process.exit(0)

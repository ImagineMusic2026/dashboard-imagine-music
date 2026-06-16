import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Firebase Admin SDK (somente servidor — Route Handlers).
 *
 * Credencial, em ordem de preferência:
 *   1. FIREBASE_SERVICE_ACCOUNT  — JSON inteiro da service account (use em produção, ex.: Vercel)
 *   2. serviceAccountKey.json    — arquivo na raiz do projeto (desenvolvimento local)
 *   3. applicationDefault()      — GOOGLE_APPLICATION_CREDENTIALS, se estiver definido
 *
 * ⚠️ NUNCA importe este módulo de um Client Component: ele dá acesso TOTAL ao projeto
 * e só pode rodar no servidor.
 */
function credencial() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (inline) {
    return admin.credential.cert(JSON.parse(inline))
  }
  try {
    const json = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'))
    return admin.credential.cert(json)
  } catch {
    return admin.credential.applicationDefault()
  }
}

// Singleton — evita reinicializar no hot-reload do Next.
const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: credencial() })

export const adminAuth = admin.auth(app)

const db = admin.firestore(app)
// Ignora campos `undefined` nas escritas (ex.: `avisos` quando não há aviso) em
// vez de lançar — senão o Admin SDK rejeita o documento inteiro. settings() só
// pode ser chamado uma vez por instância; o try/catch cobre o hot-reload do dev.
try {
  db.settings({ ignoreUndefinedProperties: true })
} catch {
  // já configurado nesta instância (re-import no dev)
}
export const adminDb = db

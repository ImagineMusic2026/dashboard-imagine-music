/**
 * Publica o `firestore.rules` no projeto (via Security Rules Management API do
 * Admin SDK). Substitui o ruleset ativo do Cloud Firestore pelo conteúdo do
 * arquivo. Precisa que a service account tenha permissão de Firebase Rules.
 *   node scripts/deploy-firestore-rules.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })

const rules = readFileSync('./firestore.rules', 'utf8')
try {
  const rs = await admin.securityRules().releaseFirestoreRulesetFromSource(rules)
  console.log('✓ Regras do Firestore publicadas.')
  console.log('  ruleset:', rs.name)
  console.log('  criado :', rs.createTime)
} catch (e) {
  console.error('✗ Falha ao publicar:', e?.code || '', e?.message)
  console.error('  (provável: a service account não tem permissão de Firebase Rules — então use a CLI/Console.)')
  process.exit(1)
}
process.exit(0)

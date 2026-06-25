/**
 * Remove os docs de streaming ÓRFÃOS — slugs do feed com grafia divergente que
 * foram redirecionados via alias (trends-aliases.ts) para o slug do roster.
 * Depois do backfill com alias, o dado correto vive no slug do roster; estes
 * ficam obsoletos. Trava de segurança: NÃO apaga se existir artista cadastrado
 * com o slug (evita remover métricas de um artista real).
 *   node scripts/onerpm-limpar-orfaos.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

// Mesmas chaves do ALIAS_ARTISTA em src/lib/onerpm/trends-aliases.ts.
const orfaos = ['netto-brito', 'herisson-rocha', 'fillipe-aladin', 'willian-dicastro', 'kleiton-bacelar']

for (const slug of orfaos) {
  const art = await db.doc(`artistas/${slug}`).get()
  if (art.exists) {
    console.log('PULANDO (tem cadastro no roster):', slug)
    continue
  }
  const ref = db.doc(`metricas-sociais/${slug}`)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log('já não existe:', slug)
    continue
  }
  // recursiveDelete apaga o doc + a subcoleção historico-streaming.
  await db.recursiveDelete(ref)
  console.log('removido órfão:', slug)
}
process.exit(0)

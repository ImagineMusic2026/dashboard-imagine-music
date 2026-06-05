/**
 * Migra os docs de `importacoes` para o ID determinístico (artista+período) e
 * remove duplicatas. Mantém o mais recente como canônico.
 *   npx tsx scripts/dedupe-importacoes.ts
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { importIdDe } from '../src/lib/onerpm/aggregate'

type Grupo = { data: admin.firestore.DocumentData; oldIds: string[]; slug: string }

void (async () => {
  const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(svc) })
  const db = admin.firestore()

  const snap = await db.collection('importacoes').get()
  console.log('docs antes:', snap.size)

  const grupos = new Map<string, Grupo>()

  for (const d of snap.docs) {
    const x = d.data()
    const periodo = x.periodo ?? { transactionMonths: [], accountedFrom: null, accountedTo: null }
    const detId = importIdDe({ artistaSlug: x.artistaSlug ?? '', periodo })

    if (!grupos.has(detId)) grupos.set(detId, { data: x, oldIds: [], slug: x.artistaSlug ?? '' })
    const g = grupos.get(detId) as Grupo

    const tsNovo = x.criadoEm?.toMillis ? x.criadoEm.toMillis() : 0
    const tsAtual = g.data.criadoEm?.toMillis ? g.data.criadoEm.toMillis() : 0
    if (tsNovo >= tsAtual) g.data = x
    if (d.id !== detId) g.oldIds.push(d.id)
  }

  for (const [detId, g] of Array.from(grupos)) {
    await db.collection('importacoes').doc(detId).set(g.data)
    if (g.slug) await db.doc(`artistas/${g.slug}`).set({ ultimaImportacaoId: detId }, { merge: true })
    for (const oldId of g.oldIds) {
      if (oldId !== detId) await db.collection('importacoes').doc(oldId).delete()
    }
    console.log(`canônico: ${detId}  | removidos: ${g.oldIds.join(', ') || '(nenhum)'}`)
  }

  const depois = await db.collection('importacoes').get()
  console.log('\ndocs depois:', depois.size)
  depois.forEach((d) => console.log(' -', d.id))
  process.exit(0)
})()

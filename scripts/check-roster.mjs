import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const arts = await db.collection('artistas').get()
const comRedes = arts.docs.filter((d) => d.data().redes).length
const comReceita = arts.docs.filter((d) => d.data().receitaPorPlataforma).length
console.log('=== coleção artistas ===')
console.log('TOTAL:', arts.size, '| com redes:', comRedes, '| com receita:', comReceita)

const rs = (await db.doc('artistas/rock-salles').get()).data() ?? {}
console.log('\n=== Rock Salles (teste do merge) ===')
console.log('tem redes? ', !!rs.redes, '| spotify:', rs.redes?.spotify?.id, '| ig: @' + (rs.redes?.instagram?.handle ?? '—'), '| tiktok: @' + (rs.redes?.tiktok?.handle ?? '—'))
console.log('tem receita?', !!rs.receitaPorPlataforma, '| streams:', rs.streams, '| totalBRL: R$', Number(rs.totalBRL ?? 0).toFixed(2))
console.log('netPorMoeda:', rs.totais?.netPorMoeda)

const cad = await db.collection('cadastros').orderBy('criadoEm', 'desc').limit(1).get()
console.log('\n=== cadastros (histórico) ===', cad.size, 'doc(s)')
if (cad.size) {
  const c = cad.docs[0].data()
  console.log('totais:', c.totais, '| por:', c.criadoPorEmail)
}

console.log('\n=== amostra de outros artistas ===')
for (const slug of ['neto-brito', 'donas-do-bar', 'jotaerrenavoz']) {
  const d = (await db.doc('artistas/' + slug).get()).data()
  console.log(`${slug}:`, d ? `spotify=${d.redes?.spotify?.id ?? '—'}  ig=@${d.redes?.instagram?.handle ?? '—'}  tiktok=@${d.redes?.tiktok?.handle ?? '—'}` : 'NÃO EXISTE')
}
process.exit(0)

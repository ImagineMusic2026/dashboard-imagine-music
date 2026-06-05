import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const snap = await db.collection('importacoes').orderBy('criadoEm', 'desc').get()
console.log('TOTAL de docs em importacoes:', snap.size, '\n')

snap.forEach((d) => {
  const x = d.data()
  const ts = x.criadoEm?.toDate ? x.criadoEm.toDate().toISOString() : '(sem timestamp)'
  console.log(`id=${d.id}`)
  console.log(`   arquivo : ${x.arquivoNome}`)
  console.log(`   artista : ${x.artistaNome}  | streams: ${x.streams} | linhas: ${x.linhas} | R$ ${Number(x.totalBRL).toFixed(2)}`)
  console.log(`   criado  : ${ts}  por ${x.criadoPorEmail}`)
  console.log('')
})

// Detecta possíveis duplicatas (mesmo arquivo + mesmo artista + mesmos streams)
const mapa = new Map()
snap.forEach((d) => {
  const x = d.data()
  const chave = `${x.arquivoNome}|${x.artistaSlug}|${x.streams}`
  if (!mapa.has(chave)) mapa.set(chave, [])
  mapa.get(chave).push(d.id)
})
console.log('=== Análise de duplicatas ===')
let achou = false
for (const [chave, ids] of Array.from(mapa)) {
  if (ids.length > 1) {
    achou = true
    console.log(`DUPLICADO (${ids.length}x): ${chave}`)
    console.log('   ids:', ids.join(', '))
  }
}
if (!achou) console.log('Nenhuma duplicata — cada importação é de um arquivo/conteúdo distinto.')

const art = await db.doc('artistas/rock-salles').get()
console.log('\nartistas/rock-salles -> ultimaImportacaoId:', art.data()?.ultimaImportacaoId)
process.exit(0)

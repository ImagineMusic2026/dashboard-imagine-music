/**
 * Pré-resolve os títulos das faixas (ISRC → título via Deezer) e popula o cache
 * `catalogo-faixas`, pra a "Análise de faixas" mostrar os nomes na hora. Idempotente
 * (pula o que já está no cache). Gentil com o rate limit do Deezer.
 *   node scripts/prewarm-titulos.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const PISO = 100 // só faixas com algum volume (as que de fato aparecem)
const CONC = 6
const SLEEP = 500

async function deezer(isrc) {
  try {
    const res = await fetch(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`)
    if (!res.ok) return null
    const j = await res.json()
    if (!j || j.error || !j.id || !j.title) return null
    return { titulo: j.title, link: j.link || `https://www.deezer.com/track/${j.id}`, releaseDate: j.release_date || null }
  } catch {
    return null
  }
}

const metr = await db.collection('metricas-sociais').get()
const isrcs = new Set()
for (const d of metr.docs) {
  const det = await d.ref.collection('streaming-detalhe').doc('atual').get()
  if (det.exists) for (const f of det.data().porFaixa || []) if ((f.streams ?? 0) >= PISO) isrcs.add(f.isrc)
}
console.log('ISRCs únicos (>= ' + PISO + ' streams):', isrcs.size)

const todos = [...isrcs]
const faltando = []
for (let i = 0; i < todos.length; i += 300) {
  const refs = todos.slice(i, i + 300).map((x) => db.doc(`catalogo-faixas/${x}`))
  const snaps = await db.getAll(...refs)
  snaps.forEach((s, k) => {
    if (!s.exists) faltando.push(todos[i + k])
  })
}
console.log('faltando resolver:', faltando.length)

const agora = new Date().toISOString()
let ok = 0
let nf = 0
for (let i = 0; i < faltando.length; i += CONC) {
  const lote = faltando.slice(i, i + CONC)
  const res = await Promise.all(lote.map((isrc) => deezer(isrc).then((r) => ({ isrc, r }))))
  const batch = db.batch()
  for (const { isrc, r } of res) {
    if (r) {
      ok++
      batch.set(db.doc(`catalogo-faixas/${isrc}`), { isrc, titulo: r.titulo, link: r.link, releaseDate: r.releaseDate, fonte: 'deezer', atualizadoEm: agora })
    } else {
      nf++
      batch.set(db.doc(`catalogo-faixas/${isrc}`), { isrc, titulo: null, link: null, releaseDate: null, naoEncontrado: true, fonte: 'deezer', atualizadoEm: agora })
    }
  }
  await batch.commit()
  process.stdout.write(`\r  ${Math.min(i + CONC, faltando.length)}/${faltando.length} (ok ${ok}, n/e ${nf})`)
  await new Promise((r) => setTimeout(r, SLEEP))
}
console.log(`\nfeito. resolvidos: ${ok} | não encontrados: ${nf}`)
process.exit(0)

/**
 * Atribui cada faixa de `catalogo-faixas` ao artista do roster, gravando
 * `artistaSlug` no doc. É o que faz o catálogo virar "os fonogramas DESTE
 * artista" no perfil — sem isso o catálogo é uma lista solta de ISRCs.
 *
 *   node scripts/atribuir-fonogramas.mjs [--dry]
 *
 * Como atribui: o campo `artista` do doc (performers do CSV da OneRPM, ex.:
 * "Netto Brito, Fulano") vira slug e passa pelos MESMOS aliases do streaming
 * (`ALIAS_ARTISTA`), porque o catálogo usa a grafia do feed, não a do roster.
 * Só grava quando o slug existe em `artistas` — performer convidado de fora do
 * roster não inventa artista.
 *
 * Uma faixa pode ter mais de um performer do roster (feat entre artistas da
 * casa): guardamos TODOS em `artistaSlugs` e o primeiro em `artistaSlug`, que é
 * o campo que a consulta do perfil usa (`array-contains` seria índice novo; a
 * consulta simples cobre o caso comum e o feat aparece pelo array quando
 * precisarmos).
 *
 * Idempotente — rode de novo quando chegar catálogo novo da OneRPM.
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const dry = process.argv.includes('--dry')

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

/* Espelha src/lib/onerpm/aggregate.ts e trends-aliases.ts — script roda fora do bundle. */
const semAcento = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const slugify = (nome) =>
  semAcento(nome)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const ALIAS_ARTISTA = {
  'netto-brito': 'neto-brito',
  'herisson-rocha': 'herison-rocha',
  'fillipe-aladin': 'filipe-aladim',
  'willian-dicastro': 'william-dicastro',
  'kleiton-bacelar': 'kleiton-barcelar',
  'danniel-vieira': 'daniel-vieira',
}
const resolverSlug = (slug) => ALIAS_ARTISTA[slug] ?? slug

/* ── roster ────────────────────────────────────────────────────────────────── */

const rosterSnap = await db.collection('artistas').get()
const roster = new Set(rosterSnap.docs.map((d) => d.id))
console.log(`roster: ${roster.size} artistas`)

/* ── catálogo ──────────────────────────────────────────────────────────────── */

const snap = await db.collection('catalogo-faixas').get()
console.log(`catálogo: ${snap.size} faixas`)

let comArtista = 0
let atribuidas = 0
let semPerformer = 0
let foraDoRoster = 0
const naoCasaram = new Map()
const jaAtribuidos = new Set()
const porArtista = new Map()
const paraGravar = []

for (const doc of snap.docs) {
  const d = doc.data()
  const bruto = (d.artista ?? '').trim()
  if (!bruto) {
    semPerformer++
    continue
  }
  comArtista++

  const slugs = []
  for (const nome of bruto.split(',')) {
    const s = resolverSlug(slugify(nome))
    if (!s) continue
    if (roster.has(s)) {
      if (!slugs.includes(s)) slugs.push(s)
    } else {
      naoCasaram.set(s, (naoCasaram.get(s) ?? 0) + 1)
    }
  }

  if (!slugs.length) {
    foraDoRoster++
    continue
  }
  atribuidas++
  for (const s of slugs) porArtista.set(s, (porArtista.get(s) ?? 0) + 1)

  // Já está como queremos: não reescreve (economiza escrita e `atualizadoEm`).
  const igual =
    d.artistaSlug === slugs[0] &&
    Array.isArray(d.artistaSlugs) &&
    d.artistaSlugs.length === slugs.length &&
    slugs.every((s, i) => d.artistaSlugs[i] === s)
  if (!igual)
    paraGravar.push({
      ref: doc.ref,
      artistaSlug: slugs[0],
      artistaSlugs: slugs,
      atribuicao: 'catalogo',
    })
  jaAtribuidos.add(doc.id)
}

/* ── passo 2: o que o streaming já atribuiu ────────────────────────────────── */

/**
 * O CSV da OneRPM veio incompleto: 2 em cada 3 docs do catálogo não têm
 * performer (são os resolvidos pelo Deezer, que não traz artista). Mas o sync de
 * streaming JÁ sabe de quem é cada ISRC — ele grava `porFaixa` dentro de
 * `metricas-sociais/{slug}`. Então o que o catálogo não atribuiu, o streaming
 * atribui: mesma faixa, fonte diferente, e o doc guarda qual foi (`atribuicao`)
 * pra tela poder ser honesta sobre a procedência.
 */
const semSlug = new Set(
  snap.docs.filter((d) => !jaAtribuidos.has(d.id) && !d.data().artistaSlug).map((d) => d.id),
)
let porStreaming = 0
const artistasPorStreaming = new Set()

for (const slug of roster) {
  if (!semSlug.size) break
  const det = await db.doc(`metricas-sociais/${slug}/streaming-detalhe/atual`).get()
  if (!det.exists) continue
  for (const f of det.data()?.porFaixa ?? []) {
    const isrc = (f?.isrc ?? '').toUpperCase()
    if (!semSlug.has(isrc)) continue
    semSlug.delete(isrc)
    porStreaming++
    artistasPorStreaming.add(slug)
    paraGravar.push({
      ref: db.doc(`catalogo-faixas/${isrc}`),
      artistaSlug: slug,
      artistaSlugs: [slug],
      atribuicao: 'streaming',
    })
    porArtista.set(slug, (porArtista.get(slug) ?? 0) + 1)
  }
}

console.log(
  `\npelo streaming: +${porStreaming} faixas em ${artistasPorStreaming.size} artistas | ainda sem dono: ${semSlug.size}`,
)

console.log(
  `com performer: ${comArtista} | atribuídas: ${atribuidas} | sem performer: ${semPerformer} | performer fora do roster: ${foraDoRoster}`,
)
console.log(`artistas com fonograma: ${porArtista.size} | docs a gravar: ${paraGravar.length}`)

const top = [...porArtista.entries()].sort((a, b) => b[1] - a[1])
console.log('\ntop 10 por nº de faixas:')
for (const [slug, n] of top.slice(0, 10)) console.log(`  ${String(n).padStart(4)}  ${slug}`)

const orfaos = [...naoCasaram.entries()].sort((a, b) => b[1] - a[1])
if (orfaos.length) {
  console.log(`\nperformers que NÃO casaram com o roster (${orfaos.length}) — top 20:`)
  for (const [slug, n] of orfaos.slice(0, 20)) console.log(`  ${String(n).padStart(4)}  ${slug}`)
  console.log('  (feat/convidado é normal; nome do roster com grafia diferente vira alias)')
}

/* ── gravação ──────────────────────────────────────────────────────────────── */

if (dry) {
  console.log('\n--dry: nada gravado.')
  process.exit(0)
}

let gravadas = 0
for (let i = 0; i < paraGravar.length; i += 400) {
  const lote = db.batch()
  for (const { ref, artistaSlug, artistaSlugs, atribuicao } of paraGravar.slice(i, i + 400)) {
    lote.set(ref, { artistaSlug, artistaSlugs, atribuicao }, { merge: true })
  }
  await lote.commit()
  gravadas += Math.min(400, paraGravar.length - i)
  console.log(`  gravadas ${gravadas}/${paraGravar.length}`)
}
console.log('\npronto.')
process.exit(0)

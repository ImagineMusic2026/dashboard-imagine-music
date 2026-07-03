/**
 * Importa o catálogo OFICIAL da OneRPM (CSV único, enviado por eles quando o
 * catálogo muda) pra coleção `catalogo-faixas` — vira a fonte primária de
 * ISRC → título/álbum/artista/lançamento. O `link` do Deezer já cacheado é
 * PRESERVADO (o catálogo da OneRPM não tem link); docs `naoEncontrado` do
 * Deezer são substituídos. Idempotente — rode de novo quando chegar arquivo novo.
 *
 *   node scripts/importar-catalogo-onerpm.mjs [caminho.csv] [--dry]
 *
 * Default: data/catalog_imagine_music.csv. `--dry` só analisa, não grava.
 *
 * Particularidades do arquivo (conferidas no envio de 2026-07-03):
 *  - linhas SEM ISRC (conteúdo antigo/sem distribuição) não casam com o
 *    streaming — são ignoradas;
 *  - o mesmo ISRC repete em álbuns/UPCs diferentes (relançamentos) — dedup
 *    prefere linhas COM UPC e o título majoritário (ex.: BKU822500021 tem uma
 *    linha órfã "Pela Última Vez" sem UPC; o título real é "Mulher Gelada");
 *  - alguns títulos vêm em Unicode decomposto (NFD) — normalizamos pra NFC.
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const caminho = args.find((a) => !a.startsWith('--')) ?? 'data/catalog_imagine_music.csv'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

/* ── parse ─────────────────────────────────────────────────────────────────── */

/** Parser CSV mínimo com suporte a aspas (o arquivo usa vírgula dentro de campos). */
function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n') {
      row.push(cur.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur.length || row.length) {
    row.push(cur.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

const limpo = (s) => (s ?? '').trim().normalize('NFC')

/** Extrai os performers de um campo de artistas ("Fulano (performer), Beltrano (writer)"). */
function performers(campo) {
  const out = []
  for (const m of (campo ?? '').matchAll(/([^,()]+?)\s*\(performer\)/g)) out.push(limpo(m[1]))
  return out
}

const rows = parseCSV(readFileSync(caminho, 'utf8'))
const header = rows[0].map((h) => h.replace(/"/g, ''))
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
for (const col of ['track_title', 'isrc', 'album_title', 'upc', 'release_date', 'album_artists', 'track_artists']) {
  if (!(col in idx)) {
    console.error(`Coluna "${col}" não encontrada no CSV — o formato mudou? Header: ${header.join(', ')}`)
    process.exit(1)
  }
}

const dados = rows.slice(1).filter((r) => r.length > 1)
let semIsrc = 0
const porIsrc = new Map() // isrc -> ocorrências
for (const r of dados) {
  // Uppercase obrigatório: o CSV real mistura caixa no MESMO ISRC ("BKu822500019"
  // vs "BKU822500019") e todo o pipeline de consumo usa maiúsculas (trends-parse).
  const isrc = limpo(r[idx.isrc]).toUpperCase()
  if (!isrc) {
    semIsrc++
    continue
  }
  if (!/^[A-Za-z0-9]{12}$/.test(isrc)) {
    console.warn(`ISRC com formato inesperado ignorado: "${isrc}"`)
    continue
  }
  const occ = {
    titulo: limpo(r[idx.track_title]),
    album: limpo(r[idx.album_title]),
    upc: limpo(r[idx.upc]),
    release: limpo(r[idx.release_date]),
    performers: [...performers(r[idx.album_artists]), ...performers(r[idx.track_artists])],
  }
  if (!porIsrc.has(isrc)) porIsrc.set(isrc, [])
  porIsrc.get(isrc).push(occ)
}

/* ── dedup por ISRC ────────────────────────────────────────────────────────── */

/**
 * O mesmo ISRC pode repetir (relançamento em outro álbum/UPC). Preferimos linhas
 * COM UPC (as sem UPC são rascunho/pré-distribuição) e o título majoritário;
 * empate decide pelo lançamento mais recente. A data guardada é a PRIMEIRA
 * (lançamento original), o álbum/UPC vêm da ocorrência vencedora mais recente.
 */
function consolidar(occs) {
  const cands = occs.some((o) => o.upc) ? occs.filter((o) => o.upc) : occs
  const grupos = new Map()
  for (const o of cands) {
    if (!grupos.has(o.titulo)) grupos.set(o.titulo, [])
    grupos.get(o.titulo).push(o)
  }
  const vencedor = [...grupos.values()].sort(
    (a, b) =>
      b.length - a.length ||
      maxRelease(b).localeCompare(maxRelease(a)),
  )[0]
  const top = [...vencedor].sort((a, b) => (b.release || '').localeCompare(a.release || ''))[0]
  const artistas = [...new Set(occs.flatMap((o) => o.performers))]
  const releaseMin = occs.map((o) => o.release).filter(Boolean).sort()[0] ?? null
  return {
    titulo: top.titulo || null,
    album: top.album || null,
    upc: top.upc || null,
    releaseDate: releaseMin,
    artista: artistas.length ? artistas.join(', ') : null,
    divergente: grupos.size > 1,
  }
}
const maxRelease = (occs) => occs.map((o) => o.release || '').sort().at(-1) ?? ''

const faixas = new Map()
let divergentes = 0
for (const [isrc, occs] of porIsrc) {
  const f = consolidar(occs)
  if (f.divergente) {
    divergentes++
    console.log(`  título divergente em ${isrc} → fiquei com "${f.titulo}"`)
  }
  faixas.set(isrc, f)
}

console.log(`linhas: ${dados.length} | sem ISRC (ignoradas): ${semIsrc} | ISRCs únicos: ${faixas.size} | títulos divergentes: ${divergentes}`)

/* ── merge com o cache existente + gravação ────────────────────────────────── */

const isrcs = [...faixas.keys()]
const agora = new Date().toISOString()
const stats = { novos: 0, comLink: 0, eramNaoEncontrado: 0, tituloPreservado: 0 }

/** Monta o doc final (consolidado do CSV + o que deve sobreviver do doc antigo). */
function montarDoc(isrc, f, prev, st) {
  if (!prev) st.novos++
  if (prev?.naoEncontrado) st.eramNaoEncontrado++
  // Linha futura com track_title vazio não pode anular um título já resolvido.
  let titulo = f.titulo
  if (!titulo && prev?.titulo) {
    titulo = prev.titulo
    st.tituloPreservado++
  }
  const link = prev?.link ?? null
  if (link) st.comLink++
  return {
    isrc,
    titulo: titulo ?? null,
    link,
    releaseDate: f.releaseDate,
    album: f.album,
    upc: f.upc,
    artista: f.artista,
    fonte: 'onerpm',
    atualizadoEm: agora,
  }
}

const somaStats = (st) => {
  for (const k of Object.keys(stats)) stats[k] += st[k]
}

if (dry) {
  for (let i = 0; i < isrcs.length; i += 300) {
    const lote = isrcs.slice(i, i + 300)
    const snaps = await db.getAll(...lote.map((x) => db.doc(`catalogo-faixas/${x}`)))
    const st = { novos: 0, comLink: 0, eramNaoEncontrado: 0, tituloPreservado: 0 }
    snaps.forEach((s, k) => montarDoc(lote[k], faixas.get(lote[k]), s.exists ? s.data() : undefined, st))
    somaStats(st)
  }
} else {
  // Leitura e escrita DENTRO de uma transação por lote: se a rota /api/faixas/
  // titulos resolver um ISRC via Deezer no meio do import, a transação re-executa
  // com a leitura fresca e o link recém-cacheado não é perdido.
  for (let i = 0; i < isrcs.length; i += 200) {
    const lote = isrcs.slice(i, i + 200)
    const st = await db.runTransaction(async (t) => {
      const snaps = await t.getAll(...lote.map((x) => db.doc(`catalogo-faixas/${x}`)))
      const s0 = { novos: 0, comLink: 0, eramNaoEncontrado: 0, tituloPreservado: 0 }
      snaps.forEach((s, k) => {
        const isrc = lote[k]
        t.set(db.doc(`catalogo-faixas/${isrc}`), montarDoc(isrc, faixas.get(isrc), s.exists ? s.data() : undefined, s0))
      })
      return s0
    })
    somaStats(st)
    process.stdout.write(`\r  gravados ${Math.min(i + 200, isrcs.length)}/${isrcs.length}`)
  }
  process.stdout.write('\n')
}

console.log(
  `${dry ? 'a gravar' : 'gravados'}: ${isrcs.length} (novos: ${stats.novos}, já tinham doc: ${isrcs.length - stats.novos}, ` +
    `link Deezer preservado: ${stats.comLink}, eram "não encontrado" no Deezer: ${stats.eramNaoEncontrado}` +
    (stats.tituloPreservado ? `, títulos vazios no CSV mantidos do doc antigo: ${stats.tituloPreservado}` : '') +
    ')',
)
if (dry) console.log('--dry: nada gravado.')

/* ── cobertura: quanto do streaming real o catálogo dá nome? ───────────────── */

const metr = await db.collection('metricas-sociais').get()
const porIsrcStreaming = new Map() // isrc -> { streams, slugs }
for (const d of metr.docs) {
  const det = await d.ref.collection('streaming-detalhe').doc('atual').get()
  if (!det.exists) continue
  for (const f of det.data().porFaixa || []) {
    let e = porIsrcStreaming.get(f.isrc)
    if (!e) {
      e = { streams: 0, slugs: new Set() }
      porIsrcStreaming.set(f.isrc, e)
    }
    e.streams += f.streams ?? 0
    e.slugs.add(d.id)
  }
}
// Fora do catálogo pode ainda ter título do Deezer — consulta os docs que faltam.
const foraDoCatalogo = [...porIsrcStreaming.keys()].filter((i) => !faixas.has(i))
const cont = { catalogo: [0, 0], deezer: [0, 0], nada: [0, 0] } // [isrcs, streams]
for (const [isrc, e] of porIsrcStreaming) {
  if (faixas.has(isrc)) {
    cont.catalogo[0]++
    cont.catalogo[1] += e.streams
  }
}
const descobertos = []
for (let i = 0; i < foraDoCatalogo.length; i += 300) {
  const refs = foraDoCatalogo.slice(i, i + 300).map((x) => db.doc(`catalogo-faixas/${x}`))
  const snaps = await db.getAll(...refs)
  snaps.forEach((s, k) => {
    const isrc = foraDoCatalogo[i + k]
    const e = porIsrcStreaming.get(isrc)
    if (s.exists && s.data().titulo) {
      cont.deezer[0]++
      cont.deezer[1] += e.streams
    } else {
      cont.nada[0]++
      cont.nada[1] += e.streams
      descobertos.push({ isrc, streams: e.streams, slugs: [...e.slugs] })
    }
  })
}
const totStreams = cont.catalogo[1] + cont.deezer[1] + cont.nada[1]
const pct = (n) => (totStreams ? ((100 * n) / totStreams).toFixed(1) : '0') + '% dos streams'
console.log(`cobertura do streaming (${porIsrcStreaming.size} ISRCs com plays na janela):`)
console.log(`  catálogo OneRPM: ${cont.catalogo[0]} ISRCs · ${pct(cont.catalogo[1])}`)
console.log(`  só Deezer:       ${cont.deezer[0]} ISRCs · ${pct(cont.deezer[1])}`)
console.log(`  sem título:      ${cont.nada[0]} ISRCs · ${pct(cont.nada[1])}`)
if (descobertos.length) {
  descobertos.sort((a, b) => b.streams - a.streams)
  console.log('maiores sem título:')
  for (const d of descobertos.slice(0, 10))
    console.log(`  ${d.isrc}  ${d.streams} streams  (${d.slugs.join(', ')})`)
}
process.exit(0)

/**
 * Diagnóstico READ-ONLY: cruza o roster do painel com a Soundcharts.
 *
 * Serve pra responder uma pergunta que só aparece quando as faixas de corte da
 * metodologia v1.2 chegarem: elas separam o roster de verdade, ou jogam quase
 * todo mundo no mesmo balde? Ter o retrato da Soundcharts pronto faz essa
 * conferência ser de minutos.
 *
 * ⚠️ O `careerStage` da Soundcharts é calibrado em escala GLOBAL. O roster é
 * regional brasileiro, e a metodologia da cliente pesa airplay em 20% justamente
 * porque rádio importa nesse mercado. Divergência entre o IGE e o careerStage é
 * ESPERADA — isto é referência de mercado, não gabarito.
 *
 *   node scripts/check-soundcharts-roster.mjs [saida.csv] [--dias=365]
 *
 * Lê SOUNDCHARTS_CLIENT_ID/_SECRET/_TEAM do .env.local. Não escreve no Firestore.
 * Gasta ~4 requisições por artista da cota mensal do time.
 *
 * ⚠️ `get_artist_radio_spins` usa 30 dias quando não recebe `startDate`, o que
 * esconde quase todo o airplay deste roster (6 artistas em 30 dias vs 15 em 12
 * meses). Por isso o default aqui é 365.
 */
import admin from 'firebase-admin'
import { readFileSync, writeFileSync } from 'node:fs'

const CONCORRENCIA = 3
const args = process.argv.slice(2)
const saidaCsv = args.find((x) => !x.startsWith('--')) ?? null
const DIAS = Number(args.find((x) => x.startsWith('--dias='))?.split('=')[1] ?? 365)
const INICIO_AIRPLAY = new Date(Date.now() - DIAS * 86_400_000).toISOString().slice(0, 10)

/* ── credenciais ───────────────────────────────────────────────────────────── */

function carregarEnv() {
  let texto
  try {
    texto = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    console.error('✗ Não encontrei .env.local na raiz do projeto.')
    process.exit(1)
  }
  const env = {}
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i < 0) continue
    let v = l.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[l.slice(0, i).trim()] = v
  }
  return env
}

const env = carregarEnv()
if (!env.SOUNDCHARTS_CLIENT_ID || !env.SOUNDCHARTS_CLIENT_SECRET) {
  console.error('✗ Faltando SOUNDCHARTS_CLIENT_ID / SOUNDCHARTS_CLIENT_SECRET no .env.local')
  process.exit(1)
}

const corpoToken = new URLSearchParams({ grant_type: 'client_credentials' })
if (env.SOUNDCHARTS_TEAM) corpoToken.set('team_id', env.SOUNDCHARTS_TEAM)
const rt = await fetch('https://account.soundcharts.com/oauth/token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${env.SOUNDCHARTS_CLIENT_ID}:${env.SOUNDCHARTS_CLIENT_SECRET}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: corpoToken,
})
const jt = await rt.json().catch(() => ({}))
if (!rt.ok || !jt.access_token) {
  console.error(`✗ token negado (HTTP ${rt.status}): ${jt.error ?? ''} ${jt.error_description ?? ''}`)
  process.exit(1)
}
const token = jt.access_token

/* ── sessão MCP ────────────────────────────────────────────────────────────── */

let sessao = null
let gastos = 0

async function corpoDe(r) {
  const t = await r.text()
  if (!t.trim()) return null
  if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
    const d = t
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
    return d.length ? JSON.parse(d[d.length - 1]) : null
  }
  return JSON.parse(t)
}

let proximoId = 1
async function chamar(metodo, params) {
  const h = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
    'MCP-Protocol-Version': '2025-06-18',
  }
  if (sessao) h['Mcp-Session-Id'] = sessao
  const r = await fetch('https://mcp.soundcharts.com/mcp', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ jsonrpc: '2.0', id: proximoId++, method: metodo, params }),
  })
  const n = r.headers.get('mcp-session-id')
  if (n) sessao = n
  if (!r.ok) return { erro: `HTTP ${r.status}` }
  const j = await corpoDe(r)
  return j?.error ? { erro: JSON.stringify(j.error).slice(0, 200) } : (j?.result ?? null)
}

/** Chama uma ferramenta e devolve o JSON que ela embrulha em content[].text. */
async function ferramenta(nome, args) {
  gastos++
  const res = await chamar('tools/call', { name: nome, arguments: args })
  if (res?.erro) return { erro: res.erro }
  const txt = (res?.content ?? []).map((c) => c.text ?? '').join('\n')
  try {
    return JSON.parse(txt)
  } catch {
    return { erro: 'resposta não-JSON' }
  }
}

await chamar('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'painel-imagine', version: '0.1.0' },
})
await chamar('notifications/initialized', {})

/* ── roster ────────────────────────────────────────────────────────────────── */

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const snap = await db.collection('artistas').get()
const roster = snap.docs
  .map((d) => {
    const x = d.data()
    return { slug: d.id, nome: x.nome ?? x.nomeArtistico ?? d.id, spotify: x.redes?.spotify?.id ?? null }
  })
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

console.log(`roster: ${roster.length} artistas (${roster.filter((a) => a.spotify).length} com id do Spotify)\n`)

/* ── coleta ────────────────────────────────────────────────────────────────── */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

async function levantar(a) {
  // 1. identidade. O id do Spotify do cadastro resolve pro artista CERTO; casar
  //    por nome é chute (há 4.538 "Glauco!" na base deles). `resolve_url` devolve
  //    o id no campo `entityId`, não `artistId`.
  let artistId = null
  let via = ''
  if (a.spotify) {
    const r = await ferramenta('resolve_url', { url: `https://open.spotify.com/artist/${a.spotify}` })
    if (r?.type === 'artist' && r?.entityId) {
      artistId = r.entityId
      via = 'spotify'
    }
  }

  // 2. o careerStage só existe no `search_artist` — o `get_artist` não traz.
  //    Com o id já resolvido, procuramos o item que bate; sem id, o primeiro
  //    resultado é o melhor palpite disponível (e fica marcado como tal).
  const busca = await ferramenta('search_artist', { query: a.nome, limit: 20 })
  const itens = Array.isArray(busca?.items) ? busca.items : []
  const achados = busca?.page?.total ?? itens.length
  const casado = artistId ? itens.find((i) => i.artistId === artistId) : itens[0]
  if (!artistId && casado?.artistId) {
    artistId = casado.artistId
    via = achados > 1 ? `nome (${achados} resultados)` : 'nome'
  }
  if (!artistId) return { ...a, erro: 'não encontrado na Soundcharts' }

  // 3. audiência somada das plataformas sociais
  const stats = await ferramenta('get_artist_stats', { artistId })
  // 4. airplay: execuções somadas por emissora
  const radio = await ferramenta('get_artist_radio_spins', { artistId, startDate: INICIO_AIRPLAY, limit: 50 })

  const social = Array.isArray(stats?.social) ? stats.social : []
  const porPlataforma = Object.fromEntries(social.map((s) => [s.platform, num(s.value)]))
  const spins = Array.isArray(radio?.items) ? radio.items.reduce((t, i) => t + num(i.spins), 0) : 0

  return {
    ...a,
    artistId,
    via,
    careerStage: casado?.careerStage ?? '',
    pais: casado?.countryCode ?? '',
    generos: (casado?.genreNames ?? []).join('/'),
    spotifySeg: porPlataforma.spotify ?? 0,
    youtubeSeg: porPlataforma.youtube ?? 0,
    tiktokSeg: porPlataforma.tiktok ?? 0,
    instagramSeg: porPlataforma.instagram ?? 0,
    audienciaTotal: social.reduce((t, s) => t + num(s.value), 0),
    spins,
    emissoras: Array.isArray(radio?.items) ? radio.items.length : 0,
  }
}

const linhas = []
for (let i = 0; i < roster.length; i += CONCORRENCIA) {
  const lote = roster.slice(i, i + CONCORRENCIA)
  linhas.push(...(await Promise.all(lote.map(levantar))))
  process.stdout.write(`\r  consultados ${Math.min(i + CONCORRENCIA, roster.length)}/${roster.length}`)
}
process.stdout.write('\n\n')

/* ── saída ─────────────────────────────────────────────────────────────────── */

const ok = linhas.filter((l) => !l.erro)
const falhas = linhas.filter((l) => l.erro)
const mil = (n) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n))

ok.sort((a, b) => b.audienciaTotal - a.audienciaTotal)
console.log('ARTISTA'.padEnd(26) + 'ESTÁGIO'.padEnd(14) + 'AUDIÊNCIA'.padStart(10) + 'SPINS'.padStart(8) + '  EMISSORAS')
console.log('─'.repeat(74))
for (const l of ok) {
  console.log(
    l.nome.slice(0, 25).padEnd(26) +
      (l.careerStage || '—').padEnd(14) +
      mil(l.audienciaTotal).padStart(10) +
      String(l.spins).padStart(8) +
      String(l.emissoras).padStart(11),
  )
}

const dist = {}
for (const l of ok) dist[l.careerStage || '(vazio)'] = (dist[l.careerStage || '(vazio)'] ?? 0) + 1
console.log('\nDISTRIBUIÇÃO POR ESTÁGIO (referência de mercado, escala global):')
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(3)} artistas  ${'█'.repeat(v)}`)
}

const comAirplay = ok.filter((l) => l.spins > 0)
console.log(`\nAIRPLAY em ${DIAS} dias (desde ${INICIO_AIRPLAY}): ${comAirplay.length}/${ok.length} artistas com execução de rádio.`)
if (comAirplay.length) {
  const top = [...comAirplay].sort((a, b) => b.spins - a.spins).slice(0, 5)
  console.log('  maiores: ' + top.map((l) => `${l.nome} (${l.spins})`).join(', '))
}

if (falhas.length) {
  console.log(`\nNÃO ENCONTRADOS (${falhas.length}):`)
  for (const l of falhas) console.log(`  ${l.slug}${l.spotify ? '' : '  (sem id do Spotify no cadastro)'}`)
}

const porSpotify = ok.filter((l) => l.via === 'spotify')
const porNome = ok.filter((l) => l.via.startsWith('nome'))
console.log(`\nCONFIANÇA: ${porSpotify.length} resolvidos pelo id do Spotify (certo), ${porNome.length} casados por nome (palpite).`)
const duvidosos = porNome.filter((l) => /\(\d+ resultados\)/.test(l.via))
if (duvidosos.length) {
  console.log('  ⚠ nome ambíguo, NÃO usar sem conferir: ' + duvidosos.map((l) => `${l.nome} ${l.via.replace('nome ', '')}`).join(', '))
}
const semCareerStage = ok.filter((l) => !l.careerStage)
if (semCareerStage.length) console.log(`  ${semCareerStage.length} sem careerStage na base da Soundcharts.`)

console.log(`\n~${gastos} requisições gastas da cota mensal do time.`)

if (saidaCsv) {
  const cols = [
    'slug', 'nome', 'artistId', 'via', 'careerStage', 'pais', 'generos',
    'audienciaTotal', 'spotifySeg', 'youtubeSeg', 'tiktokSeg', 'instagramSeg', 'spins', 'emissoras', 'erro',
  ]
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(','))].join('\n')
  writeFileSync(saidaCsv, csv, 'utf8')
  console.log(`csv: ${saidaCsv}`)
}

process.exit(0)

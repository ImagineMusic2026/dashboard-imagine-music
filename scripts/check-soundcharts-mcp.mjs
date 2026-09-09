/**
 * Diagnóstico READ-ONLY do MCP da Soundcharts. Não escreve nada no Firestore.
 *
 * Prova (ou derruba) a premissa da integração: dá pra consultar a Soundcharts
 * do SERVIDOR, sem navegador e sem ninguém logado, no clique do botão de
 * diagnóstico — que é como a cliente pediu que funcione. O caminho é OAuth
 * `client_credentials` (máquina a máquina) contra `mcp.soundcharts.com`.
 *
 * Lê do .env.local (na raiz):
 *   SOUNDCHARTS_CLIENT_ID       do console de developers da Soundcharts
 *   SOUNDCHARTS_CLIENT_SECRET   idem
 *   SOUNDCHARTS_TEAM            nome ou ID do time (o token sai sem acesso sem isso)
 *
 * Uso:  node scripts/check-soundcharts-mcp.mjs ["Nome do Artista"]
 *
 * 🔒 Nunca imprime o secret nem o token (só o tamanho e a validade, pra
 * confirmar que foram preenchidos).
 */
import { readFileSync } from 'node:fs'

const MCP = 'https://mcp.soundcharts.com/mcp'
const TOKEN_URL = 'https://account.soundcharts.com/oauth/token'
const PROTOCOLO = '2025-06-18'

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
    const linha = bruta.trim()
    if (!linha || linha.startsWith('#')) continue
    const i = linha.indexOf('=')
    if (i < 0) continue
    const k = linha.slice(0, i).trim()
    let v = linha.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const env = carregarEnv()
const clientId = env.SOUNDCHARTS_CLIENT_ID
const clientSecret = env.SOUNDCHARTS_CLIENT_SECRET
const team = env.SOUNDCHARTS_TEAM
const artista = process.argv[2] || ''

const faltando = []
if (!clientId) faltando.push('SOUNDCHARTS_CLIENT_ID')
if (!clientSecret) faltando.push('SOUNDCHARTS_CLIENT_SECRET')
if (faltando.length) {
  console.error('✗ Faltando (vazio) no .env.local: ' + faltando.join(', '))
  process.exit(1)
}
if (!team) console.warn('⚠ SOUNDCHARTS_TEAM vazio — o token pode sair sem os acessos do plano.')

/* ── 1. token (client_credentials: máquina a máquina, ninguém precisa logar) ── */

console.log('1. pedindo token...')
const corpo = new URLSearchParams({ grant_type: 'client_credentials' })
if (team) corpo.set('team_id', team)

const rt = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: corpo,
})
const jt = await rt.json().catch(() => ({}))
if (!rt.ok || !jt.access_token) {
  console.error(`✗ token negado (HTTP ${rt.status}): ${jt.error ?? ''} ${jt.error_description ?? ''}`)
  if (jt.error === 'invalid_client') console.error('  → confira client_id/secret; se acabou de gerar, pode levar alguns minutos.')
  if (jt.error === 'invalid_scope') console.error('  → o plano provavelmente não inclui os escopos de MCP.')
  process.exit(1)
}
const token = jt.access_token
console.log(
  `   ok · token de ${token.length} caracteres · vale ${Math.round((jt.expires_in ?? 0) / 86400)} dias` +
    ` · escopos: ${jt.scope || '(não informado)'}`,
)

/* ── 2. sessão MCP ──────────────────────────────────────────────────────────── */

let sessao = null

/** O transporte Streamable HTTP responde JSON puro OU SSE — os dois viram objeto aqui. */
async function corpoDe(resposta) {
  const texto = await resposta.text()
  if (!texto.trim()) return null
  if ((resposta.headers.get('content-type') || '').includes('text/event-stream')) {
    const dados = texto
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
    return dados.length ? JSON.parse(dados[dados.length - 1]) : null
  }
  return JSON.parse(texto)
}

async function chamar(metodo, params, id) {
  const cabecalhos = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
    'MCP-Protocol-Version': PROTOCOLO,
  }
  if (sessao) cabecalhos['Mcp-Session-Id'] = sessao
  const r = await fetch(MCP, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(
      id === undefined ? { jsonrpc: '2.0', method: metodo, params } : { jsonrpc: '2.0', id, method: metodo, params },
    ),
  })
  const nova = r.headers.get('mcp-session-id')
  if (nova) sessao = nova
  if (!r.ok) {
    console.error(`✗ ${metodo} → HTTP ${r.status} ${r.headers.get('www-authenticate') ?? ''}`)
    console.error('  ' + (await r.text()).slice(0, 300))
    process.exit(1)
  }
  const json = await corpoDe(r)
  if (json?.error) {
    console.error(`✗ ${metodo} → erro MCP: ${JSON.stringify(json.error).slice(0, 300)}`)
    process.exit(1)
  }
  return json?.result ?? null
}

console.log('2. abrindo sessão MCP...')
const init = await chamar(
  'initialize',
  { protocolVersion: PROTOCOLO, capabilities: {}, clientInfo: { name: 'painel-imagine', version: '0.1.0' } },
  1,
)
console.log(`   ok · servidor: ${init?.serverInfo?.name ?? '?'} ${init?.serverInfo?.version ?? ''}`)
await chamar('notifications/initialized', {})

/* ── 3. o que dá pra pedir ──────────────────────────────────────────────────── */

console.log('3. listando ferramentas...')
const ferramentas = (await chamar('tools/list', {}, 2))?.tools ?? []
console.log(`   ${ferramentas.length} ferramentas`)
for (const f of ferramentas) console.log(`   - ${f.name}: ${(f.description ?? '').slice(0, 90)}`)

/* ── 4. consulta real: o que o botão de diagnóstico faria ───────────────────── */

if (artista) {
  const busca = ferramentas.find((f) => /search/i.test(f.name) && /artist/i.test(f.name))
  if (!busca) {
    console.log('4. nenhuma ferramenta de busca de artista na lista acima — ver os nomes reais.')
  } else {
    console.log(`4. buscando "${artista}" com ${busca.name}...`)
    const chave = Object.keys(busca.inputSchema?.properties ?? { term: 1 })[0]
    const res = await chamar('tools/call', { name: busca.name, arguments: { [chave]: artista } }, 3)
    const txt = (res?.content ?? []).map((c) => c.text ?? '').join('\n')
    console.log(txt.slice(0, 2000) || JSON.stringify(res).slice(0, 2000))
  }
} else {
  console.log('4. (passe um nome de artista como argumento pra fazer uma consulta real)')
}

console.log('\n✓ o painel consegue consultar a Soundcharts pelo servidor, sob demanda.')

/**
 * Diagnóstico READ-ONLY do token do Meta (Instagram). Não escreve nada.
 *
 * Lê META_APP_ID/SECRET/TOKEN do .env.local (na raiz), valida o token e lista as
 * contas de Instagram que ele enxerga — exatamente o que a descoberta vai casar
 * com os artistas. Útil pra isolar "o lado do Meta está certo?" antes da UI.
 *
 * Uso:  node scripts/check-meta.mjs
 *
 * 🔒 Nunca imprime o token nem o App Secret (só o tamanho, pra confirmar que
 * foram preenchidos). Os @ e IDs das contas NÃO são segredo.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

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
const appId = env.META_APP_ID
const appSecret = env.META_APP_SECRET
const token = env.META_SYSTEM_USER_TOKEN
const version = env.META_GRAPH_VERSION || 'v23.0'

const faltando = []
if (!appId) faltando.push('META_APP_ID')
if (!appSecret) faltando.push('META_APP_SECRET')
if (!token) faltando.push('META_SYSTEM_USER_TOKEN')
if (faltando.length) {
  console.error('✗ Faltando (vazio) no .env.local: ' + faltando.join(', '))
  process.exit(1)
}

const base = `https://graph.facebook.com/${version}`
const proof = createHmac('sha256', appSecret).update(token).digest('hex')
const tam = (s) => `${s.length} chars`

async function graph(path, params = {}) {
  const url = new URL(base + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  url.searchParams.set('access_token', token)
  url.searchParams.set('appsecret_proof', proof)
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (json.error) {
    const e = json.error
    throw Object.assign(new Error(e.message || `HTTP ${res.status}`), {
      code: e.code,
      subcode: e.error_subcode,
      type: e.type,
    })
  }
  return json
}

console.log(`\nGraph ${version} · App ID (${tam(appId)}) · token (${tam(token)})\n`)

try {
  const me = await graph('/me', { fields: 'id,name' })
  console.log(`✓ Token válido. Identidade: ${me.name ?? '(sem nome)'} (id ${me.id})`)

  let params = { fields: 'id,name,instagram_business_account{id,username,name}', limit: 100 }
  const paginas = []
  for (let p = 0; p < 10; p++) {
    const resp = await graph('/me/accounts', params)
    paginas.push(...(resp.data ?? []))
    const after = resp.paging?.cursors?.after
    if (!after || !resp.paging?.next) break
    params = { ...params, after }
  }

  const comIG = paginas.filter((p) => p.instagram_business_account?.username)
  console.log(`\n✓ Páginas acessíveis pelo token: ${paginas.length}`)
  console.log(`✓ Páginas com Instagram vinculado: ${comIG.length}\n`)

  if (comIG.length === 0) {
    console.log('⚠ Nenhuma conta de Instagram encontrada. Causas mais comuns:')
    console.log('  · Páginas/contas não atribuídas ao System User (Business Settings → System Users → Add Assets).')
    console.log('  · Falta escopo no token: pages_show_list e/ou instagram_basic.')
    console.log('  · Conta IG não é Business/Creator, ou não está ligada a uma Página.')
  } else {
    console.log('Contas de Instagram visíveis (é o que a descoberta vai casar):')
    for (const p of comIG) {
      const ig = p.instagram_business_account
      console.log(`  @${ig.username}  ·  IG id ${ig.id}  ·  Página "${p.name}"`)
    }
  }

  const semIG = paginas.filter((p) => !p.instagram_business_account)
  if (semIG.length) {
    console.log(`\n(${semIG.length} página(s) sem IG vinculado: ${semIG.map((p) => p.name).join(', ')})`)
  }

  console.log('\nSe os @ acima fazem sentido, siga: Integrações → Instagram → "Descobrir contas".')
} catch (e) {
  console.error(`\n✗ Erro da Graph API: ${e.message}`)
  if (e.code != null) {
    console.error(`  code=${e.code}${e.subcode != null ? ` subcode=${e.subcode}` : ''}${e.type ? ` type=${e.type}` : ''}`)
  }
  console.error('\nDicas por código:')
  console.error('  · 190: token inválido/expirado — gere um novo System User token.')
  console.error('  · 10 / 200 / 803: falta permissão (escopo) — confira instagram_manage_insights, pages_show_list, pages_read_engagement.')
  console.error('  · 4 / 17 / 32 / 613: rate limit — espere alguns minutos e rode de novo.')
  process.exit(1)
}

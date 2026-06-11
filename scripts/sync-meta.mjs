/**
 * Dispara a sincronização das métricas do Instagram (Meta) chamando a rota
 * protegida da aplicação. Reusa toda a lógica do servidor — não duplica a
 * camada da Graph API.
 *
 * Uso:
 *   node scripts/sync-meta.mjs                      # app local (http://localhost:3000)
 *   node scripts/sync-meta.mjs --url https://seu-painel.vercel.app
 *   node scripts/sync-meta.mjs --slug maria-santos  # só um artista
 *
 * Requer a env CRON_SECRET (o MESMO valor configurado no app/Vercel).
 */

const args = process.argv.slice(2)
function arg(nome, def) {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}

const base = (arg('url', process.env.APP_URL) || 'http://localhost:3000').replace(/\/+$/, '')
const slug = arg('slug', '')

const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('✗ Defina CRON_SECRET no ambiente (o mesmo valor do app).')
  process.exit(1)
}

const url = `${base}/api/integracoes/meta/sincronizar${
  slug ? `?slug=${encodeURIComponent(slug)}` : ''
}`

console.log(`→ Sincronizando via ${url}`)
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
}).catch((e) => {
  console.error('✗ Não foi possível alcançar o app:', e.message)
  process.exit(1)
})

const data = await res.json().catch(() => null)
if (!res.ok) {
  console.error(`✗ Falha (HTTP ${res.status}):`, data?.error ?? '(sem detalhe)')
  process.exit(1)
}
console.log('✓ OK:', JSON.stringify(data, null, 2))

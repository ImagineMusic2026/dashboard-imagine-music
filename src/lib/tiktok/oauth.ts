import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getTikTokConfig, TIKTOK_AUTH_URL } from './config'

/**
 * Fluxo de autorização (Login Kit). SERVER-ONLY.
 *
 * O `state` carrega o slug do artista + para onde voltar e é ASSINADO (HMAC com
 * o Client Secret): no callback verificamos a assinatura e a validade temporal,
 * o que impede adulteração/forjamento (CSRF). Assim o callback sabe a qual
 * artista o token pertence sem confiar em parâmetro vindo do navegador.
 */

export interface EstadoOAuth {
  /** Slug do artista que está autorizando. */
  slug: string
  /** Caminho relativo para redirecionar após o callback. */
  returnTo: string
}

interface CorpoState extends EstadoOAuth {
  ts: number
  n: string
}

function assinar(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Cria um `state` assinado a partir do destino do artista. */
export function criarState(estado: EstadoOAuth): string {
  const cfg = getTikTokConfig()
  const corpo: CorpoState = { ...estado, ts: Date.now(), n: randomBytes(8).toString('hex') }
  const payload = Buffer.from(JSON.stringify(corpo)).toString('base64url')
  return `${payload}.${assinar(payload, cfg.clientSecret)}`
}

/** Verifica assinatura + validade do `state`. Retorna o destino ou null. */
export function verificarState(state: string, maxIdadeMs = 15 * 60_000): EstadoOAuth | null {
  const cfg = getTikTokConfig()
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return null

  const esperado = assinar(payload, cfg.clientSecret)
  const a = Buffer.from(sig)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const corpo = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CorpoState>
    if (typeof corpo.slug !== 'string' || typeof corpo.ts !== 'number') return null
    if (Date.now() - corpo.ts > maxIdadeMs) return null
    return {
      slug: corpo.slug,
      returnTo: typeof corpo.returnTo === 'string' && corpo.returnTo ? corpo.returnTo : '/',
    }
  } catch {
    return null
  }
}

/** Monta a URL de consentimento do TikTok para um artista. */
export function montarUrlAutorizacao(opts: {
  slug: string
  returnTo: string
  redirectUri: string
}): string {
  const cfg = getTikTokConfig()
  const url = new URL(TIKTOK_AUTH_URL)
  url.searchParams.set('client_key', cfg.clientKey)
  url.searchParams.set('scope', cfg.scopes)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('state', criarState({ slug: opts.slug, returnTo: opts.returnTo }))
  return url.toString()
}

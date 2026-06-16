import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getYouTubeOAuthConfig, YT_OAUTH_AUTH_URL } from './config'

/**
 * Fluxo de autorização do Google (camada Analytics). SERVER-ONLY.
 *
 * O `state` carrega o slug do artista + destino e é ASSINADO (HMAC com o Client
 * Secret): o callback verifica a assinatura e a validade temporal, impedindo
 * adulteração/CSRF. `access_type=offline` + `prompt=consent` garantem o refresh
 * token (que o Google só entrega na 1ª autorização com consentimento).
 */

export interface EstadoOAuth {
  slug: string
  returnTo: string
}

interface CorpoState extends EstadoOAuth {
  ts: number
  n: string
}

function assinar(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function criarState(estado: EstadoOAuth): string {
  const cfg = getYouTubeOAuthConfig()
  const corpo: CorpoState = { ...estado, ts: Date.now(), n: randomBytes(8).toString('hex') }
  const payload = Buffer.from(JSON.stringify(corpo)).toString('base64url')
  return `${payload}.${assinar(payload, cfg.clientSecret)}`
}

export function verificarState(state: string, maxIdadeMs = 15 * 60_000): EstadoOAuth | null {
  const cfg = getYouTubeOAuthConfig()
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

/** Monta a URL de consentimento do Google para um artista. */
export function montarUrlAutorizacao(opts: {
  slug: string
  returnTo: string
  redirectUri: string
}): string {
  const cfg = getYouTubeOAuthConfig()
  const url = new URL(YT_OAUTH_AUTH_URL)
  url.searchParams.set('client_id', cfg.clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', cfg.scopes)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', criarState({ slug: opts.slug, returnTo: opts.returnTo }))
  return url.toString()
}

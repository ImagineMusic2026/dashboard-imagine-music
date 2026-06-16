/**
 * Configuração da integração YouTube. SERVER-ONLY.
 *
 * Duas camadas, com credenciais independentes:
 *  - PÚBLICA (Data API v3): só uma `YOUTUBE_API_KEY`. Lê qualquer canal público
 *    (inscritos, views, vídeos, engajamento) sem autorização por artista.
 *  - PRIVADA (Analytics API): OAuth do Google por artista
 *    (`YOUTUBE_CLIENT_ID/SECRET`). Traz tempo de exibição, retenção, inscritos
 *    ganhos/perdidos etc. Só para quem conectou.
 *
 * A camada pública funciona sozinha (só com a API key); a privada é aditiva.
 *
 * ⚠️ Nunca importe de um Client Component: API key, secret e tokens são
 * server-only (sem NEXT_PUBLIC_).
 */

/** Analytics (privado) + leitura básica do canal autorizado (para casar o channelId). */
const SCOPES_DEFAULT =
  'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly'

export const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3'
export const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2'
export const YT_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const YT_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export class YouTubeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'YouTubeConfigError'
  }
}

/* ── Camada pública (Data API) ── */

/** True se a API key da Data API existe. */
export function youtubeDataConfigurado(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY)
}

/** API key da Data API. Lança se ausente. */
export function getYouTubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  if (!key) {
    throw new YouTubeConfigError('Camada pública do YouTube não configurada — defina YOUTUBE_API_KEY.')
  }
  return key
}

/* ── Camada privada (OAuth + Analytics) ── */

export interface YouTubeOAuthConfig {
  clientId: string
  clientSecret: string
  scopes: string
  redirectUri: string | null
}

/** True se as credenciais OAuth existem. */
export function youtubeOAuthConfigurado(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
}

/** Config OAuth. Lança se faltar client id/secret. */
export function getYouTubeOAuthConfig(): YouTubeOAuthConfig {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim()
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim()
  const scopes = process.env.YOUTUBE_SCOPES?.trim() || SCOPES_DEFAULT
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim() || null

  const faltando: string[] = []
  if (!clientId) faltando.push('YOUTUBE_CLIENT_ID')
  if (!clientSecret) faltando.push('YOUTUBE_CLIENT_SECRET')
  if (faltando.length) {
    throw new YouTubeConfigError(
      `Camada Analytics do YouTube não configurada — defina ${faltando.join(', ')}.`,
    )
  }
  return { clientId: clientId as string, clientSecret: clientSecret as string, scopes, redirectUri }
}

/**
 * Resolve o redirect_uri efetivo da camada OAuth: o do ambiente (preferido) ou
 * derivado da origem da requisição. Sempre igual entre /conectar e /callback.
 */
export function resolverRedirectUriYT(reqUrl: string): string {
  const cfg = getYouTubeOAuthConfig()
  if (cfg.redirectUri) return cfg.redirectUri
  const origin = new URL(reqUrl).origin
  return `${origin}/api/integracoes/youtube/callback`
}

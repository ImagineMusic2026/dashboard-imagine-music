/**
 * Configuração da integração TikTok (Login Kit + Display API). SERVER-ONLY.
 *
 * Diferente do Meta (um System User lê todas as contas), o TikTok exige que
 * CADA artista autorize via OAuth. O painel guarda, por artista, um access
 * token (~24h) + refresh token (~365d, renovado a cada uso) em
 * `tiktok-tokens/{slug}` e renova sob demanda na sincronização.
 *
 * ⚠️ Nunca importe este módulo de um Client Component: o Client Secret e os
 * tokens dão acesso às contas e só podem rodar no servidor (sem NEXT_PUBLIC_).
 */

/** Escopos da Display API: perfil + estatísticas + lista de vídeos. */
const SCOPES_DEFAULT = 'user.info.basic,user.info.profile,user.info.stats,video.list'

/** Endpoint de autorização (Login Kit) — abre a tela de consentimento do TikTok. */
export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/'
/** Base da API v2 (token + Display API). */
export const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export interface TikTokConfig {
  clientKey: string
  clientSecret: string
  /** Escopos separados por vírgula. */
  scopes: string
  /**
   * Redirect URI registrado no app do TikTok. O TikTok exige correspondência
   * EXATA. Se vazio, a rota deriva de `${origin}/api/integracoes/tiktok/callback`
   * — mas o valor derivado também precisa estar registrado no console do TikTok.
   */
  redirectUri: string | null
}

export class TikTokConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokConfigError'
  }
}

let cache: TikTokConfig | null = null

/** Lê e valida a config. Lança TikTokConfigError se faltar algo. */
export function getTikTokConfig(): TikTokConfig {
  if (cache) return cache

  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim()
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim()
  const scopes = process.env.TIKTOK_SCOPES?.trim() || SCOPES_DEFAULT
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || null

  const faltando: string[] = []
  if (!clientKey) faltando.push('TIKTOK_CLIENT_KEY')
  if (!clientSecret) faltando.push('TIKTOK_CLIENT_SECRET')
  if (faltando.length) {
    throw new TikTokConfigError(
      `Integração TikTok não configurada — defina ${faltando.join(', ')} no ambiente.`,
    )
  }

  cache = {
    clientKey: clientKey as string,
    clientSecret: clientSecret as string,
    scopes,
    redirectUri,
  }
  return cache
}

/** True se as env vars mínimas existem (não lança). Útil para status/rotas. */
export function tiktokConfigurado(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
}

/**
 * Resolve o redirect_uri efetivo: o do ambiente (preferido) ou derivado da
 * origem da requisição. Sempre o mesmo valor entre /conectar e /callback.
 */
export function resolverRedirectUri(reqUrl: string): string {
  const cfg = getTikTokConfig()
  if (cfg.redirectUri) return cfg.redirectUri
  const origin = new URL(reqUrl).origin
  return `${origin}/api/integracoes/tiktok/callback`
}

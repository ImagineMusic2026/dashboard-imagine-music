import {
  getYouTubeApiKey,
  getYouTubeOAuthConfig,
  YT_ANALYTICS_BASE,
  YT_DATA_BASE,
  YT_OAUTH_TOKEN_URL,
} from './config'

/**
 * Cliente HTTP do YouTube/Google. SERVER-ONLY.
 *
 * - Data API v3 (público): autenticado por `key=` (API key). `dataGet`.
 * - Data API v3 (autenticado): por `Authorization: Bearer` — usado no callback
 *   para `channels?mine=true`. `dataGetAuth`.
 * - Analytics API: por Bearer. `analyticsGet`.
 * - OAuth (Google): troca de `code` e renovação por `refresh_token`.
 *
 * Normaliza erros (YouTubeApiException) e repete em 429/5xx com backoff.
 */

/** Resposta dos endpoints de token do Google. */
export interface GoogleTokenResposta {
  access_token: string
  /** Validade do access token em segundos (~3600). */
  expires_in: number
  /** Só vem na 1ª troca (com access_type=offline). Não rotaciona no refresh. */
  refresh_token?: string
  scope: string
  token_type: string
}

export class YouTubeApiException extends Error {
  readonly code?: number
  readonly status?: string
  constructor(message: string, code?: number, status?: string) {
    super(message || 'Erro na API do YouTube.')
    this.name = 'YouTubeApiException'
    this.code = code
    this.status = status
  }
}

type Params = Record<string, string | number | boolean | undefined>

function espera(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface GoogleErro {
  error?: { code?: number; message?: string; status?: string }
}

/** GET genérico em uma URL Google (Data/Analytics), com retry. */
async function googleGet<T>(
  url: string,
  { bearer, tentativas = 3 }: { bearer?: string; tentativas?: number } = {},
): Promise<T> {
  let ultimaErr: unknown
  for (let i = 0; i < tentativas; i++) {
    let res: Response
    try {
      res = await fetch(url, {
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
        cache: 'no-store',
      })
    } catch (e) {
      ultimaErr = e
      await espera(500 * (i + 1))
      continue
    }

    const json = (await res.json().catch(() => ({}))) as T & GoogleErro
    if (res.ok && !json.error) return json as T

    const err = json.error ?? { message: `HTTP ${res.status}` }
    const podeRetentar = res.status === 429 || res.status >= 500
    if (podeRetentar && i < tentativas - 1) {
      ultimaErr = new YouTubeApiException(err.message ?? '', err.code, err.status)
      await espera(2000 * (i + 1))
      continue
    }
    throw new YouTubeApiException(err.message ?? `HTTP ${res.status}`, err.code, err.status)
  }
  throw ultimaErr instanceof Error ? ultimaErr : new Error('Falha ao chamar a API do YouTube.')
}

function montarUrl(base: string, path: string, params: Params): string {
  const url = new URL(`${base}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return url.toString()
}

/** GET na Data API v3 (público, via API key). */
export function dataGet<T>(path: string, params: Params = {}): Promise<T> {
  const url = montarUrl(YT_DATA_BASE, path, { ...params, key: getYouTubeApiKey() })
  return googleGet<T>(url)
}

/** GET na Data API v3 autenticado (Bearer) — ex.: `channels?mine=true`. */
export function dataGetAuth<T>(path: string, accessToken: string, params: Params = {}): Promise<T> {
  return googleGet<T>(montarUrl(YT_DATA_BASE, path, params), { bearer: accessToken })
}

/** GET na YouTube Analytics API (Bearer). */
export function analyticsGet<T>(path: string, accessToken: string, params: Params = {}): Promise<T> {
  return googleGet<T>(montarUrl(YT_ANALYTICS_BASE, path, params), { bearer: accessToken })
}

/* ───────────────────────────── OAuth ───────────────────────────── */

/** Troca o `code` do callback por tokens. */
export async function trocarCodePorToken(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResposta> {
  const cfg = getYouTubeOAuthConfig()
  return postToken({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
}

/** Renova o access token (o Google mantém o mesmo refresh token). */
export async function renovarToken(refreshToken: string): Promise<GoogleTokenResposta> {
  const cfg = getYouTubeOAuthConfig()
  return postToken({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

async function postToken(params: Record<string, string>): Promise<GoogleTokenResposta> {
  const res = await fetch(YT_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as
    | GoogleTokenResposta
    | { error: string; error_description?: string }

  if (!res.ok || 'error' in json) {
    const e = json as { error: string; error_description?: string }
    throw new YouTubeApiException(e.error_description || e.error || `HTTP ${res.status}`)
  }
  return json as GoogleTokenResposta
}

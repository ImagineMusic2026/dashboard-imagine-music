import { getTikTokConfig, TIKTOK_API_BASE } from './config'

/**
 * Cliente HTTP do TikTok (OAuth v2 + Display API). SERVER-ONLY.
 *
 * - OAuth (`/oauth/token/`): troca de `code` por tokens e renovação por
 *   `refresh_token`. Respostas são JSON plano; erro vem em `{ error,
 *   error_description }`.
 * - Display API (`/user/info/`, `/video/list/`): respostas no envelope v2
 *   `{ data, error: { code, message, log_id } }` — sucesso quando
 *   `error.code === 'ok'`. Autenticação por `Authorization: Bearer <token>`.
 * - Normaliza erros (TikTokApiException) e repete em rate-limit com backoff.
 */

/** Resposta dos endpoints de token (troca e renovação). */
export interface TikTokTokenResposta {
  access_token: string
  /** Validade do access token em segundos (~86400). */
  expires_in: number
  open_id: string
  refresh_token: string
  /** Validade do refresh token em segundos (~31536000). */
  refresh_expires_in: number
  scope: string
  token_type: string
}

export class TikTokApiException extends Error {
  readonly code?: string
  readonly logId?: string
  constructor(message: string, code?: string, logId?: string) {
    super(message || 'Erro na API do TikTok.')
    this.name = 'TikTokApiException'
    this.code = code
    this.logId = logId
  }
}

const RATE_LIMIT_CODES = new Set(['rate_limit_exceeded'])

function espera(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/* ───────────────────────────── OAuth ───────────────────────────── */

/** Troca o `code` do callback por tokens de acesso/atualização. */
export async function trocarCodePorToken(
  code: string,
  redirectUri: string,
): Promise<TikTokTokenResposta> {
  const cfg = getTikTokConfig()
  return postToken({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
}

/** Renova o access token a partir de um refresh token (que também rotaciona). */
export async function renovarToken(refreshToken: string): Promise<TikTokTokenResposta> {
  const cfg = getTikTokConfig()
  return postToken({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

async function postToken(params: Record<string, string>): Promise<TikTokTokenResposta> {
  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as
    | TikTokTokenResposta
    | { error: string; error_description?: string; log_id?: string }

  if (!res.ok || 'error' in json) {
    const e = json as { error: string; error_description?: string; log_id?: string }
    throw new TikTokApiException(
      e.error_description || e.error || `HTTP ${res.status}`,
      e.error,
      e.log_id,
    )
  }
  return json as TikTokTokenResposta
}

/* ─────────────────────────── Display API ─────────────────────────── */

type Params = Record<string, string | number | undefined>

interface EnvelopeV2<T> {
  data?: T
  error?: { code?: string; message?: string; log_id?: string }
}

/** GET na Display API (ex.: `/user/info/`). Retorna `data`. */
export async function displayGet<T>(
  path: string,
  accessToken: string,
  params: Params = {},
): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return requisitar<T>(url.toString(), accessToken, { method: 'GET' })
}

/** POST na Display API (ex.: `/video/list/`). `fields` vai na query; filtros no corpo. */
export async function displayPost<T>(
  path: string,
  accessToken: string,
  params: Params = {},
  body: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return requisitar<T>(url.toString(), accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function requisitar<T>(
  url: string,
  accessToken: string,
  init: RequestInit,
  { tentativas = 3 }: { tentativas?: number } = {},
): Promise<T> {
  let ultimaErr: unknown
  for (let i = 0; i < tentativas; i++) {
    let res: Response
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    } catch (e) {
      ultimaErr = e
      await espera(500 * (i + 1))
      continue
    }

    const json = (await res.json().catch(() => ({}))) as EnvelopeV2<T>
    const code = json.error?.code
    const ok = res.ok && (code === undefined || code === 'ok')
    if (ok) return (json.data ?? ({} as T)) as T

    const erro = new TikTokApiException(
      json.error?.message || `HTTP ${res.status}`,
      code,
      json.error?.log_id,
    )
    const podeRetentar = (code != null && RATE_LIMIT_CODES.has(code)) || res.status === 429
    if (podeRetentar && i < tentativas - 1) {
      ultimaErr = erro
      await espera(2000 * (i + 1))
      continue
    }
    throw erro
  }
  throw ultimaErr instanceof Error ? ultimaErr : new Error('Falha ao chamar a API do TikTok.')
}

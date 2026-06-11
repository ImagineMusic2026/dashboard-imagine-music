import { createHmac } from 'node:crypto'
import { getMetaConfig } from './config'
import type { MetaApiError } from './types'

/**
 * Cliente HTTP da Graph API do Meta. SERVER-ONLY.
 *
 * - Injeta `access_token` + `appsecret_proof` (HMAC-SHA256 do token com o App
 *   Secret) em toda requisição — boa prática de segurança do Meta (e exigida se
 *   o app tiver "Require App Secret Proof" ligado).
 * - Normaliza erros (MetaApiException) e trata rate-limit com backoff.
 * - Paginação por cursor (`after`), reusando graphGet (mantém token + proof).
 */

export class MetaApiException extends Error {
  readonly code?: number
  readonly subcode?: number
  readonly fbtraceId?: string
  constructor(err: MetaApiError) {
    super(err.message || 'Erro na Graph API do Meta.')
    this.name = 'MetaApiException'
    this.code = err.code
    this.subcode = err.error_subcode
    this.fbtraceId = err.fbtrace_id
  }
}

function appSecretProof(token: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(token).digest('hex')
}

// 4: app rate limit · 17: user rate limit · 32: page rate limit · 613: custom rate limit
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])

export type GraphParams = Record<string, string | number | undefined>

/** GET em um endpoint da Graph API (path relativo, ex.: `/me/accounts`). */
export async function graphGet<T = unknown>(
  path: string,
  params: GraphParams = {},
  { tentativas = 3 }: { tentativas?: number } = {},
): Promise<T> {
  const cfg = getMetaConfig()
  const url = new URL(`${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  url.searchParams.set('access_token', cfg.token)
  url.searchParams.set('appsecret_proof', appSecretProof(cfg.token, cfg.appSecret))

  let ultimaErr: unknown
  for (let i = 0; i < tentativas; i++) {
    let res: Response
    try {
      res = await fetch(url, { cache: 'no-store' })
    } catch (e) {
      ultimaErr = e
      await espera(500 * (i + 1))
      continue
    }

    const json = (await res.json().catch(() => ({}))) as { error?: MetaApiError } & Record<
      string,
      unknown
    >
    if (res.ok && !json.error) return json as T

    const err: MetaApiError = json.error ?? { message: `HTTP ${res.status}` }
    const podeRetentar = err.code != null && RATE_LIMIT_CODES.has(err.code)
    if (podeRetentar && i < tentativas - 1) {
      ultimaErr = new MetaApiException(err)
      await espera(2000 * (i + 1))
      continue
    }
    throw new MetaApiException(err)
  }
  throw ultimaErr instanceof Error ? ultimaErr : new Error('Falha ao chamar a Graph API.')
}

interface Paginavel<T> {
  data?: T[]
  paging?: { cursors?: { after?: string }; next?: string }
}

/** GET seguindo a paginação por cursor e concatenando `data[]`. */
export async function graphGetAll<T = unknown>(
  path: string,
  params: GraphParams = {},
  { maxPaginas = 20 }: { maxPaginas?: number } = {},
): Promise<T[]> {
  const out: T[] = []
  let after: string | undefined
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const resp = await graphGet<Paginavel<T>>(path, {
      ...params,
      limit: params.limit ?? 100,
      after,
    })
    out.push(...(resp.data ?? []))
    after = resp.paging?.cursors?.after
    if (!after || !resp.paging?.next) break
  }
  return out
}

function espera(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

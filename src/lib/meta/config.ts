/**
 * Configuração da integração Meta (Graph API do Instagram). SERVER-ONLY.
 *
 * Origem do token (caminho recomendado):
 *   META_SYSTEM_USER_TOKEN — token de longa duração de um System User do
 *   Business Manager. Acessa todas as contas atribuídas ao System User e pode
 *   ser configurado para não expirar. É o encaixe para "a cliente tem acesso a
 *   todas as contas".
 *
 * Se no futuro a cliente NÃO usar Business Manager, basta trocar a forma de
 * obter o token AQUI (ex.: ler tokens por conta do Firestore). O restante da
 * integração (client/accounts/insights/rotas/UI) permanece igual.
 *
 * ⚠️ Nunca importe este módulo de um Client Component: o App Secret e o token
 * dão acesso às contas e só podem rodar no servidor (sem prefixo NEXT_PUBLIC_).
 */

const GRAPH_VERSION_DEFAULT = 'v23.0'

export interface MetaConfig {
  appId: string
  appSecret: string
  token: string
  graphVersion: string
  /** Base já com a versão, ex.: https://graph.facebook.com/v23.0 */
  baseUrl: string
}

export class MetaConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetaConfigError'
  }
}

let cache: MetaConfig | null = null

/** Lê e valida a config. Lança MetaConfigError se faltar algo. */
export function getMetaConfig(): MetaConfig {
  if (cache) return cache

  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  const token = process.env.META_SYSTEM_USER_TOKEN?.trim()
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || GRAPH_VERSION_DEFAULT

  const faltando: string[] = []
  if (!appId) faltando.push('META_APP_ID')
  if (!appSecret) faltando.push('META_APP_SECRET')
  if (!token) faltando.push('META_SYSTEM_USER_TOKEN')
  if (faltando.length) {
    throw new MetaConfigError(
      `Integração Meta não configurada — defina ${faltando.join(', ')} no ambiente.`,
    )
  }

  cache = {
    appId: appId as string,
    appSecret: appSecret as string,
    token: token as string,
    graphVersion,
    baseUrl: `https://graph.facebook.com/${graphVersion}`,
  }
  return cache
}

/** True se as env vars mínimas existem (não lança). Útil para status/rotas. */
export function metaConfigurado(): boolean {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_SYSTEM_USER_TOKEN,
  )
}

import type { RedeSocial } from './types'

/**
 * Extração de identidade a partir do LINK (ou @ cru) de cada rede social.
 * Fonte única usada tanto pela importação em lote (`parse.ts`) quanto pelo
 * cadastro manual de 1 artista — pra os dois extraírem id/handle igualzinho.
 *
 * - Spotify  -> artistId (de /artist/<id>)
 * - YouTube  -> channelId (/channel/<id>) ou @handle (/@handle, /user/<x>)
 * - Instagram/TikTok -> @handle (do link OU de um "@cru" digitado à mão)
 */

function rede(url: string, id: string | null, handle: string | null): RedeSocial {
  return { url, id, handle }
}

/** Limpa "@" inicial, barras finais e espaços de um handle. */
function limparHandle(v: string): string | null {
  const h = v.replace(/^@/, '').replace(/\/+$/, '').trim()
  return h || null
}

/** True quando o valor é um @/handle digitado à mão, não uma URL. */
function ehHandleCru(v: string): boolean {
  // "@fulano.de.tal" é handle mesmo com pontos — URL nunca começa com @.
  if (v.startsWith('@')) return !v.includes('/')
  return !v.includes('://') && !v.includes('.')
}

export function extrairSpotify(input: string): RedeSocial | null {
  const url = (input ?? '').trim()
  if (!url) return null
  const m = url.match(/\/artist\/([A-Za-z0-9]+)/)
  return rede(url, m ? m[1] : null, null)
}

export function extrairYoutube(input: string): RedeSocial | null {
  const url = (input ?? '').trim()
  if (!url) return null
  if (ehHandleCru(url)) return rede(url, null, limparHandle(url))
  const ch = url.match(/\/channel\/([^/?#\s]+)/)
  if (ch) return rede(url, ch[1], null)
  const at = url.match(/\/@([^/?#\s]+)/)
  if (at) return rede(url, null, at[1])
  const user = url.match(/\/user\/([^/?#\s]+)/)
  if (user) return rede(url, null, user[1])
  return rede(url, null, null)
}

function extrairPorDominio(input: string, dominio: RegExp): RedeSocial | null {
  const v = (input ?? '').trim()
  if (!v) return null
  if (ehHandleCru(v)) return rede(v, null, limparHandle(v))
  const m = v.match(dominio)
  if (!m) return rede(v, null, null)
  return rede(v, null, limparHandle(m[1]))
}

export function extrairInstagram(input: string): RedeSocial | null {
  return extrairPorDominio(input, /instagram\.com\/@?([^/?#\s]+)/i)
}

export function extrairTiktok(input: string): RedeSocial | null {
  return extrairPorDominio(input, /tiktok\.com\/@?([^/?#\s]+)/i)
}

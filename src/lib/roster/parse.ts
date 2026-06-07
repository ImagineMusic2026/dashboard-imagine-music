import * as XLSX from 'xlsx'
import { slugify } from '../onerpm/aggregate'
import type { RedeSocial, RosterArtist, RosterParseResult } from './types'

/**
 * Leitura do XLSX de cadastro de artistas (⚠️ só servidor — usa `xlsx`).
 * Mapeia as colunas pelo cabeçalho (robusto a reordenação) e extrai
 * id/handle de cada link.
 */

export class RosterParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RosterParseError'
  }
}

function limpa(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function extrairSpotify(url: string): RedeSocial | null {
  if (!url) return null
  const m = url.match(/\/artist\/([A-Za-z0-9]+)/)
  return { url, id: m ? m[1] : null, handle: null }
}

function extrairYoutube(url: string): RedeSocial | null {
  if (!url) return null
  const ch = url.match(/\/channel\/([^/?#\s]+)/)
  if (ch) return { url, id: ch[1], handle: null }
  const at = url.match(/\/@([^/?#\s]+)/)
  if (at) return { url, id: null, handle: at[1] }
  const user = url.match(/\/user\/([^/?#\s]+)/)
  if (user) return { url, id: null, handle: user[1] }
  return { url, id: null, handle: null }
}

function extrairHandle(url: string, dominio: RegExp): RedeSocial | null {
  if (!url) return null
  const m = url.match(dominio)
  if (!m) return { url, id: null, handle: null }
  const h = m[1].replace(/^@/, '').replace(/\/+$/, '').trim()
  return { url, id: null, handle: h || null }
}

export function lerRoster(buf: Buffer | ArrayBuffer | Uint8Array): RosterParseResult {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    throw new RosterParseError('Não consegui abrir o arquivo. Confirme que é um .xlsx válido.')
  }

  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) throw new RosterParseError('A planilha está vazia.')

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][]
  if (!rows.length) throw new RosterParseError('A planilha não tem dados.')

  // Acha a linha de cabeçalho (a que menciona "spotify").
  let headerIdx = rows.findIndex((r) => r.some((c) => /spotify/i.test(limpa(c))))
  if (headerIdx < 0) headerIdx = 0
  const header = rows[headerIdx].map((c) => limpa(c).toLowerCase())

  const col = (nome: string) => header.findIndex((h) => h.includes(nome))
  const cSpotify = col('spotify')
  const cYoutube = col('youtube')
  const cInstagram = col('instagram')
  const cTiktok = col('tiktok')
  if (cSpotify < 0 && cYoutube < 0 && cInstagram < 0 && cTiktok < 0) {
    throw new RosterParseError(
      'Não encontrei colunas de redes (Spotify/YouTube/Instagram/TikTok). Confira o arquivo.'
    )
  }

  // Coluna do nome = a primeira que não é de plataforma (normalmente a 0).
  const plataformaCols = new Set([cSpotify, cYoutube, cInstagram, cTiktok])
  let cNome = header.findIndex((_, i) => !plataformaCols.has(i))
  if (cNome < 0) cNome = 0

  const artistas: RosterArtist[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const nome = limpa(r[cNome])
    if (!nome) continue

    const spotify = cSpotify >= 0 ? extrairSpotify(limpa(r[cSpotify])) : null
    const youtube = cYoutube >= 0 ? extrairYoutube(limpa(r[cYoutube])) : null
    const instagram = cInstagram >= 0 ? extrairHandle(limpa(r[cInstagram]), /instagram\.com\/@?([^/?#\s]+)/i) : null
    const tiktok = cTiktok >= 0 ? extrairHandle(limpa(r[cTiktok]), /tiktok\.com\/@?([^/?#\s]+)/i) : null

    const avisos: string[] = []
    if (spotify && spotify.url && !spotify.id) {
      avisos.push('Link do Spotify não é de artista (provável álbum) — sem ID.')
    }

    artistas.push({ nome, slug: slugify(nome), spotify, youtube, instagram, tiktok, avisos })
  }

  if (!artistas.length) throw new RosterParseError('Nenhum artista encontrado na planilha.')

  const totais = {
    total: artistas.length,
    comSpotifyId: artistas.filter((a) => a.spotify?.id).length,
    comYoutube: artistas.filter((a) => a.youtube?.url).length,
    comInstagram: artistas.filter((a) => a.instagram?.url).length,
    comTiktok: artistas.filter((a) => a.tiktok?.url).length,
  }

  const avisos: string[] = []
  const semSpotifyId = artistas.filter((a) => a.spotify && a.spotify.url && !a.spotify.id).map((a) => a.nome)
  if (semSpotifyId.length) {
    avisos.push(
      `${semSpotifyId.length} link(s) de Spotify sem ID de artista (provável álbum): ` +
        `${semSpotifyId.slice(0, 8).join(', ')}${semSpotifyId.length > 8 ? '…' : ''}.`
    )
  }

  const slugCount = new Map<string, number>()
  for (const a of artistas) slugCount.set(a.slug, (slugCount.get(a.slug) ?? 0) + 1)
  const dupSlugs = Array.from(slugCount.entries())
    .filter(([, n]) => n > 1)
    .map(([s]) => s)
  if (dupSlugs.length) {
    avisos.push(`Nomes que geram o mesmo slug (vão se sobrepor): ${dupSlugs.join(', ')}.`)
  }

  return { artistas, totais, avisos }
}

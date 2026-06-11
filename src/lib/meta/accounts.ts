import { graphGetAll } from './client'
import type { ContaIG } from './types'

/**
 * Descoberta e mapeamento de contas do Instagram. SERVER-ONLY.
 *
 * As contas são descobertas pelas Páginas administradas pelo token
 * (/me/accounts). Cada Página profissional pode ter uma conta IG vinculada
 * (instagram_business_account). Isso evita depender do @handle digitado para
 * achar o IG User ID — o ID vem direto do Meta.
 */

interface PaginaRaw {
  id: string
  name?: string
  instagram_business_account?: { id: string; username?: string; name?: string }
}

/** Lista todas as contas IG Business/Creator acessíveis pelo token. */
export async function listarContasIG(): Promise<ContaIG[]> {
  const paginas = await graphGetAll<PaginaRaw>('/me/accounts', {
    fields: 'id,name,instagram_business_account{id,username,name}',
  })

  const contas: ContaIG[] = []
  for (const p of paginas) {
    const ig = p.instagram_business_account
    if (ig?.id && ig.username) {
      contas.push({
        id: ig.id,
        username: ig.username.toLowerCase(),
        nome: ig.name,
        pageId: p.id,
        pageNome: p.name,
      })
    }
  }
  return contas
}

/** Normaliza um handle (@user, URL do Instagram, etc.) para um username puro. */
export function normalizarHandle(valor: string | null | undefined): string | null {
  if (!valor) return null
  let s = valor.trim().toLowerCase()
  const m = s.match(/instagram\.com\/([^/?#]+)/)
  if (m) s = m[1]
  s = s.replace(/^@/, '').replace(/\/+$/, '')
  return s || null
}

export interface ArtistaParaCasar {
  slug: string
  /** Handle/URL do Instagram cadastrado no artista. */
  handle: string | null
}

export interface ResultadoCasamento {
  /** Artistas que casaram com uma conta IG descoberta. */
  casados: { slug: string; conta: ContaIG }[]
  /** Slugs sem conta IG correspondente (sem handle ou sem match). */
  semConta: string[]
  /** Contas IG descobertas que não casaram com nenhum artista. */
  contasNaoUsadas: ContaIG[]
}

/** Casa as contas IG descobertas com os artistas pelo @handle do Instagram. */
export function casarContasComArtistas(
  contas: ContaIG[],
  artistas: ArtistaParaCasar[],
): ResultadoCasamento {
  const porUsername = new Map(contas.map((c) => [c.username, c]))
  const usados = new Set<string>()
  const casados: { slug: string; conta: ContaIG }[] = []
  const semConta: string[] = []

  for (const a of artistas) {
    const h = normalizarHandle(a.handle)
    const conta = h ? porUsername.get(h) : undefined
    if (conta) {
      casados.push({ slug: a.slug, conta })
      usados.add(conta.username)
    } else {
      semConta.push(a.slug)
    }
  }

  const contasNaoUsadas = contas.filter((c) => !usados.has(c.username))
  return { casados, semConta, contasNaoUsadas }
}

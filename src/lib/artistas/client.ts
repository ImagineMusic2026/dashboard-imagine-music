import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ReceitaPlataforma } from '@/types'

/**
 * Leitura client (Firestore) dos artistas REAIS — o que veio das planilhas
 * (cadastro/roster + receita da OneRPM). Substitui o mock na lista e no perfil.
 *
 * Obs: a coleção `artistas` é admin-read pelas regras (porque carrega receita),
 * então estas funções só retornam dados para admin; pros demais o getDocs falha
 * e a UI mostra um estado restrito.
 */

export interface RedeSocialDoc {
  url: string
  id: string | null
  handle: string | null
}

export interface ArtistaDoc {
  slug: string
  nome: string
  label?: string
  fonteCadastro?: string
  redes?: {
    spotify?: RedeSocialDoc | null
    youtube?: RedeSocialDoc | null
    instagram?: RedeSocialDoc | null
    tiktok?: RedeSocialDoc | null
  }
  // Receita (presente só pra quem teve import da OneRPM)
  receitaPorPlataforma?: ReceitaPlataforma[]
  totalBRL?: number
  streams?: number
  totais?: { netPorMoeda?: Record<string, number> }
  periodo?: { transactionMonths?: string[]; accountedFrom?: string | null; accountedTo?: string | null }
}

const PALETA = [
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-rose-500',
  'from-emerald-500 to-cyan-500',
  'from-blue-500 to-indigo-500',
  'from-purple-500 to-pink-500',
  'from-red-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-cyan-400 to-fuchsia-500',
]

/** Gradiente determinístico a partir do slug (mesmo artista, mesma cor sempre). */
export function corAvatarDe(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

/** Iniciais a partir do nome (1ª letra do primeiro e do último nome). */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const a = partes[0]?.[0] ?? '?'
  const b = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0]?.[1] ?? '')
  return (a + b).toUpperCase()
}

export async function listarArtistas(): Promise<ArtistaDoc[]> {
  const snap = await getDocs(collection(db, 'artistas'))
  return snap.docs
    .map((d) => ({ slug: d.id, ...(d.data() as Omit<ArtistaDoc, 'slug'>) }))
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
}

export async function getArtista(slug: string): Promise<ArtistaDoc | null> {
  const s = await getDoc(doc(db, 'artistas', slug))
  return s.exists() ? { slug: s.id, ...(s.data() as Omit<ArtistaDoc, 'slug'>) } : null
}

export function temReceita(a: ArtistaDoc): boolean {
  return !!(a.receitaPorPlataforma && a.receitaPorPlataforma.length)
}

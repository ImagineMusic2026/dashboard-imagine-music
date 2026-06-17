import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Leitura client (Firestore) dos artistas REAIS — o que veio das planilhas.
 *
 * Importante: `artistas` (cadastro/redes) é legível por QUALQUER membro ativo,
 * mas a RECEITA mora numa coleção separada `receitas` (admin-only). Por isso a
 * lista chama `listarArtistas()` pra todo mundo e `listarReceitas()` só p/ admin.
 */

export interface RedeSocialDoc {
  url: string
  id: string | null
  handle: string | null
}

export interface ArtistaDoc {
  slug: string
  nome: string
  genero?: string
  label?: string
  fonteCadastro?: string
  redes?: {
    spotify?: RedeSocialDoc | null
    youtube?: RedeSocialDoc | null
    instagram?: RedeSocialDoc | null
    tiktok?: RedeSocialDoc | null
  }
}

/** Resumo de receita (coleção `receitas`, admin-only). */
export interface ReceitaResumo {
  slug: string
  totalBRL: number
  streams: number
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

/** Mapa slug -> resumo de receita. Só admin consegue ler (regras). */
export async function listarReceitas(): Promise<Map<string, ReceitaResumo>> {
  const snap = await getDocs(collection(db, 'receitas'))
  const m = new Map<string, ReceitaResumo>()
  snap.docs.forEach((d) => {
    const x = d.data()
    m.set(d.id, { slug: d.id, totalBRL: Number(x.totalBRL ?? 0), streams: Number(x.streams ?? 0) })
  })
  return m
}

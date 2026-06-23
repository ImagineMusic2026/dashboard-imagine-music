import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * Papéis (roles) da plataforma.
 * - admin: acesso total (vê tudo, gerencia o time).
 * - marketing: acesso parcial (sem dados sensíveis de receita).
 * - artista: portal restrito — vê SOMENTE o próprio perfil (via artistaSlug).
 */
export type Role = 'admin' | 'marketing' | 'artista'

/**
 * Capacidades que o admin pode conceder/restringir POR PESSOA, sobrescrevendo o
 * padrão do papel (lógica em `@/lib/permissions`). Capacidades estruturais do
 * papel (ex.: portal do artista, ver o próprio perfil) não entram aqui.
 */
export type Capacidade = 'verReceita' | 'agenda' | 'integracoes' | 'importar'

/** Perfil do usuário armazenado em Firestore na coleção `users` (id = UID do Auth). */
export type AppUser = {
  uid: string
  email: string
  nome: string
  role: Role
  ativo: boolean
  /** Só para role 'artista': slug do artista que este login representa. */
  artistaSlug?: string
  /** Exceções de permissão por pessoa (override do padrão do papel). */
  permissoes?: Partial<Record<Capacidade, boolean>>
}

export const roleMeta: Record<Role, { label: string; classe: string; gradient: string }> = {
  admin: {
    label: 'Admin',
    classe: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    gradient: 'from-violet-500 to-purple-600',
  },
  marketing: {
    label: 'Marketing',
    classe: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    gradient: 'from-amber-500 to-orange-600',
  },
  artista: {
    label: 'Artista',
    classe: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    gradient: 'from-fuchsia-500 to-pink-600',
  },
}

const USERS = 'users'

/** Lê o perfil de um usuário pelo UID. Retorna null se ainda não existe doc. */
export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, USERS, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...(snap.data() as Omit<AppUser, 'uid'>) }
}

/** Lista todos os membros do time (ordenados por nome). */
export async function listAppUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, USERS))
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) }))
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
}

/** Altera o papel de um membro (admin/marketing). */
export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { role })
}

/** Salva o mapa de exceções de permissão de um membro (admin). */
export async function updateUserPermissoes(
  uid: string,
  permissoes: Partial<Record<Capacidade, boolean>>,
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { permissoes })
}

/**
 * Ativa ou desativa um membro de verdade.
 *
 * Não é só um flag: o servidor (Admin SDK, via `/api/membros/ativo`) desabilita a
 * credencial no Firebase Auth (bloqueia o login), derruba as sessões abertas e
 * atualiza o perfil no Firestore. Exige que quem chama seja um admin ativo.
 */
export async function setUserAtivo(uid: string, ativo: boolean): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

  const res = await fetch('/api/membros/ativo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid, ativo }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Não foi possível alterar o acesso.')
  }
}

/**
 * Remove um membro do time de forma definitiva. O servidor (Admin SDK, via
 * `/api/membros/remover`) apaga a conta no Firebase Auth (o login deixa de existir)
 * e o perfil no Firestore. Exige que quem chama seja um admin ativo.
 */
export async function removerAppUser(uid: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

  const res = await fetch('/api/membros/remover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Não foi possível remover o membro.')
  }
}

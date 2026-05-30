import { collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Papéis (roles) da plataforma.
 * - admin: acesso total (vê tudo, gerencia o time).
 * - marketing: acesso parcial (sem dados sensíveis de receita).
 */
export type Role = 'admin' | 'marketing'

/** Perfil do usuário armazenado em Firestore na coleção `users` (id = UID do Auth). */
export type AppUser = {
  uid: string
  email: string
  nome: string
  role: Role
  ativo: boolean
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

/** Ativa ou desativa um membro. */
export async function setUserAtivo(uid: string, ativo: boolean): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { ativo })
}

/** Remove um membro do time (apaga o perfil/role). */
export async function removerAppUser(uid: string): Promise<void> {
  await deleteDoc(doc(db, USERS, uid))
}

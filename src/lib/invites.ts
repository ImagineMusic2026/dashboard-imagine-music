import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Role } from '@/lib/users'

export type ConviteStatus = 'pendente' | 'aceito'

/** Convite armazenado em Firestore na coleção `convites` (id = token do link). */
export type Convite = {
  token: string
  email: string
  nome: string
  role: Role
  status: ConviteStatus
  criadoPor?: string
}

const CONVITES = 'convites'

function novoToken(): string {
  return crypto.randomUUID()
}

/** Cria um convite pendente e retorna o token para montar o link. */
export async function criarConvite(params: {
  email: string
  nome: string
  role: Role
  criadoPor: string
}): Promise<Convite> {
  const token = novoToken()
  const convite: Convite = {
    token,
    email: params.email.trim().toLowerCase(),
    nome: params.nome.trim(),
    role: params.role,
    status: 'pendente',
    criadoPor: params.criadoPor,
  }
  await setDoc(doc(db, CONVITES, token), {
    email: convite.email,
    nome: convite.nome,
    role: convite.role,
    status: convite.status,
    criadoPor: convite.criadoPor,
    criadoEm: serverTimestamp(),
  })
  return convite
}

/** Lê um convite pelo token (usado na tela de aceite, antes do login). */
export async function getConvite(token: string): Promise<Convite | null> {
  const snap = await getDoc(doc(db, CONVITES, token))
  if (!snap.exists()) return null
  return { token: snap.id, ...(snap.data() as Omit<Convite, 'token'>) }
}

/** Marca o convite como aceito (chamado pelo convidado ao concluir o cadastro). */
export async function marcarConviteAceito(token: string): Promise<void> {
  await updateDoc(doc(db, CONVITES, token), {
    status: 'aceito',
    aceitoEm: serverTimestamp(),
  })
}

/** Lista convites ainda pendentes (somente admin, por regra). */
export async function listarConvitesPendentes(): Promise<Convite[]> {
  const snap = await getDocs(query(collection(db, CONVITES), where('status', '==', 'pendente')))
  return snap.docs.map((d) => ({ token: d.id, ...(d.data() as Omit<Convite, 'token'>) }))
}

/** Remove (cancela) um convite. */
export async function deleteConvite(token: string): Promise<void> {
  await deleteDoc(doc(db, CONVITES, token))
}

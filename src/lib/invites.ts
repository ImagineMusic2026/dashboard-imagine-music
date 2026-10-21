import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CONCEDIVEIS } from '@/lib/permissions'
import type { Capacidade, Role } from '@/lib/users'

export type ConviteStatus = 'pendente' | 'aceito'

/** Convite armazenado em Firestore na coleção `convites` (id = token do link). */
export type Convite = {
  token: string
  email: string
  nome: string
  role: Role
  status: ConviteStatus
  criadoPor?: string
  /** Só para role 'artista': slug do artista que o convidado vai representar. */
  artistaSlug?: string
  /**
   * Só para role 'colaborador': as áreas marcadas no convite. O aceite copia
   * este mapa para `users/{uid}.permissoes`, e a regra confere que é igual.
   */
  permissoes?: Partial<Record<Capacidade, boolean>>
}

const CONVITES = 'convites'

/**
 * Mapa de áreas do convite de colaborador: só o que o papel pode receber, e só
 * as marcadas. `null` quando nenhuma sobra — convite assim não sai (e a regra
 * recusaria).
 */
function areasDoColaborador(
  marcadas: Partial<Record<Capacidade, boolean>> | undefined,
): Partial<Record<Capacidade, boolean>> | null {
  const areas = Object.fromEntries(
    CONCEDIVEIS.colaborador.filter((c) => marcadas?.[c]).map((c) => [c, true]),
  ) as Partial<Record<Capacidade, boolean>>
  return Object.keys(areas).length ? areas : null
}

function novoToken(): string {
  return crypto.randomUUID()
}

/** Cria um convite pendente e retorna o token para montar o link. */
export async function criarConvite(params: {
  email: string
  nome: string
  role: Role
  criadoPor: string
  /** Obrigatório quando role === 'artista': o slug do artista representado. */
  artistaSlug?: string
  /** Obrigatório quando role === 'colaborador': as áreas que ele vai acessar. */
  permissoes?: Partial<Record<Capacidade, boolean>>
}): Promise<Convite> {
  const token = novoToken()
  // artistaSlug só faz sentido (e só é gravado) para convites de artista.
  const artistaSlug =
    params.role === 'artista' ? params.artistaSlug?.trim() || undefined : undefined
  // permissoes só faz sentido (e só é gravado) para convites de colaborador.
  const permissoes = params.role === 'colaborador' ? areasDoColaborador(params.permissoes) : null
  if (params.role === 'colaborador' && !permissoes) {
    throw new Error('Marque ao menos uma área para o colaborador.')
  }
  const convite: Convite = {
    token,
    email: params.email.trim().toLowerCase(),
    nome: params.nome.trim(),
    role: params.role,
    status: 'pendente',
    criadoPor: params.criadoPor,
    ...(artistaSlug ? { artistaSlug } : {}),
    ...(permissoes ? { permissoes } : {}),
  }
  await setDoc(doc(db, CONVITES, token), {
    email: convite.email,
    nome: convite.nome,
    role: convite.role,
    status: convite.status,
    criadoPor: convite.criadoPor,
    criadoEm: serverTimestamp(),
    ...(artistaSlug ? { artistaSlug } : {}),
    ...(permissoes ? { permissoes } : {}),
  })
  return convite
}

/** Lê um convite pelo token (usado na tela de aceite, antes do login). */
export async function getConvite(token: string): Promise<Convite | null> {
  const snap = await getDoc(doc(db, CONVITES, token))
  if (!snap.exists()) return null
  return { token: snap.id, ...(snap.data() as Omit<Convite, 'token'>) }
}

/**
 * Conclui o aceite: cria o perfil do convidado e marca o convite como aceito
 * NUM LOTE SÓ (as regras exigem as duas coisas juntas).
 *
 * Eram duas escritas, e a segunda podia não acontecer — aba fechada, rede
 * caída. O convite ficava 'pendente' para sempre, e o mesmo link recriava o
 * acesso de quem o admin removesse depois.
 */
export async function aceitarConvite(convite: Convite, uid: string): Promise<void> {
  const lote = writeBatch(db)
  lote.set(doc(db, 'users', uid), {
    email: convite.email,
    nome: convite.nome,
    role: convite.role,
    ativo: true,
    conviteToken: convite.token,
    // Só para artista: amarra o login ao slug do artista (validado nas regras).
    ...(convite.artistaSlug ? { artistaSlug: convite.artistaSlug } : {}),
    // Só para colaborador: as áreas marcadas no convite. A regra exige que seja
    // exatamente o mapa do convite — o convidado não acrescenta nada.
    ...(convite.permissoes ? { permissoes: convite.permissoes } : {}),
  })
  lote.update(doc(db, CONVITES, convite.token), {
    status: 'aceito',
    aceitoEm: serverTimestamp(),
  })
  await lote.commit()
}

/**
 * Lista convites ainda pendentes. Sem filtro é só admin (por regra); com
 * `role: 'artista'` a query também passa para quem tem a permissão
 * `convidarArtistas` — a regra de `list` exige o where no role pra provar que
 * só convites de artista saem da consulta.
 */
export async function listarConvitesPendentes(opts?: { role?: Role }): Promise<Convite[]> {
  const filtros = [where('status', '==', 'pendente')]
  if (opts?.role) filtros.push(where('role', '==', opts.role))
  const snap = await getDocs(query(collection(db, CONVITES), ...filtros))
  return snap.docs.map((d) => ({ token: d.id, ...(d.data() as Omit<Convite, 'token'>) }))
}

/** Remove (cancela) um convite. */
export async function deleteConvite(token: string): Promise<void> {
  await deleteDoc(doc(db, CONVITES, token))
}

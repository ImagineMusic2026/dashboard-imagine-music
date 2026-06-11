import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Agenda de eventos (releases, shows, contratos, reuniões). Dado MANUAL da
 * equipe — não depende de integração. Coleção `agenda`; leitura/escrita pelo
 * client é liberada a staff (admin/marketing) nas regras do Firestore.
 */

export type EventoTipo = 'release' | 'show' | 'contrato' | 'reuniao'

export const eventoTipoMeta: Record<EventoTipo, { label: string; bar: string; text: string }> = {
  release: { label: 'RELEASE', bar: 'bg-violet-500', text: 'text-violet-400' },
  show: { label: 'SHOW', bar: 'bg-amber-500', text: 'text-amber-400' },
  contrato: { label: 'CONTRATO', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  reuniao: { label: 'REUNIÃO', bar: 'bg-cyan-500', text: 'text-cyan-400' },
}

export interface EventoAgenda {
  id: string
  tipo: EventoTipo
  titulo: string
  descricao?: string | null
  /** Data do evento em 'YYYY-MM-DD'. */
  data: string
  /** Artista relacionado (opcional) — slug + nome denormalizado p/ exibição. */
  artistaSlug?: string | null
  artistaNome?: string | null
  criadoPor?: string
}

export interface NovoEvento {
  tipo: EventoTipo
  titulo: string
  descricao?: string | null
  data: string
  artistaSlug?: string | null
  artistaNome?: string | null
}

const COL = 'agenda'

/** Lista todos os eventos, ordenados por data crescente. */
export async function listarEventos(): Promise<EventoAgenda[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('data', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventoAgenda, 'id'>) }))
}

export async function criarEvento(ev: NovoEvento, criadoPor: string): Promise<void> {
  await addDoc(collection(db, COL), {
    tipo: ev.tipo,
    titulo: ev.titulo.trim(),
    descricao: ev.descricao?.trim() || null,
    data: ev.data,
    artistaSlug: ev.artistaSlug || null,
    artistaNome: ev.artistaNome || null,
    criadoPor,
    criadoEm: serverTimestamp(),
  })
}

export async function atualizarEvento(id: string, ev: NovoEvento): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    tipo: ev.tipo,
    titulo: ev.titulo.trim(),
    descricao: ev.descricao?.trim() || null,
    data: ev.data,
    artistaSlug: ev.artistaSlug || null,
    artistaNome: ev.artistaNome || null,
  })
}

export async function excluirEvento(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

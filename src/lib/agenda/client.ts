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
import { memoCurta } from '@/lib/cache-leitura'

/**
 * Agenda de eventos (releases, shows, contratos, reuniões). Dado MANUAL da
 * equipe — não depende de integração. Coleção `agenda`; leitura/escrita pelo
 * client é liberada a staff (admin/marketing) nas regras do Firestore.
 */

export type EventoTipo = 'release' | 'show' | 'contrato' | 'reuniao'

export interface EventoTipoMeta {
  label: string
  bar: string
  text: string
}

export const eventoTipoMeta: Record<EventoTipo, EventoTipoMeta> = {
  release: { label: 'RELEASE', bar: 'bg-violet-500', text: 'text-violet-400' },
  show: { label: 'SHOW', bar: 'bg-amber-500', text: 'text-amber-400' },
  contrato: { label: 'CONTRATO', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  reuniao: { label: 'REUNIÃO', bar: 'bg-cyan-500', text: 'text-cyan-400' },
}

/**
 * Aparência de um tipo, com rede para o que não é um dos quatro.
 *
 * `lerEventos` faz um cast cru do que vem do Firestore — um documento criado
 * por script ou pelo console, sem `tipo` ou com um valor legado, devolvia
 * `undefined` aqui, e um `.label` em cima disso derrubava a tela INTEIRA de
 * Atividades no render (uma tela que, fora a camada da agenda, não depende
 * dela). O evento desconhecido aparece como "EVENTO", neutro.
 */
export function metaDoTipo(tipo: unknown): EventoTipoMeta {
  return (
    eventoTipoMeta[tipo as EventoTipo] ?? {
      label: 'EVENTO',
      bar: 'bg-blue-500',
      text: 'text-blue-400',
    }
  )
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

async function lerEventos(): Promise<EventoAgenda[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('data', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventoAgenda, 'id'>) }))
}

const cacheEventos = memoCurta(lerEventos)

/**
 * Todos os eventos, ordenados por data crescente.
 *
 * Cacheado como as outras varreduras de coleção do painel: desde 11/2026 a
 * agenda é lida por DUAS telas (a própria Agenda e o calendário de Atividades),
 * e sem o cache trocar de uma para a outra pagaria a coleção de novo. Toda
 * escrita daqui invalida na hora — a tela nunca mostra o que ela mesma acabou
 * de mudar.
 */
export function listarEventos(): Promise<EventoAgenda[]> {
  return cacheEventos.ler()
}

export function invalidarAgenda(): void {
  cacheEventos.invalidar()
}

/**
 * Toda escrita invalida no `finally`, inclusive quando FALHA.
 *
 * Invalidar só no caminho feliz parecia suficiente e não era: quem trata o erro
 * relê para se corrigir (o arrasto do calendário, a exclusão da lista), e sem a
 * invalidação essa releitura devolvia a promessa cacheada — a tela continuava
 * mostrando o estado velho enquanto a mensagem dizia que tinha recarregado.
 * Uma escrita que falhou é justamente quando menos se pode confiar no cache.
 */
export async function criarEvento(ev: NovoEvento, criadoPor: string): Promise<void> {
  try {
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
  } finally {
    invalidarAgenda()
  }
}

export async function atualizarEvento(id: string, ev: NovoEvento): Promise<void> {
  try {
    await updateDoc(doc(db, COL, id), {
      tipo: ev.tipo,
      titulo: ev.titulo.trim(),
      descricao: ev.descricao?.trim() || null,
      data: ev.data,
      artistaSlug: ev.artistaSlug || null,
      artistaNome: ev.artistaNome || null,
    })
  } finally {
    invalidarAgenda()
  }
}

export async function excluirEvento(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COL, id))
  } finally {
    invalidarAgenda()
  }
}

/**
 * Muda SÓ a data do evento — o que o arrasto no calendário de Atividades grava.
 *
 * É a irmã de `reprogramar` das atividades, e existe pelo mesmo motivo: o
 * arrasto mexe numa data, e reescrever o documento inteiro (título, descrição,
 * artista) a cada arrasto faria duas pessoas editando o mesmo evento se
 * atropelarem por um campo que ninguém tocou.
 */
export async function reprogramarEvento(id: string, data: string): Promise<void> {
  try {
    await updateDoc(doc(db, COL, id), { data })
  } finally {
    invalidarAgenda()
  }
}

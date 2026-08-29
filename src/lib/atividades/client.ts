import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta } from '@/lib/cache-leitura'
import { ehStaff } from '@/lib/permissions'
import { listAppUsers, type AppUser } from '@/lib/users'

/**
 * Kanban de atividades (coleção `atividades`). Dado MANUAL da equipe, no mesmo
 * molde da agenda: CRUD direto do client, com a capacidade `atividades` valendo
 * também nas regras do Firestore.
 *
 * O que o pedido quer é acompanhar o atendimento "na vertical" — do pedido até a
 * entrega — e enxergar QUEM está com cada demanda. Por isso todo card carrega as
 * mesmas três coisas: a etapa (coluna), o artista e o responsável.
 */

/**
 * Etapas do fluxo de atendimento, na ordem em que a demanda anda. São FIXAS de
 * propósito: board de coluna livre vira lista bagunçada, e só dá pra responder
 * "quanto tempo uma demanda leva do briefing à entrega" se todo mundo usar as
 * mesmas etapas.
 *
 * ⚠️ Mexer aqui muda o board inteiro. Trocar o `label` é seguro (é só o
 * vocabulário da Imagine); trocar a `key` exige migrar os docs que já estão nela.
 */
export type EtapaAtividade = 'solicitado' | 'briefing' | 'producao' | 'aprovacao' | 'concluido'

export const ETAPAS: EtapaAtividade[] = [
  'solicitado',
  'briefing',
  'producao',
  'aprovacao',
  'concluido',
]

export const etapaMeta: Record<
  EtapaAtividade,
  { label: string; bar: string; text: string; chip: string }
> = {
  solicitado: {
    label: 'Solicitado',
    bar: 'bg-ink-500',
    text: 'text-ink-300',
    chip: 'bg-bg-700 text-ink-300 border-bg-700',
  },
  briefing: {
    label: 'Briefing',
    bar: 'bg-cyan-500',
    text: 'text-cyan-400',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  producao: {
    label: 'Em produção',
    bar: 'bg-violet-500',
    text: 'text-violet-400',
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  aprovacao: {
    label: 'Aprovação',
    bar: 'bg-amber-500',
    text: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  concluido: {
    label: 'Concluído',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
}

export type Prioridade = 'baixa' | 'media' | 'alta'

export const prioridadeMeta: Record<Prioridade, { label: string; chip: string }> = {
  baixa: { label: 'Baixa', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
  media: { label: 'Média', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  alta: { label: 'Alta', chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
}

export const PRIORIDADES = Object.keys(prioridadeMeta) as Prioridade[]

/**
 * Área da equipe dona da demanda — é o "marketing está cuidando disso" do pedido.
 * Fica ao LADO do responsável, não no lugar dele: a área sobrevive à troca de
 * quem executa, e nem toda demanda nasce com dono definido.
 */
export type AreaAtividade = 'marketing' | 'conteudo' | 'comercial' | 'financeiro' | 'juridico'

export const areaMeta: Record<AreaAtividade, { label: string; chip: string }> = {
  marketing: {
    label: 'Marketing',
    chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  },
  conteudo: { label: 'Conteúdo', chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  comercial: { label: 'Comercial', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  financeiro: { label: 'Financeiro', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  juridico: { label: 'Jurídico', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
}

export const AREAS = Object.keys(areaMeta) as AreaAtividade[]

export interface Atividade {
  id: string
  titulo: string
  descricao?: string | null
  etapa: EtapaAtividade
  /** Posição dentro da coluna (crescente). Ver `ordemAoSoltar`. */
  ordem: number
  prioridade: Prioridade
  area?: AreaAtividade | null
  /** Prazo em 'YYYY-MM-DD'. */
  prazo?: string | null
  /** Artista da demanda (opcional — existe tarefa interna sem artista). */
  artistaSlug?: string | null
  artistaNome?: string | null
  /** Gestor responsável — uid + nome denormalizado p/ exibir sem ler `users`. */
  responsavelUid?: string | null
  responsavelNome?: string | null
  criadoPor?: string
  /** Quando entrou em "Concluído" (ISO) — base de "entregues no mês". */
  concluidoEm?: string | null
}

/** Campos que o formulário edita (posição e conclusão quem controla é o board). */
export interface DadosAtividade {
  titulo: string
  descricao?: string | null
  etapa: EtapaAtividade
  prioridade: Prioridade
  area?: AreaAtividade | null
  prazo?: string | null
  artistaSlug?: string | null
  artistaNome?: string | null
  responsavelUid?: string | null
  responsavelNome?: string | null
}

const COL = 'atividades'

/** Distância entre dois cards vizinhos — deixa espaço pra encaixar no meio. */
const PASSO = 1000

async function lerAtividades(): Promise<Atividade[]> {
  // Sem `orderBy` na consulta de propósito: a ordenação é composta (etapa +
  // ordem), o board já separa por coluna, e assim não exige índice composto.
  const snap = await getDocs(collection(db, COL))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Atividade, 'id'>) }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

const cacheAtividades = memoCurta(lerAtividades)

/**
 * O board inteiro. Cacheado como as outras leituras de coleção: a cota gratuita
 * do Firestore já derrubou o painel uma vez, e este é o tipo de tela que a
 * pessoa abre e reabre o dia todo. Escrever atualiza o estado local e invalida o
 * cache — mover um card NÃO relê a coleção.
 */
export function listarAtividades(): Promise<Atividade[]> {
  return cacheAtividades.ler()
}

export function invalidarAtividades(): void {
  cacheAtividades.invalidar()
}

/** Quem pode aparecer como responsável: equipe Imagine ativa. */
async function lerEquipe(): Promise<AppUser[]> {
  const todos = await listAppUsers()
  return todos.filter((u) => ehStaff(u.role) && u.ativo !== false)
}

const cacheEquipe = memoCurta(lerEquipe)

export function listarEquipe(): Promise<AppUser[]> {
  return cacheEquipe.ler()
}

function limpar(dados: DadosAtividade) {
  return {
    titulo: dados.titulo.trim(),
    descricao: dados.descricao?.trim() || null,
    etapa: dados.etapa,
    prioridade: dados.prioridade,
    area: dados.area || null,
    prazo: dados.prazo || null,
    artistaSlug: dados.artistaSlug || null,
    artistaNome: dados.artistaNome || null,
    responsavelUid: dados.responsavelUid || null,
    responsavelNome: dados.responsavelNome || null,
  }
}

/** Cria a demanda no fim da coluna escolhida. */
export async function criarAtividade(
  dados: DadosAtividade,
  criadoPor: string,
  atuais: Atividade[],
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...limpar(dados),
    ordem: ordemNoFim(atuais, dados.etapa),
    concluidoEm: dados.etapa === 'concluido' ? new Date().toISOString() : null,
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  invalidarAtividades()
  return ref.id
}

/**
 * Salva a edição. `concluidoEm` entra aqui também porque o formulário deixa
 * trocar a etapa — mudar para "Concluído" pelo formulário tem de carimbar a data
 * igualzinho a arrastar o card para a última coluna.
 */
export async function atualizarAtividade(
  id: string,
  dados: DadosAtividade,
  concluidoEm: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...limpar(dados),
    concluidoEm,
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

/** Move o card de etapa/posição (arrastar ou as setas do próprio card). */
export async function moverAtividade(
  id: string,
  etapa: EtapaAtividade,
  ordem: number,
  concluidoEm: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    etapa,
    ordem,
    concluidoEm,
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

export async function excluirAtividade(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  invalidarAtividades()
}

/** Carimbo de conclusão ao ir parar em (ou sair de) "Concluído". */
export function carimboConclusao(destino: EtapaAtividade, anterior?: string | null): string | null {
  if (destino !== 'concluido') return null
  // Reordenar dentro de "Concluído" não deve reescrever a data da entrega.
  return anterior ?? new Date().toISOString()
}

/** Cards de uma coluna, já na ordem de exibição. */
export function daEtapa(lista: Atividade[], etapa: EtapaAtividade): Atividade[] {
  return lista.filter((a) => a.etapa === etapa).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** Posição de quem entra no fim da coluna. */
export function ordemNoFim(lista: Atividade[], etapa: EtapaAtividade): number {
  const col = daEtapa(lista, etapa)
  return col.length ? (col[col.length - 1].ordem ?? 0) + PASSO : PASSO
}

/**
 * Posição de quem é solto ANTES de `alvoId`: o meio do caminho entre o card de
 * cima e o alvo. Guardar a posição como número — em vez de reescrever a coluna
 * inteira a cada arrasto — é o que mantém "mover um card" em UMA escrita.
 */
export function ordemAoSoltar(
  lista: Atividade[],
  etapa: EtapaAtividade,
  alvoId: string | null,
  movidoId: string,
): number {
  const col = daEtapa(lista, etapa).filter((a) => a.id !== movidoId)
  const noFim = () => (col.length ? (col[col.length - 1].ordem ?? 0) + PASSO : PASSO)
  if (!alvoId) return noFim()
  const i = col.findIndex((a) => a.id === alvoId)
  if (i < 0) return noFim()
  const alvo = col[i].ordem ?? 0
  const anterior = i === 0 ? alvo - 2 * PASSO : (col[i - 1].ordem ?? 0)
  return (anterior + alvo) / 2
}

/** Data local de hoje em 'YYYY-MM-DD' (sem conversão de fuso). */
export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Prazo estourado — vencido e ainda não entregue. */
export function estaAtrasada(a: Atividade): boolean {
  return !!a.prazo && a.etapa !== 'concluido' && a.prazo < hojeISO()
}

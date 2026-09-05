import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta } from '@/lib/cache-leitura'
import { ehStaff } from '@/lib/permissions'
import { listAppUsers, type AppUser } from '@/lib/users'
import {
  chavesFinais,
  primeiraEtapa,
  type ConfigQuadro,
  type Esforco,
  type Prioridade,
  type TemplateDemanda,
} from '@/lib/atividades/tipos'

/**
 * Quadro de atividades (coleção `atividades`) — dado MANUAL da equipe, no mesmo
 * molde da agenda: CRUD direto do client, com a capacidade `atividades` valendo
 * também nas regras do Firestore.
 *
 * O que o quadro precisa responder é sempre a mesma coisa em três alturas:
 * onde cada demanda está (etapa), quando ela acontece (início e prazo) e de quem
 * ela depende — pessoa e outras demandas. Por isso toda demanda carrega etapa,
 * janela de datas, responsável e dependências, e todas as visões (quadro,
 * cronograma, lista, calendário, carga) leem essa MESMA coleção. Não existe
 * "dado do gantt" separado do "dado do kanban": arrastar a barra no cronograma e
 * arrastar o card no quadro mexem no mesmo documento.
 *
 * Custo: a cota gratuita do Firestore já derrubou o painel uma vez. As duas
 * defesas são o cache curto na leitura da coleção e o fato de que TODA operação
 * de arrastar — mudar de coluna, reprogramar a barra, marcar um item do
 * checklist — escreve UM documento e não relê nada.
 */

/* -------------------------------------------------------------------------- */
/* Formato                                                                     */
/* -------------------------------------------------------------------------- */

/** Item do checklist — subtarefa leve, que não merece um card só pra ela. */
export interface ItemChecklist {
  id: string
  texto: string
  feito: boolean
}

/** Referência externa: briefing no Drive, vídeo, pasta de artes. */
export interface LinkDemanda {
  id: string
  titulo: string
  url: string
}

/** Uma linha do histórico da demanda (movimentação de etapa). */
export interface Movimento {
  em: string
  quem: string
  de: string | null
  para: string
}

export interface Atividade {
  id: string
  titulo: string
  descricao?: string | null
  /** Chave da etapa na configuração do quadro (ver `tipos.ts`). */
  etapa: string
  /** Posição dentro da coluna (crescente). Ver `ordemAoSoltar`. */
  ordem: number
  prioridade: Prioridade
  tipo?: string | null
  area?: string | null
  etiquetas?: string[]
  /** Início em 'YYYY-MM-DD' — com o prazo, forma a barra do cronograma. */
  inicio?: string | null
  /** Prazo em 'YYYY-MM-DD'. */
  prazo?: string | null
  esforco?: Esforco | null
  /**
   * Marco: data única, sem duração (o losango do cronograma). Serve pro que não
   * é trabalho e sim acontecimento — "o single sai neste dia".
   */
  marco?: boolean
  /**
   * Progresso informado à mão (0–100). Fica `null` quando a demanda tem
   * checklist ou subtarefas — nesse caso o número é CALCULADO (ver `progressoDe`),
   * porque dois lugares dizendo a mesma coisa sempre acabam discordando.
   */
  progresso?: number | null
  /** Demanda mãe — é o que transforma um card numa subtarefa (projeto). */
  paiId?: string | null
  /** Demandas que precisam terminar antes desta começar. */
  dependeDe?: string[]
  /** Artista da demanda (opcional — existe tarefa interna sem artista). */
  artistaSlug?: string | null
  artistaNome?: string | null
  /** Gestor responsável — uid + nome denormalizado p/ exibir sem ler `users`. */
  responsavelUid?: string | null
  responsavelNome?: string | null
  checklist?: ItemChecklist[]
  links?: LinkDemanda[]
  /**
   * Contador denormalizado de comentários. Existe só pro selo do card: sem ele,
   * desenhar o quadro exigiria ler a subcoleção de CADA demanda.
   */
  qtdComentarios?: number
  /** Últimas movimentações (capado — ver `LIMITE_HISTORICO`). */
  historico?: Movimento[]
  /** Quando entrou na etapa atual (ISO) — base do "parada há X dias". */
  etapaDesde?: string | null
  /** Tempo acumulado por etapa, em ms — base do tempo médio de entrega. */
  temposPorEtapa?: Record<string, number>
  criadoPor?: string
  /** Quando entrou numa etapa final (ISO) — base de "entregues no mês". */
  concluidoEm?: string | null
}

/** Campos que o formulário edita (posição e carimbos quem controla é o quadro). */
export interface DadosAtividade {
  titulo: string
  descricao?: string | null
  etapa: string
  prioridade: Prioridade
  tipo?: string | null
  area?: string | null
  etiquetas?: string[]
  inicio?: string | null
  prazo?: string | null
  esforco?: Esforco | null
  marco?: boolean
  progresso?: number | null
  paiId?: string | null
  dependeDe?: string[]
  artistaSlug?: string | null
  artistaNome?: string | null
  responsavelUid?: string | null
  responsavelNome?: string | null
  checklist?: ItemChecklist[]
  links?: LinkDemanda[]
}

const COL = 'atividades'

/** Distância entre dois cards vizinhos — deixa espaço pra encaixar no meio. */
const PASSO = 1000

/**
 * Quantas movimentações ficam guardadas na demanda.
 *
 * O histórico mora num array DENTRO do documento, não numa subcoleção: assim ele
 * chega junto com o quadro, sem nenhuma leitura extra. O preço é o documento
 * crescer, e é por isso que ele é capado — as movimentações antigas somem, mas o
 * tempo que elas representam continua somado em `temposPorEtapa`, que é o que
 * alimenta os indicadores.
 */
const LIMITE_HISTORICO = 30

/** Id curto para itens que vivem dentro do documento (checklist, links). */
export function idLocal(): string {
  return Math.random().toString(36).slice(2, 10)
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                     */
/* -------------------------------------------------------------------------- */

async function lerAtividades(): Promise<Atividade[]> {
  // Sem `orderBy` na consulta de propósito: a ordenação é composta (etapa +
  // ordem), cada visão reordena do seu jeito, e assim não exige índice composto.
  const snap = await getDocs(collection(db, COL))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Atividade, 'id'>) }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

const cacheAtividades = memoCurta(lerAtividades)

/**
 * O quadro inteiro. Cacheado como as outras leituras de coleção: a cota gratuita
 * do Firestore já derrubou o painel uma vez, e esta é a tela que a pessoa abre e
 * reabre o dia todo. Escrever atualiza o estado local e invalida o cache — mover
 * um card NÃO relê a coleção.
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

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

/** Data local de hoje em 'YYYY-MM-DD' (sem conversão de fuso). */
export function hojeISO(): string {
  return paraISO(new Date())
}

/** `Date` → 'YYYY-MM-DD' pelo calendário LOCAL (nada de `toISOString`, que é UTC). */
export function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 'YYYY-MM-DD' → `Date` ao meio-dia local.
 *
 * O meio-dia não é capricho: `new Date('2026-03-15')` é interpretado como UTC e,
 * em Brasília, volta como 14 de março às 21h. Toda conta de dias do cronograma
 * passa por aqui, então o erro apareceria como uma barra deslocada em um dia.
 */
export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso)
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

/** Diferença em dias inteiros entre duas datas 'YYYY-MM-DD' (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86_400_000)
}

/* -------------------------------------------------------------------------- */
/* Limpeza para o Firestore                                                    */
/* -------------------------------------------------------------------------- */

/**
 * O Firestore recusa `undefined`. Este é o único ponto por onde os dados do
 * formulário entram no banco, então é aqui que tudo vira valor ou `null`.
 */
function limpar(dados: DadosAtividade) {
  const checklist = (dados.checklist ?? [])
    .filter((i) => i.texto.trim())
    .map((i) => ({ id: i.id || idLocal(), texto: i.texto.trim(), feito: !!i.feito }))
  const links = (dados.links ?? [])
    .filter((l) => l.url.trim())
    .map((l) => ({ id: l.id || idLocal(), titulo: l.titulo.trim() || l.url.trim(), url: l.url.trim() }))
  return {
    titulo: dados.titulo.trim(),
    descricao: dados.descricao?.trim() || null,
    etapa: dados.etapa,
    prioridade: dados.prioridade,
    tipo: dados.tipo || null,
    area: dados.area || null,
    etiquetas: Array.from(new Set((dados.etiquetas ?? []).map((e) => e.trim()).filter(Boolean))),
    inicio: dados.inicio || null,
    prazo: dados.prazo || null,
    esforco: dados.esforco || null,
    marco: !!dados.marco,
    // Progresso manual só vale quando não há checklist: com checklist o número é
    // calculado, e guardar os dois só criaria duas verdades.
    progresso: checklist.length ? null : (dados.progresso ?? null),
    paiId: dados.paiId || null,
    dependeDe: Array.from(new Set(dados.dependeDe ?? [])),
    artistaSlug: dados.artistaSlug || null,
    artistaNome: dados.artistaNome || null,
    responsavelUid: dados.responsavelUid || null,
    responsavelNome: dados.responsavelNome || null,
    checklist,
    links,
  }
}

/* -------------------------------------------------------------------------- */
/* Escrita                                                                     */
/* -------------------------------------------------------------------------- */

/** Cria a demanda no fim da coluna escolhida. */
export async function criarAtividade(
  dados: DadosAtividade,
  criadoPor: string,
  atuais: Atividade[],
  config: ConfigQuadro,
): Promise<string> {
  const agora = new Date().toISOString()
  const ref = await addDoc(collection(db, COL), {
    ...limpar(dados),
    ordem: ordemNoFim(atuais, dados.etapa),
    concluidoEm: chavesFinais(config).has(dados.etapa) ? agora : null,
    etapaDesde: agora,
    temposPorEtapa: {},
    qtdComentarios: 0,
    historico: [],
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  invalidarAtividades()
  return ref.id
}

/**
 * Salva a edição. Os carimbos de etapa entram aqui também porque o formulário
 * deixa trocar a coluna — mudar para "Concluído" pelo formulário tem de carimbar
 * a entrega igualzinho a arrastar o card para a última coluna.
 */
export async function atualizarAtividade(
  id: string,
  dados: DadosAtividade,
  anterior: Atividade,
  config: ConfigQuadro,
  quem: string,
): Promise<void> {
  const mudouEtapa = anterior.etapa !== dados.etapa
  await updateDoc(doc(db, COL, id), {
    ...limpar(dados),
    ...(mudouEtapa ? transicao(anterior, dados.etapa, config, quem) : {}),
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

/** Move a demanda de etapa/posição (arrastar, as setas do card ou a lista). */
export async function moverAtividade(
  atividade: Atividade,
  etapa: string,
  ordem: number,
  config: ConfigQuadro,
  quem: string,
): Promise<void> {
  await updateDoc(doc(db, COL, atividade.id), {
    ordem,
    ...transicao(atividade, etapa, config, quem),
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

/**
 * Reprograma a janela da demanda — é o que o arrasto da barra do cronograma
 * grava. UMA escrita, nada de releitura: mesmo contrato do arrasto no quadro.
 */
export async function reprogramar(
  id: string,
  inicio: string | null,
  prazo: string | null,
): Promise<void> {
  await updateDoc(doc(db, COL, id), { inicio, prazo, atualizadoEm: serverTimestamp() })
  invalidarAtividades()
}

/** Grava o checklist inteiro (marcar um item é uma escrita do array). */
export async function salvarChecklist(id: string, checklist: ItemChecklist[]): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    checklist,
    // Com checklist, o progresso passa a ser calculado — o valor manual é zerado
    // pra não sobrar um número velho contradizendo os itens. Sem checklist o
    // campo nem entra no update: `undefined` é recusado pelo Firestore, e apagar
    // o progresso de quem acabou de esvaziar a lista perderia o dado à toa.
    ...(checklist.length ? { progresso: null } : {}),
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

export async function salvarLinks(id: string, links: LinkDemanda[]): Promise<void> {
  await updateDoc(doc(db, COL, id), { links, atualizadoEm: serverTimestamp() })
  invalidarAtividades()
}

/**
 * Grava as antecessoras. A demanda nunca depende de si mesma — uma seta de um
 * card para ele mesmo travaria o cálculo do caminho crítico e não significa nada.
 */
export async function salvarDependencias(id: string, dependeDe: string[]): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    dependeDe: Array.from(new Set(dependeDe.filter((d) => d !== id))),
    atualizadoEm: serverTimestamp(),
  })
  invalidarAtividades()
}

/**
 * Exclui a demanda e limpa os rastros dela nas outras: subtarefas viram
 * demandas soltas (em vez de sumirem do quadro junto com a mãe) e quem dependia
 * dela perde a dependência. Sem isso o cronograma ficaria com setas apontando
 * para o vazio e cards invisíveis presos a uma mãe que não existe mais.
 */
export async function excluirAtividade(id: string, todas: Atividade[]): Promise<void> {
  const lote = writeBatch(db)
  lote.delete(doc(db, COL, id))
  for (const a of todas) {
    if (a.id === id) continue
    if (a.paiId === id) lote.update(doc(db, COL, a.id), { paiId: null })
    if (a.dependeDe?.includes(id)) {
      lote.update(doc(db, COL, a.id), { dependeDe: a.dependeDe.filter((d) => d !== id) })
    }
  }
  await lote.commit()
  invalidarAtividades()
}

/**
 * Cria um PROJETO a partir de um modelo: uma demanda mãe e, se o modelo tiver
 * etapas, uma subtarefa por etapa já encadeada e datada.
 *
 * Tudo num `writeBatch` porque um projeto meio criado é pior que nenhum — se a
 * quinta subtarefa falhar, as quatro anteriores não podem ficar no quadro
 * fingindo que o cronograma está completo.
 *
 * Limite: um lote do Firestore aceita 500 operações. Um modelo com mais de ~490
 * etapas não existe na vida real, mas o corte está aqui por segurança.
 */
export async function criarDeModelo(
  modelo: TemplateDemanda,
  /**
   * A demanda mãe, como o FORMULÁRIO a montou.
   *
   * O modelo já pré-preencheu esses campos quando foi escolhido, mas quem manda
   * daqui em diante é o formulário: a pessoa pode ter trocado a área, subido a
   * prioridade ou escrito outro título depois de escolher o modelo, e antes
   * disto tudo isso era descartado em silêncio na hora de salvar.
   *
   * `inicio` é obrigatório porque é a âncora das datas relativas das subtarefas.
   */
  base: DadosAtividade & { inicio: string },
  criadoPor: string,
  atuais: Atividade[],
  config: ConfigQuadro,
): Promise<string> {
  const agora = new Date().toISOString()
  const etapaInicial = primeiraEtapa(config)
  const lote = writeBatch(db)
  const col = collection(db, COL)

  const comuns = {
    etapa: etapaInicial,
    prioridade: base.prioridade,
    tipo: base.tipo ?? null,
    artistaSlug: base.artistaSlug ?? null,
    artistaNome: base.artistaNome ?? null,
    responsavelUid: base.responsavelUid ?? null,
    responsavelNome: base.responsavelNome ?? null,
    concluidoEm: null,
    etapaDesde: agora,
    temposPorEtapa: {},
    qtdComentarios: 0,
    historico: [],
    links: [],
    progresso: null,
    marco: false,
    criadoPor,
    criadoEm: serverTimestamp(),
  }

  const etapas = (modelo.etapas ?? []).slice(0, 490)
  const fim = etapas.length
    ? Math.max(...etapas.map((e) => e.inicioEmDias + e.duracaoEmDias))
    : (modelo.prazoEmDias ?? 0)

  const mae = doc(col)
  lote.set(mae, {
    ...comuns,
    titulo: base.titulo.trim(),
    descricao: base.descricao?.trim() || null,
    area: base.area ?? null,
    etiquetas: Array.from(new Set(base.etiquetas ?? [])),
    inicio: base.inicio,
    // O prazo do formulário ganha do calculado: se a pessoa mexeu na data, é
    // porque ela sabe algo que o modelo não sabe.
    prazo: base.prazo || somarDias(base.inicio, fim),
    esforco: base.esforco ?? null,
    paiId: null,
    dependeDe: [],
    // A mãe não leva checklist quando o modelo virou subtarefas: o progresso
    // dela passa a ser a média dos filhos (ver `progressoDe`), e um checklist
    // por cima disso seria uma segunda contagem do mesmo trabalho.
    checklist: etapas.length
      ? []
      : (modelo.checklist ?? []).map((t) => ({ id: idLocal(), texto: t, feito: false })),
    ordem: ordemNoFim(atuais, etapaInicial),
  })

  // Os ids saem ANTES do commit (`doc(col)` gera local) — é isso que permite
  // encadear a dependência de uma subtarefa na anterior dentro do mesmo lote.
  const refs = etapas.map(() => doc(col))
  let ordem = ordemNoFim(atuais, etapaInicial)
  etapas.forEach((et, i) => {
    ordem += PASSO
    const inicio = somarDias(base.inicio, et.inicioEmDias)
    const anterior = et.dependeDoIndice
    lote.set(refs[i], {
      ...comuns,
      titulo: et.titulo,
      descricao: null,
      area: et.area ?? base.area ?? null,
      etiquetas: [],
      inicio,
      prazo: somarDias(inicio, et.duracaoEmDias),
      esforco: et.esforco ?? null,
      // Duração zero é a convenção de marco (o losango do cronograma).
      marco: et.duracaoEmDias === 0,
      paiId: mae.id,
      dependeDe:
        typeof anterior === 'number' && anterior >= 0 && anterior < refs.length && anterior !== i
          ? [refs[anterior].id]
          : [],
      checklist: [],
      ordem,
    })
  })

  await lote.commit()
  invalidarAtividades()
  return mae.id
}

/* -------------------------------------------------------------------------- */
/* Transição de etapa                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Os campos que mudam quando a demanda troca de coluna.
 *
 * Três coisas acontecem juntas, e é por estarem juntas que os indicadores
 * fecham: o tempo que a demanda passou na coluna anterior é somado, o relógio da
 * nova coluna começa, e a data de entrega é carimbada (ou apagada, quando a
 * demanda VOLTA de uma coluna final — senão ela continuaria contando como
 * entregue no mês).
 */
export function transicao(atual: Atividade, destino: string, config: ConfigQuadro, quem: string) {
  const finais = chavesFinais(config)
  const agora = new Date()
  const iso = agora.toISOString()

  const tempos = { ...(atual.temposPorEtapa ?? {}) }
  if (atual.etapaDesde && destino !== atual.etapa) {
    const decorrido = agora.getTime() - new Date(atual.etapaDesde).getTime()
    if (decorrido > 0) tempos[atual.etapa] = (tempos[atual.etapa] ?? 0) + decorrido
  }

  const historico =
    destino === atual.etapa
      ? (atual.historico ?? [])
      : [...(atual.historico ?? []), { em: iso, quem, de: atual.etapa, para: destino }].slice(
          -LIMITE_HISTORICO,
        )

  return {
    etapa: destino,
    etapaDesde: destino === atual.etapa ? (atual.etapaDesde ?? iso) : iso,
    temposPorEtapa: tempos,
    historico,
    // Reordenar DENTRO de uma coluna final não pode reescrever a data da entrega.
    concluidoEm: finais.has(destino) ? (atual.concluidoEm ?? iso) : null,
  }
}

/* -------------------------------------------------------------------------- */
/* Consultas em memória                                                        */
/* -------------------------------------------------------------------------- */

/** Cards de uma coluna, já na ordem de exibição. */
export function daEtapa(lista: Atividade[], etapa: string): Atividade[] {
  return lista.filter((a) => a.etapa === etapa).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** Posição de quem entra no fim da coluna. */
export function ordemNoFim(lista: Atividade[], etapa: string): number {
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
  etapa: string,
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

/** A demanda já saiu do fluxo? */
export function concluida(a: Atividade, config: ConfigQuadro): boolean {
  return chavesFinais(config).has(a.etapa)
}

/** Prazo estourado — vencido e ainda não entregue. */
export function estaAtrasada(a: Atividade, config: ConfigQuadro): boolean {
  return !!a.prazo && !concluida(a, config) && a.prazo < hojeISO()
}

/** Subtarefas de uma demanda, na ordem. */
export function filhosDe(lista: Atividade[], id: string): Atividade[] {
  return lista.filter((a) => a.paiId === id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** Demandas de topo — as que não são subtarefa de ninguém. */
export function raizes(lista: Atividade[]): Atividade[] {
  const ids = new Set(lista.map((a) => a.id))
  // `!ids.has(paiId)` cobre a subtarefa cuja mãe sumiu (ou foi filtrada da
  // visão): ela sobe pra raiz em vez de desaparecer da tela.
  return lista.filter((a) => !a.paiId || !ids.has(a.paiId))
}

/**
 * Progresso de 0 a 100, na ordem de confiança: subtarefas → checklist → valor
 * manual → a própria etapa.
 *
 * O último degrau existe pra demanda que ninguém detalhou: se ela está numa
 * coluna final, está 100% — não faz sentido o cronograma mostrar uma barra vazia
 * numa demanda entregue.
 */
export function progressoDe(a: Atividade, lista: Atividade[], config: ConfigQuadro): number {
  const filhos = filhosDe(lista, a.id)
  if (filhos.length) {
    const soma = filhos.reduce((t, f) => t + progressoDe(f, lista, config), 0)
    return Math.round(soma / filhos.length)
  }
  if (a.checklist?.length) {
    return Math.round((a.checklist.filter((i) => i.feito).length / a.checklist.length) * 100)
  }
  if (typeof a.progresso === 'number') return Math.min(100, Math.max(0, a.progresso))
  return concluida(a, config) ? 100 : 0
}

/** Dias parada na etapa atual — o "isso aqui travou" do quadro. */
export function diasNaEtapa(a: Atividade): number | null {
  if (!a.etapaDesde) return null
  return Math.floor((Date.now() - new Date(a.etapaDesde).getTime()) / 86_400_000)
}

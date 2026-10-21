import {
  concluida,
  deISO,
  diasEntre,
  hojeISO,
  paraISO,
  progressoDe,
  somarDias,
  type Atividade,
} from '@/lib/atividades/client'
import { areaDe, etapaDe, tipoDe, type ConfigQuadro } from '@/lib/atividades/tipos'

/**
 * A matemática do cronograma (a visão de linha do tempo).
 *
 * Tudo aqui é cálculo puro sobre a lista que o quadro já carregou — nenhuma
 * leitura, nenhum componente. É de propósito: as contas de data e de dependência
 * são as que mais erram calado, e separadas assim dá pra raciocinar sobre elas
 * sem abrir um `.tsx`.
 *
 * Convenções que valem pro arquivo inteiro:
 *
 * - Data é sempre 'YYYY-MM-DD' e vira `Date` só via `deISO` (meio-dia local),
 *   nunca `new Date(iso)` — que seria UTC e deslocaria a barra em um dia.
 * - A barra é INCLUSIVA nas duas pontas: uma demanda que começa e termina no
 *   mesmo dia ocupa um dia, não zero.
 */

/* -------------------------------------------------------------------------- */
/* Escala e eixo                                                               */
/* -------------------------------------------------------------------------- */

export type Escala = 'dia' | 'semana' | 'mes' | 'trimestre'

export const escalaMeta: Record<
  Escala,
  { label: string; larguraDia: number; marcarDia: number; descricao: string }
> = {
  // `marcarDia` é de quantos em quantos dias o cabeçalho escreve um número — o
  // que muda de fato entre os zooms é a densidade do rótulo, não o formato.
  dia: { label: 'Dias', larguraDia: 34, marcarDia: 1, descricao: 'Duas semanas na tela' },
  semana: { label: 'Semanas', larguraDia: 13, marcarDia: 7, descricao: 'Um trimestre na tela' },
  mes: { label: 'Meses', larguraDia: 5, marcarDia: 0, descricao: 'Um ano na tela' },
  trimestre: { label: 'Trimestres', larguraDia: 2, marcarDia: 0, descricao: 'Vários anos na tela' },
}

export const ESCALAS = Object.keys(escalaMeta) as Escala[]

export interface CelulaDia {
  iso: string
  left: number
  largura: number
  /** Número do dia, ou `null` quando a escala não comporta escrever. */
  rotulo: string | null
  fimDeSemana: boolean
  hoje: boolean
  /** Primeiro dia do mês — vira a linha divisória forte da grade. */
  inicioDeMes: boolean
}

export interface FaixaMes {
  chave: string
  rotulo: string
  left: number
  largura: number
}

export interface Eixo {
  inicio: string
  fim: string
  dias: number
  larguraDia: number
  largura: number
  celulas: CelulaDia[]
  meses: FaixaMes[]
  /** Posição do marcador de hoje, ou `null` se hoje está fora da janela. */
  hoje: number | null
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM-DD' → '12 set' (sem conversão de fuso). */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES_CURTOS[Number(m) - 1] ?? ''}`
}

/** 'YYYY-MM-DD' → '12 de setembro de 2026'. */
export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1] ?? ''} de ${a}`
}

/**
 * A janela que o cronograma precisa cobrir.
 *
 * Parte das datas das demandas e sempre inclui HOJE — um cronograma que não
 * mostra o dia de hoje não responde "estamos atrasados?", que é a única pergunta
 * que se faz olhando pra ele. A folga nas pontas existe pra barra não nascer
 * colada na borda e pra sobrar espaço de arrastar.
 */
/**
 * Limites da janela, em dias a partir de hoje.
 *
 * Uma data digitada errada — o ano com um dígito a mais, o clássico "2206" — não
 * pode virar um eixo de séculos: cada dia é uma célula no cabeçalho, então a
 * página tentaria desenhar centenas de milhares de nós e travaria a aba. Datas
 * fora daqui continuam GRAVADAS e visíveis no card, na lista e no calendário;
 * só não esticam o cronograma.
 */
const RECUO_MAXIMO = 5 * 365
const AVANCO_MAXIMO = 10 * 365

export function janelaDe(lista: Atividade[]): { inicio: string; fim: string } {
  const hoje = hojeISO()
  const piso = somarDias(hoje, -RECUO_MAXIMO)
  const teto = somarDias(hoje, AVANCO_MAXIMO)

  const datas: string[] = [hoje]
  for (const a of lista) {
    if (a.inicio && a.inicio >= piso && a.inicio <= teto) datas.push(a.inicio)
    if (a.prazo && a.prazo >= piso && a.prazo <= teto) datas.push(a.prazo)
  }
  datas.sort()
  return { inicio: somarDias(datas[0], -3), fim: somarDias(datas[datas.length - 1], 7) }
}

/** Monta o eixo do tempo: células de dia, faixas de mês e a marca de hoje. */
/**
 * Teto de células do eixo (~10 anos). Segunda trava, depois de `janelaDe`: esta
 * função é exportada e pode receber uma janela vinda de qualquer lugar, e o
 * corpo dela desenha um nó por dia.
 */
const DIAS_MAXIMOS = 3660

export function montarEixo(inicio: string, fim: string, escala: Escala): Eixo {
  const { larguraDia, marcarDia } = escalaMeta[escala]
  const dias = Math.min(DIAS_MAXIMOS, Math.max(1, diasEntre(inicio, fim) + 1))
  const hoje = hojeISO()

  const celulas: CelulaDia[] = []
  const meses: FaixaMes[] = []

  for (let i = 0; i < dias; i++) {
    const iso = somarDias(inicio, i)
    const d = deISO(iso)
    const diaDoMes = d.getDate()
    const dow = d.getDay()
    celulas.push({
      iso,
      left: i * larguraDia,
      largura: larguraDia,
      rotulo: marcarDia === 1 || (marcarDia > 1 && dow === 1) ? String(diaDoMes) : null,
      fimDeSemana: dow === 0 || dow === 6,
      hoje: iso === hoje,
      inicioDeMes: diaDoMes === 1,
    })

    const chave = iso.slice(0, 7)
    const ultimo = meses[meses.length - 1]
    if (ultimo?.chave === chave) {
      ultimo.largura += larguraDia
    } else {
      meses.push({
        chave,
        // Na escala mais aberta o nome inteiro não cabe na faixa de um mês.
        rotulo:
          larguraDia >= 13
            ? `${MESES[d.getMonth()]} de ${d.getFullYear()}`
            : `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        left: i * larguraDia,
        largura: larguraDia,
      })
    }
  }

  const desdeHoje = diasEntre(inicio, hoje)
  return {
    inicio,
    // O fim REAL do eixo, e não o pedido: quando o teto corta a janela, quem
    // consome (a grade, as setas, o scroll) precisa da data que de fato foi
    // desenhada, senão passa a posicionar coisa fora da área existente.
    fim: somarDias(inicio, dias - 1),
    dias,
    larguraDia,
    largura: dias * larguraDia,
    celulas,
    meses,
    // O +metade centraliza a marca no dia, em vez de encostá-la na divisória.
    hoje: desdeHoje >= 0 && desdeHoje < dias ? desdeHoje * larguraDia + larguraDia / 2 : null,
  }
}

/* -------------------------------------------------------------------------- */
/* Barras                                                                      */
/* -------------------------------------------------------------------------- */

export interface Barra {
  left: number
  largura: number
  inicio: string
  fim: string
  /** Marco: acontecimento sem duração, desenhado como losango. */
  marco: boolean
}

/**
 * A janela efetiva de uma demanda.
 *
 * Demanda sem datas não some do cronograma — ela vira um bloco de um dia em
 * torno de hoje. Sumir seria pior: a pessoa procuraria no cronograma um card que
 * ela acabou de ver no quadro e concluiria que o painel perdeu a demanda.
 * Com só uma das pontas preenchida, a outra espelha a que existe.
 */
export function janelaDaDemanda(a: Atividade): { inicio: string; fim: string } {
  const hoje = hojeISO()
  if (a.marco) {
    const dia = a.prazo ?? a.inicio ?? hoje
    return { inicio: dia, fim: dia }
  }
  const inicio = a.inicio ?? a.prazo ?? hoje
  const fim = a.prazo ?? a.inicio ?? hoje
  // Datas invertidas (prazo antes do início) desenhariam largura negativa.
  return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio }
}

export function barraDe(a: Atividade, eixo: Eixo): Barra {
  const { inicio, fim } = janelaDaDemanda(a)
  const desde = diasEntre(eixo.inicio, inicio)
  const dias = diasEntre(inicio, fim) + 1
  return {
    left: desde * eixo.larguraDia,
    largura: Math.max(eixo.larguraDia, dias * eixo.larguraDia),
    inicio,
    fim,
    marco: !!a.marco,
  }
}

/** Quantos dias a demanda ocupa (inclusivo nas duas pontas). */
export function duracaoEmDias(a: Atividade): number {
  const { inicio, fim } = janelaDaDemanda(a)
  return diasEntre(inicio, fim) + 1
}

/** Pixels → dias, pra traduzir o arrasto da barra em nova data. */
export function pixelsEmDias(px: number, eixo: Eixo): number {
  return Math.round(px / eixo.larguraDia)
}

/* -------------------------------------------------------------------------- */
/* Dependências                                                                */
/* -------------------------------------------------------------------------- */

export type TipoConflito = 'ordem' | 'ciclo' | 'ausente'

export interface Conflito {
  tipo: TipoConflito
  /** Demanda predecessora envolvida (quando existir). */
  outraId: string
  mensagem: string
}

/**
 * Problemas de dependência, demanda a demanda.
 *
 * São três, e cada um é um jeito diferente de o cronograma estar mentindo:
 *
 * - `ordem`: a antecessora termina DEPOIS que esta começa. É o conflito que
 *   importa no dia a dia — o cronograma promete uma data que a própria corrente
 *   de tarefas não sustenta.
 * - `ciclo`: A depende de B que depende de A. Nada nunca poderia começar.
 * - `ausente`: a antecessora foi excluída. A seta apontaria pro vazio.
 *
 * Antecessora já CONCLUÍDA não gera conflito de ordem: o trabalho acabou, a data
 * planejada dela virou história e travar a sucessora por isso seria um alarme
 * falso todo dia.
 */
export function conflitosDe(
  lista: Atividade[],
  config: ConfigQuadro,
  /**
   * Universo em que as antecessoras são procuradas. Por padrão é a própria
   * lista, mas as telas passam o quadro COMPLETO aqui e o recorte em `lista`.
   *
   * A separação existe porque sem ela um filtro vira um alarme falso: filtrar
   * por um artista esconde a antecessora, `porId` não a encontra, e a demanda
   * passa a acusar "depende de uma demanda que não existe mais" — quando ela
   * existe e está a um clique de distância, no filtro limpo.
   */
  universo: Atividade[] = lista,
  /**
   * `universoParcial`: o universo NÃO é o quadro inteiro (é o do colaborador,
   * que só lê as demandas dele). Aí uma antecessora fora dele é da equipe, não
   * excluída — e acusar "não existe mais" seria mentira.
   */
  opcoes: { universoParcial?: boolean } = {},
): Map<string, Conflito[]> {
  const porId = new Map(universo.map((a) => [a.id, a]))
  const emCiclo = idsEmCiclo(universo)
  const saida = new Map<string, Conflito[]>()

  for (const a of lista) {
    const problemas: Conflito[] = []
    const minha = janelaDaDemanda(a)

    for (const depId of a.dependeDe ?? []) {
      const dep = porId.get(depId)
      if (!dep) {
        if (!opcoes.universoParcial) {
          problemas.push({ tipo: 'ausente', outraId: depId, mensagem: 'Depende de uma demanda que não existe mais.' })
        }
        continue
      }
      if (emCiclo.has(a.id) && emCiclo.has(dep.id)) {
        problemas.push({
          tipo: 'ciclo',
          outraId: depId,
          mensagem: `Dependência circular com "${dep.titulo}".`,
        })
        continue
      }
      if (concluida(dep, config)) continue
      const dela = janelaDaDemanda(dep)
      if (dela.fim > minha.inicio) {
        const atraso = diasEntre(minha.inicio, dela.fim)
        problemas.push({
          tipo: 'ordem',
          outraId: depId,
          mensagem: `"${dep.titulo}" só termina ${atraso} dia${atraso === 1 ? '' : 's'} depois desta começar.`,
        })
      }
    }

    if (problemas.length) saida.set(a.id, problemas)
  }
  return saida
}

/**
 * Ids que participam de alguma dependência circular.
 *
 * Busca em profundidade com três estados (não visto / na pilha / fechado): achar
 * uma aresta que aponta pra alguém AINDA na pilha é a definição de ciclo. Sem
 * isto, `caminhoCritico` entraria em recursão infinita — e uma configuração
 * errada de dependências travaria a aba inteira em vez de mostrar um aviso.
 */
function idsEmCiclo(lista: Atividade[]): Set<string> {
  const porId = new Map(lista.map((a) => [a.id, a]))
  const estado = new Map<string, 'pilha' | 'fechado'>()
  const culpados = new Set<string>()

  const visitar = (id: string, pilha: string[]) => {
    const atual = estado.get(id)
    if (atual === 'fechado') return
    if (atual === 'pilha') {
      // Fecha o laço: tudo daqui pro topo da pilha está no ciclo.
      const desde = pilha.indexOf(id)
      pilha.slice(desde).forEach((x) => culpados.add(x))
      return
    }
    estado.set(id, 'pilha')
    pilha.push(id)
    for (const dep of porId.get(id)?.dependeDe ?? []) {
      if (porId.has(dep)) visitar(dep, pilha)
    }
    pilha.pop()
    estado.set(id, 'fechado')
  }

  for (const a of lista) visitar(a.id, [])
  return culpados
}

/**
 * O caminho crítico: a corrente de dependências mais longa em dias.
 *
 * É a resposta a "onde um dia de atraso vira um dia de atraso no projeto
 * inteiro". Cada demanda ganha o maior tempo acumulado até ela seguindo as
 * antecessoras; a de maior total é o fim do caminho, e voltar por ela desenha a
 * corrente.
 *
 * Simplificação assumida: usa a DURAÇÃO planejada de cada demanda, não folga
 * calculada como o MS Project faz (folga total = quanto uma tarefa pode
 * atrasar sem empurrar o fim). Para um cronograma de lançamento, com dezenas de
 * tarefas e não milhares, a corrente mais longa já aponta o mesmo gargalo.
 */
export function caminhoCritico(lista: Atividade[]): Set<string> {
  const porId = new Map(lista.map((a) => [a.id, a]))
  const emCiclo = idsEmCiclo(lista)
  const total = new Map<string, number>()
  const veioDe = new Map<string, string | null>()

  const calcular = (id: string): number => {
    const cache = total.get(id)
    if (cache !== undefined) return cache
    const a = porId.get(id)
    if (!a) return 0
    // Marca antes de descer pra que um ciclo remanescente não recurse eterno.
    total.set(id, 0)

    let melhor = 0
    let pai: string | null = null
    for (const dep of a.dependeDe ?? []) {
      if (!porId.has(dep) || emCiclo.has(dep)) continue
      const t = calcular(dep)
      if (t > melhor) {
        melhor = t
        pai = dep
      }
    }
    const soma = melhor + duracaoEmDias(a)
    total.set(id, soma)
    veioDe.set(id, pai)
    return soma
  }

  for (const a of lista) if (!emCiclo.has(a.id)) calcular(a.id)

  let fim: string | null = null
  let maior = 0
  for (const [id, t] of Array.from(total.entries())) {
    if (t > maior) {
      maior = t
      fim = id
    }
  }

  const caminho = new Set<string>()
  // Uma corrente de uma tarefa só não é um "caminho crítico" — é uma tarefa.
  // Destacar isso pintaria de vermelho qualquer quadro sem dependência nenhuma.
  let cursor = fim
  while (cursor) {
    caminho.add(cursor)
    cursor = veioDe.get(cursor) ?? null
  }
  return caminho.size > 1 ? caminho : new Set()
}

/**
 * Reagenda as sucessoras de uma demanda que mudou de data, preservando a folga
 * que cada uma tinha. Devolve o que PRECISA mudar — quem grava é a tela, que
 * pede confirmação antes de mexer no cronograma dos outros.
 */
export function empurrarSucessoras(
  lista: Atividade[],
  idMovido: string,
  diasDeslocados: number,
): { id: string; inicio: string | null; prazo: string | null }[] {
  if (!diasDeslocados) return []
  const mudancas: { id: string; inicio: string | null; prazo: string | null }[] = []
  const vistos = new Set<string>([idMovido])
  let fronteira = [idMovido]

  while (fronteira.length) {
    const proxima: string[] = []
    for (const a of lista) {
      if (vistos.has(a.id)) continue
      if (!(a.dependeDe ?? []).some((d) => fronteira.includes(d))) continue
      vistos.add(a.id)
      proxima.push(a.id)
      mudancas.push({
        id: a.id,
        inicio: a.inicio ? somarDias(a.inicio, diasDeslocados) : null,
        prazo: a.prazo ? somarDias(a.prazo, diasDeslocados) : null,
      })
    }
    fronteira = proxima
  }
  return mudancas
}

/* -------------------------------------------------------------------------- */
/* Linhas do cronograma e da lista                                             */
/* -------------------------------------------------------------------------- */

export type Agrupamento = 'nenhum' | 'artista' | 'responsavel' | 'area' | 'tipo' | 'etapa'

export const agrupamentoMeta: Record<Agrupamento, string> = {
  nenhum: 'Sem agrupar',
  artista: 'Por artista',
  responsavel: 'Por responsável',
  area: 'Por área',
  tipo: 'Por tipo',
  etapa: 'Por etapa',
}

export const AGRUPAMENTOS = Object.keys(agrupamentoMeta) as Agrupamento[]

export type Linha =
  | { tipo: 'grupo'; id: string; rotulo: string; quantidade: number; concluidas: number }
  | { tipo: 'demanda'; id: string; atividade: Atividade; nivel: number; temFilhos: boolean }

export interface Grupo {
  id: string
  rotulo: string
  itens: Atividade[]
}

/**
 * Reparte a lista em grupos — as raias do quadro e as seções da lista.
 *
 * Ao contrário de `montarLinhas`, aqui a subtarefa entra no grupo do PRÓPRIO
 * valor dela, não no da mãe: no quadro cada card vive na coluna da sua etapa, e
 * esconder uma subtarefa em produção dentro da raia da mãe faria a coluna mentir
 * sobre o que está em andamento.
 */
export function agruparPor(
  lista: Atividade[],
  por: Agrupamento,
  config: ConfigQuadro,
): Grupo[] {
  if (por === 'nenhum') return [{ id: '__todos__', rotulo: '', itens: lista }]

  const grupos = new Map<string, Grupo>()
  for (const a of lista) {
    const { id, rotulo } = chaveDoGrupo(a, por, config)
    const g = grupos.get(id) ?? { id, rotulo, itens: [] }
    g.itens.push(a)
    grupos.set(id, g)
  }
  return Array.from(grupos.values()).sort((a, b) => {
    // "Sem X" por último: é a caixa de sobras, não merece o topo da tela.
    if (a.id === '__sem__') return 1
    if (b.id === '__sem__') return -1
    return a.rotulo.localeCompare(b.rotulo, 'pt-BR')
  })
}

function chaveDoGrupo(a: Atividade, por: Agrupamento, config: ConfigQuadro): { id: string; rotulo: string } {
  switch (por) {
    case 'artista':
      return { id: a.artistaSlug ?? '__sem__', rotulo: a.artistaNome ?? 'Sem artista' }
    case 'responsavel':
      return { id: a.responsavelUid ?? '__sem__', rotulo: a.responsavelNome ?? 'Sem responsável' }
    case 'area':
      return { id: a.area ?? '__sem__', rotulo: areaDe(config, a.area)?.label ?? 'Sem área' }
    case 'tipo':
      return { id: a.tipo ?? '__sem__', rotulo: tipoDe(config, a.tipo)?.label ?? 'Sem tipo' }
    case 'etapa':
      return { id: a.etapa, rotulo: etapaDe(config, a.etapa)?.label ?? a.etapa }
    default:
      return { id: '__todos__', rotulo: '' }
  }
}

/**
 * Achata o quadro nas linhas que o cronograma e a lista desenham: cabeçalhos de
 * grupo, demandas mãe e subtarefas indentadas.
 *
 * Duas regras que evitam buraco na tela:
 *
 * 1. Subtarefa é desenhada DENTRO da mãe, não como linha solta. Se a mãe caiu
 *    fora do filtro, a subtarefa sobe a um nível raiz (via `raizes`) em vez de
 *    sumir.
 * 2. Ao agrupar, a subtarefa acompanha a MÃE, mesmo que o valor dela seja outro
 *    (uma subtarefa de área "conteúdo" dentro de um projeto de "marketing" fica
 *    sob marketing). Espalhar os filhos por grupos diferentes desmontaria a
 *    própria noção de projeto.
 */
export function montarLinhas(
  lista: Atividade[],
  config: ConfigQuadro,
  opcoes: { agrupamento: Agrupamento; recolhidos: Set<string> },
): Linha[] {
  const { agrupamento, recolhidos } = opcoes
  const ids = new Set(lista.map((a) => a.id))
  const filhosPor = new Map<string, Atividade[]>()
  const topo: Atividade[] = []

  for (const a of lista) {
    if (a.paiId && ids.has(a.paiId)) {
      const atual = filhosPor.get(a.paiId) ?? []
      atual.push(a)
      filhosPor.set(a.paiId, atual)
    } else {
      topo.push(a)
    }
  }
  filhosPor.forEach((filhos) => filhos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))

  const linhas: Linha[] = []

  const empilhar = (a: Atividade, nivel: number) => {
    const filhos = filhosPor.get(a.id) ?? []
    linhas.push({ tipo: 'demanda', id: a.id, atividade: a, nivel, temFilhos: filhos.length > 0 })
    if (recolhidos.has(a.id)) return
    for (const f of filhos) empilhar(f, nivel + 1)
  }

  if (agrupamento === 'nenhum') {
    for (const a of topo) empilhar(a, 0)
    return linhas
  }

  const grupos = new Map<string, { rotulo: string; itens: Atividade[] }>()
  for (const a of topo) {
    const { id, rotulo } = chaveDoGrupo(a, agrupamento, config)
    const g = grupos.get(id) ?? { rotulo, itens: [] }
    g.itens.push(a)
    grupos.set(id, g)
  }

  const finais = new Set(config.etapas.filter((e) => e.final).map((e) => e.key))
  // "Sem X" por último: é a caixa de sobras, não merece o topo da tela.
  const ordenados = Array.from(grupos.entries()).sort(([a, ga], [b, gb]) => {
    if (a === '__sem__') return 1
    if (b === '__sem__') return -1
    return ga.rotulo.localeCompare(gb.rotulo, 'pt-BR')
  })

  for (const [id, g] of ordenados) {
    const todosDoGrupo = g.itens.flatMap((a) => [a, ...(filhosPor.get(a.id) ?? [])])
    linhas.push({
      tipo: 'grupo',
      id,
      rotulo: g.rotulo,
      quantidade: todosDoGrupo.length,
      concluidas: todosDoGrupo.filter((a) => finais.has(a.etapa)).length,
    })
    if (recolhidos.has(`grupo:${id}`)) continue
    for (const a of g.itens) empilhar(a, 0)
  }
  return linhas
}

/* -------------------------------------------------------------------------- */
/* Leitura de saúde do cronograma                                              */
/* -------------------------------------------------------------------------- */

/**
 * O texto que resume a situação de uma demanda no cronograma — o que a pessoa
 * leria em voz alta ao apontar pra barra.
 */
export function situacaoDaBarra(
  a: Atividade,
  lista: Atividade[],
  config: ConfigQuadro,
): { texto: string; tom: 'ok' | 'atencao' | 'ruim' } {
  const hoje = hojeISO()
  const { inicio, fim } = janelaDaDemanda(a)
  const progresso = progressoDe(a, lista, config)

  if (concluida(a, config)) return { texto: 'Entregue', tom: 'ok' }

  // Sem nenhuma data, `janelaDaDemanda` finge um dia em torno de hoje só pra a
  // barra existir. Medir ritmo contra essa janela inventada acusaria de atraso
  // justamente quem não tem prazo nenhum — o que falta ali é a data, não o
  // trabalho.
  if (!a.inicio && !a.prazo) {
    return { texto: progresso > 0 ? `${progresso}% feito · sem datas` : 'Sem datas', tom: 'ok' }
  }
  if (fim < hoje) {
    const dias = diasEntre(fim, hoje)
    return { texto: `Atrasada há ${dias} dia${dias === 1 ? '' : 's'}`, tom: 'ruim' }
  }
  if (inicio > hoje) {
    const dias = diasEntre(hoje, inicio)
    return { texto: `Começa em ${dias} dia${dias === 1 ? '' : 's'}`, tom: 'ok' }
  }

  // Em andamento: compara o quanto do prazo já passou com o quanto foi feito.
  // É a leitura que o MS Project chama de linha de progresso — o alerta não
  // espera o prazo vencer, avisa quando o ritmo não fecha a conta.
  const total = diasEntre(inicio, fim) + 1
  const decorrido = diasEntre(inicio, hoje) + 1
  const esperado = Math.round((decorrido / total) * 100)
  const restam = diasEntre(hoje, fim)
  if (progresso + 15 < esperado) {
    return { texto: `${progresso}% feito, esperado ~${esperado}%`, tom: 'atencao' }
  }
  return { texto: `${progresso}% feito · restam ${restam} dia${restam === 1 ? '' : 's'}`, tom: 'ok' }
}

/** Data de hoje formatada pro cabeçalho ("sexta, 5 de setembro"). */
export function hojePorExtenso(): string {
  const d = deISO(hojeISO())
  const semana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()]
  return `${semana}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** Re-exporta o formato de data usado nas telas, pra não importar de dois lugares. */
export { paraISO }

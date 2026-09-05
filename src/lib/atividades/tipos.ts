/**
 * Vocabulário do quadro de atividades: cores, etapas, tipos, áreas, campos e
 * modelos de demanda.
 *
 * Este arquivo existe porque o quadro deixou de ser fixo. Antes as etapas e as
 * áreas eram constantes no código — mudar "Briefing" para "Roteiro" exigia
 * deploy. Agora quem manda é um documento de configuração (`configuracoes/
 * atividades`, ver `config.ts`), e o que mora aqui é só a MOLDURA: os formatos,
 * a paleta que a configuração pode escolher e o padrão de fábrica.
 *
 * Nada aqui lê o Firestore. É de propósito: o card, o formulário e as regras de
 * cálculo importam daqui sem acordar nenhuma leitura.
 */

/* -------------------------------------------------------------------------- */
/* Paleta                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cores que uma etapa, um tipo ou uma área podem assumir.
 *
 * É uma lista FECHADA porque o Tailwind varre o código atrás de classes
 * literais: uma classe montada em tempo de execução simplesmente não existe no
 * CSS final. Guardando a classe inteira escrita à mão, a pessoa escolhe a cor na
 * tela de configuração e a classe já está compilada.
 */
export type CorChave =
  | 'cinza'
  | 'violeta'
  | 'indigo'
  | 'azul'
  | 'ciano'
  | 'esmeralda'
  | 'lima'
  | 'ambar'
  | 'laranja'
  | 'vermelho'
  | 'rosa'
  | 'fucsia'

export interface Cor {
  label: string
  /** Barra/ponto sólido — faixa do card, marcador da coluna e barra do cronograma. */
  bar: string
  /** Texto colorido — título da coluna. */
  text: string
  /** Etiqueta completa (fundo + texto + borda). */
  chip: string
  /** Borda sozinha — contorno da barra do cronograma. */
  borda: string
}

export const PALETA: Record<CorChave, Cor> = {
  cinza: {
    label: 'Cinza',
    bar: 'bg-ink-500',
    text: 'text-ink-300',
    chip: 'bg-bg-700 text-ink-300 border-bg-700',
    borda: 'border-ink-500',
  },
  violeta: {
    label: 'Violeta',
    bar: 'bg-violet-500',
    text: 'text-violet-400',
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    borda: 'border-violet-500',
  },
  indigo: {
    label: 'Índigo',
    bar: 'bg-indigo-500',
    text: 'text-indigo-400',
    chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    borda: 'border-indigo-500',
  },
  azul: {
    label: 'Azul',
    bar: 'bg-blue-500',
    text: 'text-blue-400',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    borda: 'border-blue-500',
  },
  ciano: {
    label: 'Ciano',
    bar: 'bg-cyan-500',
    text: 'text-cyan-400',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    borda: 'border-cyan-500',
  },
  esmeralda: {
    label: 'Esmeralda',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    borda: 'border-emerald-500',
  },
  lima: {
    label: 'Lima',
    bar: 'bg-lime-500',
    text: 'text-lime-400',
    chip: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    borda: 'border-lime-500',
  },
  ambar: {
    label: 'Âmbar',
    bar: 'bg-amber-500',
    text: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    borda: 'border-amber-500',
  },
  laranja: {
    label: 'Laranja',
    bar: 'bg-orange-500',
    text: 'text-orange-400',
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    borda: 'border-orange-500',
  },
  vermelho: {
    label: 'Vermelho',
    bar: 'bg-red-500',
    text: 'text-red-400',
    chip: 'bg-red-500/15 text-red-300 border-red-500/30',
    borda: 'border-red-500',
  },
  rosa: {
    label: 'Rosa',
    bar: 'bg-pink-500',
    text: 'text-pink-400',
    chip: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    borda: 'border-pink-500',
  },
  fucsia: {
    label: 'Fúcsia',
    bar: 'bg-fuchsia-500',
    text: 'text-fuchsia-400',
    chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    borda: 'border-fuchsia-500',
  },
}

export const CORES = Object.keys(PALETA) as CorChave[]

/** Cor de uma chave, com o cinza como rede de segurança (config antiga/torta). */
export function cor(chave: CorChave | string | null | undefined): Cor {
  return PALETA[chave as CorChave] ?? PALETA.cinza
}

/* -------------------------------------------------------------------------- */
/* Peças configuráveis                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Uma coluna do quadro — e, no cronograma, o status da barra.
 *
 * `key` é o que fica gravado em cada demanda: nunca muda depois de criada
 * (renomear troca só o `label`). `final: true` marca a coluna de saída: é ela
 * que carimba a data de conclusão, tira o card da conta de "em aberto" e encerra
 * a medição de tempo. Pode haver mais de uma (ex.: "Entregue" e "Cancelado").
 */
export interface EtapaConfig {
  key: string
  label: string
  cor: CorChave
  /** Limite de demandas em andamento na coluna. `null` = sem limite. */
  wip?: number | null
  /** Coluna de saída do fluxo (entregue/encerrado). */
  final?: boolean
  /** Explicação curta que aparece no cabeçalho da coluna. */
  descricao?: string | null
}

/** Natureza da demanda ("Lançamento", "Conteúdo", "Show"…). Vocabulário da casa. */
export interface TipoConfig {
  key: string
  label: string
  cor: CorChave
}

/** Área/time dono da demanda. Sobrevive à troca de quem executa. */
export interface AreaConfig {
  key: string
  label: string
  cor: CorChave
}

/**
 * Campos que a configuração pode desligar.
 *
 * Existe para que o quadro caiba em times diferentes sem virar um formulário de
 * quinze linhas: quem não usa esforço nem data de início esconde, e o card, o
 * formulário e o cronograma encolhem junto. Título, etapa e prioridade não
 * entram — são a estrutura do quadro.
 */
export type CampoOpcional =
  | 'tipo'
  | 'area'
  | 'artista'
  | 'responsavel'
  | 'inicio'
  | 'prazo'
  | 'esforco'
  | 'etiquetas'
  | 'checklist'
  | 'links'
  | 'comentarios'
  | 'dependencias'
  | 'subtarefas'

export const CAMPOS: { campo: CampoOpcional; label: string; descricao: string }[] = [
  {
    campo: 'tipo',
    label: 'Tipo de demanda',
    descricao: 'Classifica a natureza do pedido (lançamento, conteúdo, show…).',
  },
  {
    campo: 'area',
    label: 'Área responsável',
    descricao: 'Time dono da demanda, ao lado da pessoa responsável.',
  },
  { campo: 'artista', label: 'Artista', descricao: 'Liga a demanda a um artista do roster.' },
  { campo: 'responsavel', label: 'Responsável', descricao: 'Quem está com a demanda na mão.' },
  {
    campo: 'inicio',
    label: 'Data de início',
    descricao: 'Quando o trabalho começa. Com o prazo, forma a barra do cronograma.',
  },
  {
    campo: 'prazo',
    label: 'Prazo',
    descricao: 'Data de entrega — alimenta o atraso, o calendário e o fim da barra.',
  },
  {
    campo: 'esforco',
    label: 'Esforço estimado',
    descricao: 'Tamanho da demanda (P/M/G), usado na carga do time.',
  },
  {
    campo: 'etiquetas',
    label: 'Etiquetas',
    descricao: 'Marcadores livres para recortes que não cabem em tipo ou área.',
  },
  {
    campo: 'checklist',
    label: 'Checklist',
    descricao: 'Subtarefas simples com barra de progresso dentro da demanda.',
  },
  { campo: 'links', label: 'Links', descricao: 'Referências externas (briefing, Drive, YouTube).' },
  {
    campo: 'comentarios',
    label: 'Comentários',
    descricao: 'Fio de conversa e histórico de movimentações dentro de cada demanda.',
  },
  {
    campo: 'dependencias',
    label: 'Dependências',
    descricao: 'Uma demanda só começa depois de outra terminar — as setas do cronograma.',
  },
  {
    campo: 'subtarefas',
    label: 'Subtarefas',
    descricao: 'Demanda dentro de demanda: agrupa um projeto e soma o progresso dos filhos.',
  },
]

/**
 * Modelo de demanda: um atalho que já nasce preenchido.
 *
 * É a resposta ao "toda vez que sai single a gente refaz os mesmos sete cards".
 * O modelo não vira vínculo — ao criar, os valores são COPIADOS para a demanda;
 * editar o modelo depois não mexe no que já foi criado.
 *
 * Um modelo com `etapas` monta um PROJETO INTEIRO: a demanda escolhida vira a
 * mãe e cada etapa vira uma subtarefa, encadeada na ordem (cada uma depende da
 * anterior). É o que aproxima isto de um cronograma de projeto de verdade.
 */
export interface TemplateDemanda {
  key: string
  nome: string
  descricaoModelo?: string | null
  /** Título sugerido. `{artista}` é trocado pelo nome do artista escolhido. */
  titulo?: string | null
  descricao?: string | null
  tipo?: string | null
  area?: string | null
  prioridade?: Prioridade | null
  esforco?: Esforco | null
  /** Prazo relativo: dias a partir de hoje. `null` = sem prazo. */
  prazoEmDias?: number | null
  etiquetas?: string[]
  checklist?: string[]
  /** Subtarefas encadeadas — cada uma com sua janela dentro do projeto. */
  etapas?: EtapaModelo[]
}

/**
 * Uma subtarefa de modelo. As datas são RELATIVAS ao início do projeto, em dias,
 * para o mesmo modelo servir a um lançamento em março e a outro em novembro.
 */
export interface EtapaModelo {
  titulo: string
  /** Dias após o início do projeto em que esta subtarefa começa. */
  inicioEmDias: number
  /** Duração em dias. `0` vira um MARCO (losango, data única). */
  duracaoEmDias: number
  area?: string | null
  esforco?: Esforco | null
  /** Índice (na própria lista) da subtarefa que precisa terminar antes desta. */
  dependeDoIndice?: number | null
}

/* -------------------------------------------------------------------------- */
/* Escalas fixas                                                               */
/* -------------------------------------------------------------------------- */

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export const prioridadeMeta: Record<Prioridade, { label: string; chip: string; peso: number }> = {
  baixa: { label: 'Baixa', chip: PALETA.cinza.chip, peso: 0 },
  media: { label: 'Média', chip: PALETA.azul.chip, peso: 1 },
  alta: { label: 'Alta', chip: PALETA.ambar.chip, peso: 2 },
  urgente: { label: 'Urgente', chip: PALETA.vermelho.chip, peso: 3 },
}

export const PRIORIDADES = Object.keys(prioridadeMeta) as Prioridade[]

/**
 * Tamanho da demanda. Três degraus e nada de horas: a equipe não aponta hora, e
 * o número serve só pra somar a carga de cada pessoa — "a Ana está com 3 cards"
 * engana quando os três são um clipe inteiro.
 */
export type Esforco = 'p' | 'm' | 'g'

export const esforcoMeta: Record<Esforco, { label: string; descricao: string; pontos: number }> = {
  p: { label: 'P', descricao: 'Pequeno — resolve no dia', pontos: 1 },
  m: { label: 'M', descricao: 'Médio — alguns dias', pontos: 3 },
  g: { label: 'G', descricao: 'Grande — uma semana ou mais', pontos: 8 },
}

export const ESFORCOS = Object.keys(esforcoMeta) as Esforco[]

/* -------------------------------------------------------------------------- */
/* Configuração do quadro                                                      */
/* -------------------------------------------------------------------------- */

/** Visões disponíveis. A configuração escolhe quais a equipe enxerga. */
export type Visao = 'quadro' | 'cronograma' | 'lista' | 'calendario' | 'carga'

export const visaoMeta: Record<Visao, { label: string; descricao: string }> = {
  quadro: { label: 'Quadro', descricao: 'Kanban por etapa — o andamento do dia a dia.' },
  cronograma: {
    label: 'Cronograma',
    descricao: 'Linha do tempo com barras, dependências e marcos.',
  },
  lista: { label: 'Lista', descricao: 'Tabela ordenável, com subtarefas recolhíveis.' },
  calendario: { label: 'Calendário', descricao: 'Mês a mês pelas datas de entrega.' },
  carga: { label: 'Carga do time', descricao: 'Quanto cada pessoa está carregando.' },
}

export const VISOES = Object.keys(visaoMeta) as Visao[]

export interface ConfigQuadro {
  etapas: EtapaConfig[]
  tipos: TipoConfig[]
  areas: AreaConfig[]
  /** Vocabulário sugerido de etiquetas (dá pra digitar uma nova mesmo assim). */
  etiquetas: string[]
  campos: Record<CampoOpcional, boolean>
  templates: TemplateDemanda[]
  /** Visões ligadas, na ordem em que aparecem. */
  visoes: Visao[]
  /** Visão que abre por padrão. */
  visaoPadrao: Visao
}

/**
 * Padrão de fábrica — e também a rede de segurança quando o documento de
 * configuração não existe ou vem quebrado.
 *
 * ⚠️ As `key` das etapas e das áreas são as MESMAS de quando o quadro era fixo
 * (`solicitado`…`concluido`, `marketing`…`juridico`). É o que faz as demandas já
 * criadas caírem na coluna certa sem nenhuma migração.
 */
export const CONFIG_PADRAO: ConfigQuadro = {
  etapas: [
    {
      key: 'solicitado',
      label: 'Solicitado',
      cor: 'cinza',
      wip: null,
      descricao: 'Chegou, ainda não foi olhado',
    },
    { key: 'briefing', label: 'Briefing', cor: 'ciano', wip: null, descricao: 'Entendendo o pedido' },
    { key: 'producao', label: 'Em produção', cor: 'violeta', wip: null, descricao: 'Mão na massa' },
    { key: 'aprovacao', label: 'Aprovação', cor: 'ambar', wip: null, descricao: 'Esperando o aval' },
    {
      key: 'concluido',
      label: 'Concluído',
      cor: 'esmeralda',
      wip: null,
      final: true,
      descricao: 'Entregue',
    },
  ],
  tipos: [
    { key: 'lancamento', label: 'Lançamento', cor: 'violeta' },
    { key: 'conteudo', label: 'Conteúdo', cor: 'azul' },
    { key: 'show', label: 'Show', cor: 'rosa' },
    { key: 'campanha', label: 'Campanha', cor: 'laranja' },
    { key: 'administrativo', label: 'Administrativo', cor: 'cinza' },
  ],
  areas: [
    { key: 'marketing', label: 'Marketing', cor: 'fucsia' },
    { key: 'conteudo', label: 'Conteúdo', cor: 'azul' },
    { key: 'comercial', label: 'Comercial', cor: 'esmeralda' },
    { key: 'financeiro', label: 'Financeiro', cor: 'ambar' },
    { key: 'juridico', label: 'Jurídico', cor: 'violeta' },
  ],
  etiquetas: ['clipe', 'reels', 'capa', 'parceria', 'imprensa', 'playlist'],
  campos: {
    tipo: true,
    area: true,
    artista: true,
    responsavel: true,
    inicio: true,
    prazo: true,
    esforco: true,
    etiquetas: true,
    checklist: true,
    links: true,
    comentarios: true,
    dependencias: true,
    subtarefas: true,
  },
  visoes: ['quadro', 'cronograma', 'lista', 'calendario', 'carga'],
  visaoPadrao: 'quadro',
  templates: [
    {
      key: 'lancamento-single',
      nome: 'Lançamento de single',
      descricaoModelo: 'Projeto completo de 6 semanas, do fechamento da faixa à primeira semana de métricas.',
      titulo: 'Lançamento — {artista}',
      tipo: 'lancamento',
      area: 'marketing',
      prioridade: 'alta',
      esforco: 'g',
      prazoEmDias: 42,
      etiquetas: ['clipe'],
      etapas: [
        { titulo: 'Fechar master e definir a data', inicioEmDias: 0, duracaoEmDias: 5, area: 'marketing', esforco: 'm' },
        { titulo: 'Capa e pacote de artes', inicioEmDias: 5, duracaoEmDias: 7, area: 'conteudo', esforco: 'm', dependeDoIndice: 0 },
        { titulo: 'Subir no distribuidor', inicioEmDias: 12, duracaoEmDias: 3, area: 'marketing', esforco: 'p', dependeDoIndice: 1 },
        { titulo: 'Roteiro e gravação do clipe', inicioEmDias: 12, duracaoEmDias: 14, area: 'conteudo', esforco: 'g', dependeDoIndice: 0 },
        { titulo: 'Conteúdo de pré-lançamento', inicioEmDias: 26, duracaoEmDias: 10, area: 'conteudo', esforco: 'm', dependeDoIndice: 3 },
        { titulo: 'Imprensa e pitch de playlists', inicioEmDias: 28, duracaoEmDias: 8, area: 'marketing', esforco: 'm', dependeDoIndice: 2 },
        { titulo: 'Lançamento', inicioEmDias: 36, duracaoEmDias: 0, area: 'marketing', dependeDoIndice: 5 },
        { titulo: 'Leitura da primeira semana', inicioEmDias: 36, duracaoEmDias: 7, area: 'marketing', esforco: 'p', dependeDoIndice: 6 },
      ],
    },
    {
      key: 'campanha-conteudo',
      nome: 'Campanha de conteúdo',
      descricaoModelo: 'Duas semanas de produção de cortes, do conceito à publicação.',
      titulo: 'Campanha de conteúdo — {artista}',
      tipo: 'conteudo',
      area: 'conteudo',
      prioridade: 'media',
      esforco: 'm',
      prazoEmDias: 14,
      etiquetas: ['reels'],
      etapas: [
        { titulo: 'Definir o conceito', inicioEmDias: 0, duracaoEmDias: 2, esforco: 'p' },
        { titulo: 'Roteirizar os cortes', inicioEmDias: 2, duracaoEmDias: 3, esforco: 'm', dependeDoIndice: 0 },
        { titulo: 'Gravar', inicioEmDias: 5, duracaoEmDias: 2, esforco: 'm', dependeDoIndice: 1 },
        { titulo: 'Editar', inicioEmDias: 7, duracaoEmDias: 4, esforco: 'm', dependeDoIndice: 2 },
        { titulo: 'Aprovar com o artista', inicioEmDias: 11, duracaoEmDias: 2, esforco: 'p', dependeDoIndice: 3 },
        { titulo: 'Publicar e acompanhar', inicioEmDias: 13, duracaoEmDias: 1, esforco: 'p', dependeDoIndice: 4 },
      ],
    },
    {
      key: 'show',
      nome: 'Show / apresentação',
      descricaoModelo: 'Três semanas entre fechar o contrato e o registro do show.',
      titulo: 'Show — {artista}',
      tipo: 'show',
      area: 'comercial',
      prioridade: 'alta',
      esforco: 'm',
      prazoEmDias: 21,
      etapas: [
        { titulo: 'Fechar cachê e contrato', inicioEmDias: 0, duracaoEmDias: 5, area: 'comercial', esforco: 'm' },
        { titulo: 'Rider técnico', inicioEmDias: 5, duracaoEmDias: 3, area: 'comercial', esforco: 'p', dependeDoIndice: 0 },
        { titulo: 'Logística e hospedagem', inicioEmDias: 5, duracaoEmDias: 7, area: 'comercial', esforco: 'm', dependeDoIndice: 0 },
        { titulo: 'Divulgação', inicioEmDias: 8, duracaoEmDias: 10, area: 'marketing', esforco: 'm', dependeDoIndice: 1 },
        { titulo: 'Dia do show', inicioEmDias: 19, duracaoEmDias: 0, area: 'comercial', dependeDoIndice: 3 },
        { titulo: 'Registro e prestação de contas', inicioEmDias: 19, duracaoEmDias: 3, area: 'financeiro', esforco: 'p', dependeDoIndice: 4 },
      ],
    },
    {
      key: 'demanda-simples',
      nome: 'Demanda avulsa',
      descricaoModelo: 'Um card só, sem subtarefas — para o pedido que chega solto.',
      prioridade: 'media',
      esforco: 'p',
      prazoEmDias: 7,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Consultas à configuração                                                    */
/* -------------------------------------------------------------------------- */

/** A etapa de uma chave — ou `null` se a coluna foi apagada da configuração. */
export function etapaDe(config: ConfigQuadro, key: string | null | undefined): EtapaConfig | null {
  return config.etapas.find((e) => e.key === key) ?? null
}

export function tipoDe(config: ConfigQuadro, key: string | null | undefined): TipoConfig | null {
  return config.tipos.find((t) => t.key === key) ?? null
}

export function areaDe(config: ConfigQuadro, key: string | null | undefined): AreaConfig | null {
  return config.areas.find((a) => a.key === key) ?? null
}

/** Chaves das colunas de saída — quem está nelas não conta como "em aberto". */
export function chavesFinais(config: ConfigQuadro): Set<string> {
  return new Set(config.etapas.filter((e) => e.final).map((e) => e.key))
}

/** A primeira coluna do quadro — onde a demanda nova cai por padrão. */
export function primeiraEtapa(config: ConfigQuadro): string {
  return config.etapas[0]?.key ?? CONFIG_PADRAO.etapas[0].key
}

/** Um campo está ligado na configuração? */
export function campoLigado(config: ConfigQuadro, campo: CampoOpcional): boolean {
  return config.campos[campo] !== false
}

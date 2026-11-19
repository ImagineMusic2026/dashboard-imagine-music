/**
 * Os tipos e as contas dos contratos — puro, sem Firebase.
 *
 * Mora separado do `client.ts` pelo mesmo motivo de `atividades/tipos.ts`: a
 * página pública `/c/{token}`, onde o artista assina, precisa destes tipos e
 * NÃO pode arrastar o SDK do Firebase pro bundle (é a mesma razão de
 * `diagnostico/publico.ts` existir). Nada aqui lê nem grava.
 *
 * `client.ts` reexporta tudo isto, então quem já importava de lá continua
 * funcionando sem mudar uma linha.
 */

/* -------------------------------------------------------------------------- */
/* Tipo e situação                                                             */
/* -------------------------------------------------------------------------- */

export type TipoContrato =
  | 'agenciamento'
  | 'distribuicao'
  | 'edicao'
  | 'empresariamento'
  | 'aditivo'
  | 'outro'

export const tipoContratoMeta: Record<TipoContrato, { label: string }> = {
  agenciamento: { label: 'Agenciamento' },
  distribuicao: { label: 'Distribuição' },
  edicao: { label: 'Edição' },
  empresariamento: { label: 'Empresariamento' },
  aditivo: { label: 'Aditivo' },
  outro: { label: 'Outro' },
}

export const TIPOS_CONTRATO = Object.keys(tipoContratoMeta) as TipoContrato[]

export function ehTipoContrato(v: unknown): v is TipoContrato {
  return typeof v === 'string' && (TIPOS_CONTRATO as string[]).includes(v)
}

/** Acompanhamento manual do artista no painel. */
export const STATUS_CONTRATO_OPCOES = [
  { valor: 'ativo', rotulo: 'Contrato ativo' },
  { valor: 'sem-contrato', rotulo: 'Sem contrato' },
  { valor: 'aguardando-assinatura', rotulo: 'Aguardando assinatura' },
  { valor: 'renovacao', rotulo: 'Renovação de contrato' },
] as const

export type StatusContrato = (typeof STATUS_CONTRATO_OPCOES)[number]['valor']

export function statusContratoValido(valor: unknown): valor is StatusContrato {
  return STATUS_CONTRATO_OPCOES.some((opcao) => opcao.valor === valor)
}

/**
 * Situação derivada das datas — não é campo guardado de propósito: um status
 * gravado envelhece sozinho (o contrato vence sem ninguém tocar no doc) e vira
 * mentira na tela.
 */
export type SituacaoContrato = 'vigente' | 'a-vencer' | 'vencido' | 'encerrado' | 'futuro'

export const situacaoMeta: Record<SituacaoContrato, { label: string; chip: string }> = {
  vigente: { label: 'Vigente', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  'a-vencer': { label: 'A vencer', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  vencido: { label: 'Vencido', chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
  encerrado: { label: 'Encerrado', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
  futuro: { label: 'A iniciar', chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
}

/** Janela em que um contrato já entra como "a vencer" — tempo de renegociar. */
export const DIAS_AVISO = 90

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

/** Data local de hoje em 'YYYY-MM-DD' (sem conversão de fuso). */
export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias entre duas datas 'YYYY-MM-DD' (b - a). Meio-dia evita pegadinha de fuso. */
export function diasEntre(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  return Math.round(ms / 86_400_000)
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM-DD' → '12 set 2026' (sem conversão de fuso). */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''} ${a}`
}

const MESES_LONGOS = [
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

/**
 * 'YYYY-MM-DD' → '12 de setembro de 2026'.
 *
 * É a forma que vai DENTRO do contrato (data de assinatura, vigência): num
 * documento que alguém assina, "12 set 2026" não serve.
 */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES_LONGOS[Number(m) - 1] ?? ''} de ${a}`
}

/* -------------------------------------------------------------------------- */
/* Assinatura                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Uma assinatura eletrônica simples, com a trilha que a torna oponível.
 *
 * `em`, `ip`, `agente` e `hash` são carimbados pelo SERVIDOR, nunca pelo corpo
 * do pedido — mesmo motivo de `api/artistas/dossie`: se viessem do navegador,
 * qualquer um assinaria com a data que quisesse. O `hash` é do texto renderizado
 * no instante da assinatura: é ele que prova que o documento não mudou depois.
 */
export interface Assinatura {
  /** Nome como a pessoa declarou ao assinar. */
  nome: string
  /** Documento informado (CPF/CNPJ), quando houver. */
  documento?: string | null
  /** dataURL PNG do traço feito no canvas. */
  imagem: string
  /** ISO 8601, carimbado pelo servidor. */
  em: string
  ip?: string | null
  agente?: string | null
  /** SHA-256 do texto renderizado no momento da assinatura. */
  hash: string
}

/**
 * Onde o contrato gerado está.
 *
 * Derivado das assinaturas, nunca gravado — mesma regra de `situacaoDe`. Um
 * estado guardado discordaria do documento no primeiro erro de escrita.
 */
export type EstadoContrato = 'rascunho' | 'aguardando-artista' | 'assinado-artista' | 'assinado'

export const estadoMeta: Record<EstadoContrato, { label: string; chip: string }> = {
  rascunho: { label: 'Rascunho', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
  'aguardando-artista': {
    label: 'Aguardando o artista',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  'assinado-artista': {
    label: 'Falta a Imagine',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  assinado: { label: 'Assinado', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
}

/* -------------------------------------------------------------------------- */
/* O contrato                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * De onde o contrato veio.
 *
 * `anexo` é o de sempre: a ficha aponta pro PDF que já vive no Drive. `gerado`
 * é o emitido pelo painel a partir de um modelo, que carrega o texto e as
 * assinaturas dentro do próprio documento. Ausente = `anexo`, que é o que todos
 * os contratos de antes de 11/2026 são.
 */
export type OrigemContrato = 'anexo' | 'gerado'

export interface Contrato {
  id: string
  tipo: TipoContrato
  /** Nome próprio quando ajuda a distinguir (ex.: "Aditivo — turnê 2026"). */
  titulo?: string | null
  /** Início da vigência em 'YYYY-MM-DD'. */
  inicio: string
  /** Fim da vigência; `null` = prazo indeterminado. */
  fim?: string | null
  /** Encerrado/rescindido antes do fim previsto. */
  encerrado?: boolean
  /** Link do PDF digitalizado (Drive da Imagine). Ver o cabeçalho de `client.ts`. */
  arquivoUrl?: string | null
  /** Percentual do selo, quando o contrato define um. */
  percentual?: number | null
  observacoes?: string | null
  criadoPor?: string

  /* --- Só quando `origem === 'gerado'` ----------------------------------- */
  origem?: OrigemContrato
  modeloKey?: string | null
  modeloNome?: string | null
  /**
   * Data de emissão, 'YYYY-MM-DD' — a data QUE SAI NO DOCUMENTO.
   *
   * Congelada aqui de propósito. Se `{{data_hoje}}` fosse calculada na hora de
   * desenhar, o PDF regerado no ano que vem traria a data do ano que vem, e o
   * texto deixaria de bater com o `hash` gravado na assinatura — que é a única
   * prova de que o documento não mudou depois de assinado.
   */
  emitidoEm?: string | null
  /**
   * SNAPSHOT do texto do modelo na hora de gerar.
   *
   * O modelo NÃO vira vínculo — é copiado, como os modelos de projeto do quadro
   * de atividades. Editar o modelo na configuração depois não pode mudar uma
   * vírgula de um contrato já emitido, muito menos de um já assinado.
   */
  textoModelo?: string | null
  /** SNAPSHOT da definição dos campos, pelo mesmo motivo do texto. */
  campos?: CampoContrato[] | null
  /** O que foi preenchido, pela equipe e pelo artista. */
  valores?: Record<string, string> | null
  assinaturaArtista?: Assinatura | null
  assinaturaImagine?: Assinatura | null
}

export interface DadosContrato {
  tipo: TipoContrato
  titulo?: string | null
  inicio: string
  fim?: string | null
  encerrado?: boolean
  arquivoUrl?: string | null
  percentual?: number | null
  observacoes?: string | null
}

export function situacaoDe(c: Contrato, hoje = hojeISO()): SituacaoContrato {
  if (c.encerrado) return 'encerrado'
  if (c.inicio && c.inicio > hoje) return 'futuro'
  if (!c.fim) return 'vigente'
  if (c.fim < hoje) return 'vencido'
  return diasEntre(hoje, c.fim) <= DIAS_AVISO ? 'a-vencer' : 'vigente'
}

export function ehGerado(c: Contrato): boolean {
  return c.origem === 'gerado'
}

/**
 * Em que pé está o contrato gerado.
 *
 * `temLink` entra de fora porque o link mora em outra coleção: sem ele e sem
 * assinatura nenhuma, o contrato ainda é rascunho — ninguém foi convidado a
 * assinar. Para um contrato anexado o estado não existe, e quem chama não deve
 * perguntar.
 */
export function estadoDe(c: Contrato, temLink: boolean): EstadoContrato {
  if (c.assinaturaArtista && c.assinaturaImagine) return 'assinado'
  if (c.assinaturaArtista) return 'assinado-artista'
  return temLink ? 'aguardando-artista' : 'rascunho'
}

/** Aceita só http(s) — o link vira um `href` que a equipe clica. */
export function linkValido(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Campos do modelo                                                            */
/* -------------------------------------------------------------------------- */

export type FormatoCampo =
  | 'texto'
  | 'texto-longo'
  | 'cpf'
  | 'cnpj'
  | 'data'
  | 'numero'
  | 'email'
  | 'telefone'

export const formatoMeta: Record<FormatoCampo, { label: string; exemplo: string }> = {
  texto: { label: 'Texto', exemplo: 'Maria da Silva' },
  'texto-longo': { label: 'Texto longo', exemplo: 'Várias linhas' },
  cpf: { label: 'CPF', exemplo: '000.000.000-00' },
  cnpj: { label: 'CNPJ', exemplo: '00.000.000/0000-00' },
  data: { label: 'Data', exemplo: '2026-11-17' },
  numero: { label: 'Número', exemplo: '20' },
  email: { label: 'E-mail', exemplo: 'nome@email.com' },
  telefone: { label: 'Telefone', exemplo: '(75) 90000-0000' },
}

export const FORMATOS = Object.keys(formatoMeta) as FormatoCampo[]

/** Quem preenche o campo: a equipe, ao emitir, ou o artista, pelo link. */
export type QuemPreenche = 'equipe' | 'artista'

export interface CampoContrato {
  /** A chave é o que vai entre chaves no texto: `cpf` → `{{cpf}}`. */
  chave: string
  rotulo: string
  formato: FormatoCampo
  obrigatorio: boolean
  quemPreenche: QuemPreenche
  /** Linha de ajuda sob o campo, quando o rótulo não basta. */
  ajuda?: string | null
}

export interface ModeloContrato {
  /** Chave estável, nascida do nome e nunca recalculada. */
  key: string
  nome: string
  tipo: TipoContrato
  /** O contrato inteiro, com `{{variaveis}}`. */
  texto: string
  campos: CampoContrato[]
}

export interface ConfigContratos {
  modelos: ModeloContrato[]
}

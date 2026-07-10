import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'
import type { ReceitaPlataforma } from '@/types'

/**
 * Tipos do pipeline de importação da OneRPM.
 *
 * O relatório vem como uma aba "Sales" onde cada linha é UM item de venda
 * (faixa × loja × país × mês). Aqui guardamos o dado cru (já limpo/trim) e os
 * agregados. Mantemos SEMPRE bruto e líquido por moeda — nunca somamos moedas
 * diferentes — pra não travar nas decisões de exibição (a câmbio/base ficam no
 * `config.ts`).
 */

/** Linha crua da aba "Sales", já com `.trim()` aplicado nos textos. */
export interface OneRpmRawRow {
  sourceAccount: string
  title: string
  albumChannel: string
  artists: string
  label: string
  productType: string
  parentId: string
  trackId: string
  salesType: string
  transactionMonth: string // mês do consumo, ex.: "2025-10"
  accountedDate: string // data em que a OneRPM lançou, ex.: "2026-05-11"
  quantity: number
  territory: string
  store: string
  currency: string
  gross: number
  net: number
}

/** Valor monetário separado por moeda. Ex.: { USD: 4.75, BRL: 0.69 }. */
export type MoneyByCurrency = Record<string, number>

export interface PlataformaAgregada {
  plataforma: string // canônica: "Spotify", "Apple Music", "YouTube", "Meta"...
  corKey: string // chave de cor usada pelo ReceitaPlataformaItem
  iconeTipo: PlataformaTipo
  linhas: number
  streams: number
  grossPorMoeda: MoneyByCurrency
  netPorMoeda: MoneyByCurrency
}

export interface FaixaAgregada {
  titulo: string
  trackId: string
  linhas: number
  streams: number
  grossPorMoeda: MoneyByCurrency
  netPorMoeda: MoneyByCurrency
}

export interface TerritorioAgregado {
  territorio: string
  streams: number
  netPorMoeda: MoneyByCurrency
}

export interface MesAgregado {
  mes: string // transactionMonth, ex.: "2025-12"
  streams: number
  netPorMoeda: MoneyByCurrency
}

export interface OneRpmAggregate {
  fonte: 'onerpm'
  artistaNome: string
  artistaSlug: string
  label: string
  periodo: {
    transactionMonths: string[] // meses de consumo presentes (ordenados)
    accountedFrom: string | null // 1ª data de lançamento
    accountedTo: string | null // última data de lançamento
  }
  moedas: string[]
  totais: {
    linhas: number
    streams: number
    grossPorMoeda: MoneyByCurrency
    netPorMoeda: MoneyByCurrency
  }
  porPlataforma: PlataformaAgregada[]
  porFaixa: FaixaAgregada[]
  porTerritorio: TerritorioAgregado[]
  porMes: MesAgregado[]
  avisos: string[]
}

/**
 * Como a linha foi atribuída a um artista, em ordem de confiança:
 *  - `conta`     : sub-conta da OneRPM ("Imagine Music co: Netto Brito"). Autoritativa.
 *  - `performer` : 1º performer do campo "Artists". Usada quando a linha vem na
 *                  conta do selo (sem `:`).
 *  - `canal`     : nome do canal em "Album/Channel". Único recurso para vídeos do
 *                  YouTube, que vêm SEM "Artists" e SEM sub-conta.
 */
export type OrigemAtribuicao = 'conta' | 'performer' | 'canal'

/**
 * Linha da aba "Shares In & Out": um repasse entre duas contas da OneRPM.
 * Não é receita nova — é o split de uma linha que já existe em "Sales".
 */
export interface OneRpmShareRow {
  shareType: string // "Stream (Share In)" | "Stream (Share Out)" | "Download (Share Out)"
  payerName: string
  receiverName: string
  currency: string
  net: number
}

/** Agregado de um artista + de onde vieram as linhas dele. */
export interface ArtistaAgregado extends OneRpmAggregate {
  origens: Record<OrigemAtribuicao, number>
  /** Fatia da receita deste artista que vai pro selo. JÁ inclusa em `totais` — nunca somar. */
  repassePorMoeda: MoneyByCurrency
}

/**
 * Um relatório da OneRPM é do SELO INTEIRO — dezenas de artistas numa aba só.
 * O lote é o resultado de fatiar esse arquivo por artista.
 */
export interface OneRpmLote {
  fonte: 'onerpm'
  label: string
  periodo: OneRpmAggregate['periodo']
  moedas: string[]
  totais: OneRpmAggregate['totais']
  artistas: ArtistaAgregado[]
  /** Linhas que nenhuma regra conseguiu atribuir. NÃO viram receita de ninguém. */
  naoAtribuido: OneRpmAggregate | null
  /** O que o selo paga a terceiros (colaboradores). Negativo. Não é de nenhum artista. */
  pagoTerceirosPorMoeda: MoneyByCurrency
  avisos: string[]
}

/** Resumo de um artista dentro do doc do lote (o agregado completo vai em `receitas/{slug}`). */
export interface ArtistaImportado {
  slug: string
  nome: string
  linhas: number
  streams: number
  totalBRL: number
  /** Fatia que vai pro selo, em BRL. Já está dentro de `totalBRL`. */
  repasseBRL: number
  /** Não tem sub-conta própria na OneRPM — foi inferido de "Artists"/"Album/Channel". */
  semConta: boolean
  /** O cadastro do artista foi CRIADO por esta importação (não existia no roster). */
  criado: boolean
}

/**
 * Snapshot gravado em `artistas/{slug}` — é o que o perfil do artista lê
 * (client SDK). Já vem com a receita no formato de exibição do painel.
 */
export interface ReceitaArtistaDoc {
  nome: string
  slug: string
  label: string
  fonte: 'onerpm'
  receitaPorPlataforma: ReceitaPlataforma[]
  totais: OneRpmAggregate['totais']
  totalBRL: number
  streams: number
  moedas: string[]
  periodo: OneRpmAggregate['periodo']
  /** Fatia que vai pro selo. Ausente = este artista não tem split. */
  repassePorMoeda?: MoneyByCurrency
  repasseBRL?: number
  ultimaImportacaoId?: string
}


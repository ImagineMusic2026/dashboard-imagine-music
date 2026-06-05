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
  ultimaImportacaoId?: string
}


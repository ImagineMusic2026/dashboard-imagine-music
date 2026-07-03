import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'

/**
 * Tipos do feed de STREAMING ("trends") da OneRPM — separado da receita.
 *
 * Diferente do XLSX de vendas (gross/net por moeda), o trends é um CSV diário
 * simples vindo por SFTP. Um arquivo por dia (`YYYY-MM-DD.csv`) com as colunas:
 *   store, date_stat, country_code, quantity, skips, isrc, artist_name
 * Grão = uma linha por **store × dia × país × ISRC**. NÃO tem receita nem título
 * da faixa — a faixa é identificada só pelo ISRC; o título vem do catálogo
 * `catalogo-faixas` (CSV oficial da OneRPM + fallback Deezer, ver `catalogo-faixas.ts`).
 */

/** Linha crua do CSV de trends, já com `.trim()` e prefixo de artista removido. */
export interface OneRpmTrendsRow {
  store: string // ex.: "spotify"
  dateStat: string // "YYYY-MM-DD" (date puro, sem fuso)
  countryCode: string // ISO-2, ex.: "BR"
  quantity: number // streams (plays)
  skips: number
  isrc: string
  artistNameRaw: string // como veio no CSV (ex.: "ImagineMusic: ARTISTA 1")
  artistName: string // limpo (sem o prefixo "ImagineMusic: ")
}

export interface TrendsDiaPonto {
  dia: string // "YYYY-MM-DD"
  streams: number
  skips: number
}

export interface TrendsPaisAgg {
  pais: string // ISO-2
  streams: number
  skips: number
}

export interface TrendsLojaAgg {
  loja: string // store cru (ex.: "spotify")
  plataforma: string // canônica (ex.: "Spotify")
  corKey: string
  iconeTipo: PlataformaTipo
  streams: number
  skips: number
}

export interface TrendsFaixaAgg {
  isrc: string
  streams: number
  skips: number
}

export interface TrendsArtistaAgg {
  artistaNome: string
  artistaSlug: string
  streams: number
  skips: number
  skipRate: number // skips / streams (0..1)
  periodo: { de: string; ate: string; dias: number }
  porDia: TrendsDiaPonto[]
  porPais: TrendsPaisAgg[]
  porLoja: TrendsLojaAgg[]
  porFaixa: TrendsFaixaAgg[]
}

export interface OneRpmTrendsAggregate {
  fonte: 'onerpm-trends'
  periodo: { de: string; ate: string; dias: number }
  stores: string[] // stores presentes (cru)
  totais: {
    linhas: number
    streams: number
    skips: number
    skipRate: number
    artistas: number
    isrcs: number
  }
  porArtista: TrendsArtistaAgg[]
  avisos: string[]
}

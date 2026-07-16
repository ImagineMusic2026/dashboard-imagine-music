export type Severidade = 'critico' | 'atencao' | 'oportunidade' | 'operacional'
export type Status = 'ativo' | 'inativo' | 'onboarding'

export interface Gestor {
  id: string
  nome: string
  email: string
  papel: 'diretor' | 'gestor' | 'analista'
  cor: string  // gradient class pra avatar
}

export interface HealthScoreBreakdown {
  audiencia: number      // 0-100
  engajamento: number
  conteudo: number
  negocio: number
}

export interface Artista {
  id: string
  nome: string
  handle: string
  iniciais: string       // "FA" pra avatar fallback
  corAvatar: string      // gradient
  genero: string
  gestorId: string
  status: Status

  // Identificadores externos (mock)
  spotifyId?: string
  instagramHandle?: string
  tiktokHandle?: string

  // Métricas calculadas
  healthScore: number
  healthScoreAnterior: number
  healthScoreBreakdown: HealthScoreBreakdown
  audiencia: number              // soma seguidores
  receita30d: number             // BRL
  receita30dVariacao: number     // %

  // Histórico (sparkline)
  healthHistory: number[]        // últimos 30 dias

  contratoAte?: string           // ISO date
}

export interface Alerta {
  id: string
  artistaId: string
  severidade: Severidade
  categoria: string
  titulo: string
  descricao: string
  acaoSugerida?: string
  lido: boolean
  resolvido: boolean
  criadoHa: string               // "há 2h", "há 14min"
}

export interface Integracao {
  id: string
  tipo: 'onerpm' | 'meta' | 'instagram' | 'tiktok' | 'spotify' | 'youtube' | 'manual'
  nome: string
  status: 'ativo' | 'parcial' | 'erro' | 'desconectado'
  ultimaSincHa: string
  proximaSinc?: string
  contasAutorizadas: number
  contasTotal: number
  recuperaDados: string[]        // ['streams', 'receita', 'demografia']
}

export interface ReceitaPlataforma {
  plataforma: string
  cor: string
  streams: number
  /** Receita por moeda original — nunca somamos moedas diferentes. */
  receitaPorMoeda: Record<string, number>
  /** Top faixas dentro desta plataforma, quando a importação traz o detalhamento. */
  faixas?: Array<{
    titulo: string
    streams: number
    receitaPorMoeda: Record<string, number>
    lancamentos: number
  }>
  /** Participação no total do artista, por STREAMS (base comparável sem câmbio). */
  percentualTotal: number
  /** @deprecated só p/ mocks antigos que passavam um valor único; a exibição usa `receitaPorMoeda`. */
  receita?: number
  variacao?: number
}

/**
 * Tipos da integração com a Graph API do Meta (Instagram). SERVER-ONLY.
 * Os tipos de leitura no client (Firestore) ficam em `@/lib/metricas-sociais`.
 */

/** Uma conta do Instagram Business/Creator acessível pelo token. */
export interface ContaIG {
  /** IG User ID (numérico) — usado em todas as chamadas de insights. */
  id: string
  /** @username, sem o arroba, em minúsculas. */
  username: string
  /** Nome de exibição da conta, quando disponível. */
  nome?: string
  /** ID da Página do Facebook vinculada (origem da conta). */
  pageId?: string
  /** Nome da Página vinculada. */
  pageNome?: string
}

/** Métricas de uma conta do Instagram num instante. */
export interface MetricasInstagram {
  /** IG User ID consultado. */
  contaId: string
  /** @username no momento da coleta. */
  username: string

  // Campos diretos do nó IG User (estado atual).
  seguidores: number | null
  segue: number | null
  publicacoes: number | null

  // Insights agregados na janela consultada.
  alcance: number | null
  visualizacoes: number | null
  visitasPerfil: number | null
  contasEngajadas: number | null
  interacoesTotais: number | null

  /** Janela usada para os insights (em dias). */
  janelaDias: number
  /** ISO timestamp da coleta. */
  coletadoEm: string
  /** Métricas que falharam ao coletar (diagnóstico). */
  avisos?: string[]
}

/** Erro normalizado da Graph API (formato do campo `error` do Meta). */
export interface MetaApiError {
  message: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

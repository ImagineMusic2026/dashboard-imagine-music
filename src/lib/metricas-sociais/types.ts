/**
 * Tipos das métricas sociais persistidas no Firestore. Compartilhados entre
 * servidor (escrita) e client (leitura). NÃO importam nada de `@/lib/meta`
 * (que é server-only) para poderem ser usados em Client Components.
 *
 * Coleções:
 *   metricas-sociais/{slug}                  -> snapshot mais recente
 *   metricas-sociais/{slug}/historico/{dia}  -> 1 ponto por dia (tendência)
 *   integracoes/meta                          -> status da integração
 */

/** Snapshot do Instagram de um artista num instante. */
export interface InstagramSnapshot {
  /** IG User ID. */
  contaId: string
  username: string
  seguidores: number | null
  segue: number | null
  publicacoes: number | null
  alcance: number | null
  visualizacoes: number | null
  visitasPerfil: number | null
  contasEngajadas: number | null
  interacoesTotais: number | null
  /** Janela (em dias) dos insights agregados. */
  janelaDias: number
  /** ISO timestamp da coleta. */
  coletadoEm: string
}

/** Documento `metricas-sociais/{slug}`. */
export interface MetricasSociaisDoc {
  slug: string
  instagram?: InstagramSnapshot | null
  /** ISO timestamp da última atualização (qualquer rede). */
  atualizadoEm: string
}

/** Ponto diário de histórico: `metricas-sociais/{slug}/historico/{YYYY-MM-DD}`. */
export interface HistoricoDiaDoc {
  /** YYYY-MM-DD. */
  dia: string
  seguidores: number | null
  alcance: number | null
  visualizacoes: number | null
  interacoesTotais: number | null
  coletadoEm: string
}

export type StatusIntegracao = 'conectado' | 'nao_configurado' | 'erro'

/** Documento `integracoes/meta` — alimenta a página de integrações. */
export interface IntegracaoMetaDoc {
  status: StatusIntegracao
  /** Artistas com conta IG vinculada (igUserId gravado). */
  contasMapeadas: number
  /** Total de artistas no cadastro. */
  totalArtistas: number
  /** Contas que retornaram métricas na última sincronização. */
  contasSincronizadas: number
  /** ISO timestamp. */
  ultimaSincronizacao: string | null
  ultimaDescoberta: string | null
  /** Mensagem do último erro, se houver. */
  erro?: string | null
  /** Versão da Graph API usada na última execução. */
  graphVersion?: string
}

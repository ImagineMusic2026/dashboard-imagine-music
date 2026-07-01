/**
 * Tipos das métricas sociais persistidas no Firestore. Compartilhados entre
 * servidor (escrita) e client (leitura). NÃO importam nada de `@/lib/meta`
 * (que é server-only) para poderem ser usados em Client Components.
 *
 * Coleções:
 *   metricas-sociais/{slug}                          -> snapshot mais recente (instagram + tiktok + youtube)
 *   metricas-sociais/{slug}/historico/{dia}          -> 1 ponto/dia do Instagram (tendência)
 *   metricas-sociais/{slug}/historico-tiktok/{dia}   -> 1 ponto/dia do TikTok (tendência)
 *   metricas-sociais/{slug}/historico-youtube/{dia}  -> 1 ponto/dia do YouTube (tendência)
 *   metricas-sociais/{slug}/historico-streaming/{dia}-> 1 ponto/dia de streaming OneRPM (plays/skips)
 *   integracoes/meta                                  -> status da integração Meta
 *   integracoes/tiktok                                -> status da integração TikTok
 *   integracoes/youtube                               -> status da integração YouTube
 *   tiktok-tokens/{slug}                              -> tokens OAuth do artista (SERVER-ONLY, ver TikTokTokenDoc)
 *   youtube-tokens/{slug}                             -> tokens OAuth do artista (SERVER-ONLY, ver YouTubeTokenDoc)
 */

import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'

/** Um post recente do Instagram (camada de conteúdo). */
export interface InstagramPostItem {
  id: string
  legenda: string | null
  /** IMAGE | VIDEO | CAROUSEL_ALBUM | REELS… */
  tipo: string | null
  thumbUrl: string | null
  permalink: string | null
  /** ISO timestamp da publicação. */
  publicadoEm: string | null
  curtidas: number | null
  comentarios: number | null
  /** Métricas na medição anterior + quando foram medidas — pra calcular crescimento. */
  curtidasAntes?: number | null
  comentariosAntes?: number | null
  medidoAntesEm?: string | null
}

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
  /** Seguidores na coleta anterior + quando — pra detectar crescimento/queda/marco. */
  seguidoresAntes?: number | null
  seguidoresAntesEm?: string | null
  /** Posts recentes coletados (camada de conteúdo). */
  postsRecentes?: InstagramPostItem[]
}

/** Um vídeo recente do TikTok (camada de conteúdo). */
export interface TikTokVideoItem {
  id: string
  /** Legenda do vídeo (a Display API expõe `title`/`video_description`). */
  titulo: string
  /** cover_image_url — URL assinada que EXPIRA; só para exibição (com fallback). */
  thumbUrl: string | null
  /** ISO timestamp da publicação (derivado de create_time, que vem em segundos). */
  publicadoEm: string | null
  /** share_url público do vídeo. */
  url: string | null
  views: number | null
  curtidas: number | null
  comentarios: number | null
  compartilhamentos: number | null
}

/** Snapshot do TikTok de um artista num instante (Display API). */
export interface TikTokSnapshot {
  /** open_id do TikTok (estável por app+usuário). */
  contaId: string
  /** @username público (sem o arroba). */
  username: string
  /** Nome de exibição. */
  displayName?: string | null
  /** URL do avatar (pode expirar; só para exibição). */
  avatarUrl?: string | null
  /** Conta verificada. */
  verificado?: boolean | null

  // Campos diretos do perfil (estado atual).
  seguidores: number | null
  segue: number | null
  /** Total de curtidas recebidas na conta (likes_count). */
  curtidas: number | null
  /** Total de vídeos públicos (video_count). */
  videos: number | null

  // Agregado dos vídeos públicos mais recentes (único sinal de engajamento da Display API).
  viewsRecentes: number | null
  curtidasRecentes: number | null
  comentariosRecentes: number | null
  compartilhamentosRecentes: number | null
  /** Quantos vídeos entraram no agregado acima. */
  videosConsiderados: number | null
  /** Vídeos recentes coletados (camada de conteúdo). */
  videosRecentes?: TikTokVideoItem[]

  /** ISO timestamp da coleta. */
  coletadoEm: string
  /** Métricas que falharam ao coletar (diagnóstico). */
  avisos?: string[]
}

/**
 * Camada PRIVADA do YouTube (YouTube Analytics API, via OAuth do artista).
 * Só existe para artistas que conectaram a conta; null/ausente caso contrário.
 */
export interface YouTubeAnalytics {
  /** Janela dos números (em dias). */
  periodoDias: number
  /** Minutos assistidos na janela (estimatedMinutesWatched). */
  minutosExibidos: number | null
  /** Duração média de visualização, em segundos (averageViewDuration). */
  duracaoMediaSeg: number | null
  /** Views na janela (do Analytics, não o total do canal). */
  views: number | null
  inscritosGanhos: number | null
  inscritosPerdidos: number | null
  /** ISO timestamp da coleta da camada Analytics. */
  coletadoEm: string
}

/** Um vídeo recente do YouTube (camada de conteúdo). */
export interface YouTubeVideoItem {
  id: string
  titulo: string
  thumbUrl: string | null
  /** ISO timestamp da publicação. */
  publicadoEm: string | null
  views: number | null
  curtidas: number | null
  comentarios: number | null
  url: string
  /** Métricas na medição anterior + quando foram medidas — pra calcular crescimento. */
  viewsAntes?: number | null
  curtidasAntes?: number | null
  comentariosAntes?: number | null
  medidoAntesEm?: string | null
}

/**
 * Snapshot do YouTube de um artista. A base (pública) vem da Data API por API
 * key e existe para qualquer canal mapeado; `analytics` (privado) só aparece
 * para quem conectou via OAuth.
 */
export interface YouTubeSnapshot {
  /** Channel ID (UC...). */
  contaId: string
  /** Nome do canal. */
  titulo?: string | null
  /** @handle / customUrl, sem o arroba, quando disponível. */
  handle?: string | null
  /** URL da thumbnail do canal (só exibição). */
  thumbUrl?: string | null

  // Camada pública (Data API).
  inscritos: number | null
  /** O canal escondeu a contagem de inscritos. */
  inscritosOcultos?: boolean
  /** Total de visualizações do canal (viewCount). */
  viewsTotais: number | null
  /** Total de vídeos públicos (videoCount). */
  videos: number | null
  // Agregado dos vídeos públicos mais recentes.
  viewsRecentes: number | null
  curtidasRecentes: number | null
  comentariosRecentes: number | null
  videosConsiderados: number | null
  /** Vídeos recentes coletados (camada de conteúdo). */
  videosRecentes?: YouTubeVideoItem[]

  // Camada privada (Analytics) — presente só para canais conectados.
  analytics?: YouTubeAnalytics | null

  /** ISO timestamp da coleta. */
  coletadoEm: string
  /** Inscritos na coleta anterior + quando — pra detectar crescimento/queda/marco. */
  inscritosAntes?: number | null
  inscritosAntesEm?: string | null
  /** Métricas que falharam ao coletar (diagnóstico). */
  avisos?: string[]
}

/** Documento `metricas-sociais/{slug}`. */
export interface MetricasSociaisDoc {
  slug: string
  instagram?: InstagramSnapshot | null
  tiktok?: TikTokSnapshot | null
  youtube?: YouTubeSnapshot | null
  streaming?: StreamingSnapshot | null
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

/* ───────────────────────────── Streaming (OneRPM) ───────────────────────────── */

/** Streams/skips de uma plataforma de streaming na janela do snapshot. */
export interface StreamingPlataformaItem {
  plataforma: string
  corKey: string
  iconeTipo: PlataformaTipo
  streams: number
  skips: number
}

/** Streams de um país na janela do snapshot. */
export interface StreamingPaisItem {
  pais: string
  streams: number
}

/**
 * Snapshot de streaming de um artista (feed "trends" da OneRPM via SFTP).
 * Diferente das redes sociais e da receita, é só CONSUMO: plays/skips por
 * dia/país/plataforma. NÃO tem receita (essa continua na coleção `receitas`).
 */
export interface StreamingSnapshot {
  /** Janela coberta pelo snapshot (último backfill sincronizado). */
  periodo: { de: string; ate: string; dias: number }
  /** Totais na janela. */
  streams: number
  skips: number
  /** skips / streams (0..1). */
  skipRate: number
  /** Soma dos últimos 7 / 28 dias com dado (destaque recente). */
  streams7d: number | null
  streams28d: number | null
  /** Quebra por plataforma e por país (ordenadas por streams desc). */
  porPlataforma: StreamingPlataformaItem[]
  porPais: StreamingPaisItem[]
  /** Nº de faixas distintas (ISRCs). */
  faixas: number
  /** Lojas presentes na janela. */
  lojas: string[]
  /** Nome do artista como veio no feed (sem o prefixo da conta). */
  artistaNome?: string | null
  /** Data do dado mais recente disponível (YYYY-MM-DD). */
  ultimoDia: string | null
  /** ISO timestamp da sincronização. */
  coletadoEm: string
}

/** Ponto diário de streaming: `metricas-sociais/{slug}/historico-streaming/{dia}`. */
export interface HistoricoStreamingDiaDoc {
  /** YYYY-MM-DD. */
  dia: string
  streams: number
  skips: number
  coletadoEm: string
}

/** Uma faixa (ISRC) com seu consumo na janela — base da análise de skip. */
export interface StreamingFaixaItem {
  isrc: string
  streams: number
  skips: number
}

/**
 * Detalhe granular de streaming de um artista (faixas + geografia com skip),
 * para a área de ANÁLISE. Fica numa subcoleção separada (`metricas-sociais/
 * {slug}/streaming-detalhe/atual`) pra não pesar as leituras de lista (home /
 * roster) — que carregam todos os artistas e não precisam desse detalhe.
 */
export interface StreamingDetalheDoc {
  periodo: { de: string; ate: string; dias: number }
  /** Faixas (ISRC) ordenadas por streams — top N. */
  porFaixa: StreamingFaixaItem[]
  /** Países com streams + skips (pra calcular skip rate por país). */
  porPais: { pais: string; streams: number; skips: number }[]
  coletadoEm: string
}

export type StatusIntegracao = 'conectado' | 'nao_configurado' | 'erro'

/** Um artista com streaming na última sincronização (para a lista "ver contas"). */
export interface OneRpmArtistaResumo {
  slug: string
  nome: string
  /** Streams na janela da última execução. */
  streams: number
}

/** Documento `integracoes/onerpm` — status do sync de streaming (alimenta o card). */
export interface IntegracaoOneRpmDoc {
  status: StatusIntegracao
  /** Artistas que receberam streaming na última sincronização. */
  artistasSincronizados: number
  /** Arquivos baixados na última execução. */
  arquivos: number
  /** Streams agregados na janela da última execução. */
  streamsJanela: number
  /** Janela (dias) usada na última execução. */
  janelaDias: number
  /** ISO timestamp da última sincronização. */
  ultimaSincronizacao: string | null
  /** Dia mais recente com dado no feed (YYYY-MM-DD). */
  ultimoDia: string | null
  /**
   * Lista compacta dos artistas com streaming (slug + nome + streams), ordenada
   * por streams desc. Alimenta o "ver contas" do card sem varrer `metricas-sociais`.
   */
  artistas?: OneRpmArtistaResumo[]
  erro?: string | null
}

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

/** Ponto diário de histórico do TikTok: `metricas-sociais/{slug}/historico-tiktok/{dia}`. */
export interface HistoricoTikTokDiaDoc {
  /** YYYY-MM-DD. */
  dia: string
  seguidores: number | null
  curtidas: number | null
  videos: number | null
  viewsRecentes: number | null
  coletadoEm: string
}

/** Documento `integracoes/tiktok` — alimenta a página de integrações. */
export interface IntegracaoTikTokDoc {
  status: StatusIntegracao
  /** Artistas com TikTok autorizado (token guardado). */
  contasConectadas: number
  /** Total de artistas no cadastro. */
  totalArtistas: number
  /** Contas que retornaram métricas na última sincronização. */
  contasSincronizadas: number
  /** ISO timestamp. */
  ultimaSincronizacao: string | null
  /** Mensagem do último erro, se houver. */
  erro?: string | null
}

/**
 * Tokens OAuth de um artista (coleção `tiktok-tokens/{slug}`). SERVER-ONLY:
 * contém segredos (access/refresh token). As regras do Firestore negam toda
 * leitura/escrita pelo client — só o Admin SDK (rotas /api/integracoes/tiktok)
 * acessa. NUNCA exponha este documento em um Client Component.
 */
export interface TikTokTokenDoc {
  slug: string
  /** open_id do TikTok. */
  openId: string
  accessToken: string
  refreshToken: string
  /** ISO — quando o access token expira (~24h). */
  accessExpiraEm: string
  /** ISO — quando o refresh token expira (~365d, renovado a cada uso). */
  refreshExpiraEm: string
  /** Escopos concedidos (string separada por vírgula). */
  scope: string
  atualizadoEm: string
}

/* ───────────────────────────── YouTube ───────────────────────────── */

/** Ponto diário de histórico do YouTube: `metricas-sociais/{slug}/historico-youtube/{dia}`. */
export interface HistoricoYouTubeDiaDoc {
  /** YYYY-MM-DD. */
  dia: string
  inscritos: number | null
  viewsTotais: number | null
  viewsRecentes: number | null
  /** Minutos exibidos no período (camada Analytics), se conectado. */
  minutosExibidos: number | null
  coletadoEm: string
}

/**
 * Ponto diário do Health Score: `metricas-sociais/{slug}/historico-health/{dia}`.
 * Carimbado 1×/dia pelo job `/api/health/snapshot` (após os syncs de plataforma),
 * para a série de tendência do score (sparkline no perfil/lista). Os pilares
 * podem ser null quando faltam dados (ex.: crescimento sem coleta anterior).
 */
export interface HistoricoHealthDiaDoc {
  /** YYYY-MM-DD. */
  dia: string
  score: number
  audiencia: number | null
  crescimento: number | null
  engajamento: number | null
  conteudo: number | null
  streaming: number | null
  seguidoresTotal: number
  coletadoEm: string
}

/** Documento `integracoes/youtube` — alimenta a página de integrações. */
export interface IntegracaoYouTubeDoc {
  status: StatusIntegracao
  /** Artistas com canal mapeado (channelId gravado) — camada pública. */
  canaisMapeados: number
  /** Artistas que conectaram via OAuth — camada Analytics. */
  contasConectadas: number
  /** Total de artistas no cadastro. */
  totalArtistas: number
  /** Canais que retornaram métricas na última sincronização. */
  contasSincronizadas: number
  /** ISO timestamp. */
  ultimaSincronizacao: string | null
  ultimaDescoberta: string | null
  /** Mensagem do último erro, se houver. */
  erro?: string | null
}

/**
 * Tokens OAuth (Google) de um artista (coleção `youtube-tokens/{slug}`).
 * SERVER-ONLY: contém segredos. As regras do Firestore negam todo acesso pelo
 * client — só o Admin SDK (rotas /api/integracoes/youtube). Os refresh tokens
 * do Google não expiram por tempo (só por revogação/desuso), então não há
 * `refreshExpiraEm`.
 */
export interface YouTubeTokenDoc {
  slug: string
  /** Channel ID (UC...) do canal autorizado, quando descoberto. */
  channelId?: string | null
  accessToken: string
  refreshToken: string
  /** ISO — quando o access token expira (~1h). */
  accessExpiraEm: string
  /** Escopos concedidos (string separada por espaço). */
  scope: string
  atualizadoEm: string
}

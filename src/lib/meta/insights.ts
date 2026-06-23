import { graphGet } from './client'
import type { MetricasInstagram } from './types'
import type { InstagramPostItem } from '@/lib/metricas-sociais/types'

/**
 * Coleta de métricas de uma conta do Instagram Business/Creator. SERVER-ONLY.
 *
 * ⚠️ Os nomes e parâmetros dos insights do Instagram MUDAM entre versões da
 * Graph API. Em particular, na v22 `impressions` foi descontinuado a nível de
 * conta (use `views`) e várias métricas passaram a exigir
 * `metric_type=total_value`. Os valores abaixo assumem v22+/v23. Ao conectar
 * credenciais reais, valide os nomes/parâmetros contra a referência da versão
 * configurada (META_GRAPH_VERSION). A coleta é tolerante a falhas: uma métrica
 * indisponível não derruba as demais (vira `null` + entra em `avisos`).
 */

/** Métricas pedidas como total_value (agregado na janela, period=day). */
const METRICAS_TOTAL_VALUE = [
  'reach',
  'views',
  'profile_views',
  'accounts_engaged',
  'total_interactions',
] as const

interface CamposDiretos {
  username?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
}

interface InsightsResp {
  data?: {
    name: string
    total_value?: { value?: number }
    values?: { value?: number }[]
  }[]
}

export async function buscarMetricas(
  contaId: string,
  username: string,
  janelaDias = 30,
): Promise<MetricasInstagram> {
  const avisos: string[] = []
  const coletadoEm = new Date().toISOString()

  // 1) Campos diretos do nó IG User (estado atual).
  let diretos: CamposDiretos = {}
  try {
    diretos = await graphGet<CamposDiretos>(`/${contaId}`, {
      fields: 'username,followers_count,follows_count,media_count',
    })
  } catch (e) {
    avisos.push(`campos diretos: ${mensagem(e)}`)
  }

  // 2) Insights agregados na janela.
  const until = Math.floor(Date.now() / 1000)
  const since = until - janelaDias * 86_400
  const insights = await buscarInsightsTotalValue(
    contaId,
    METRICAS_TOTAL_VALUE,
    since,
    until,
    avisos,
  )

  return {
    contaId,
    username: diretos.username?.toLowerCase() || username,
    seguidores: numOuNull(diretos.followers_count),
    segue: numOuNull(diretos.follows_count),
    publicacoes: numOuNull(diretos.media_count),
    alcance: numOuNull(insights.get('reach')),
    visualizacoes: numOuNull(insights.get('views')),
    visitasPerfil: numOuNull(insights.get('profile_views')),
    contasEngajadas: numOuNull(insights.get('accounts_engaged')),
    interacoesTotais: numOuNull(insights.get('total_interactions')),
    janelaDias,
    coletadoEm,
    avisos: avisos.length ? avisos : undefined,
  }
}

interface MediaItemResp {
  id?: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

/**
 * Posts recentes da conta (camada de conteúdo) — 1 request com os campos
 * diretos. Tolerante a falha (retorna [] em erro). Para VIDEO/Reels o
 * `thumbnail_url` é a miniatura; para imagens, usa o próprio `media_url`.
 */
export async function buscarMidias(contaId: string, limite = 12): Promise<InstagramPostItem[]> {
  try {
    const resp = await graphGet<{ data?: MediaItemResp[] }>(`/${contaId}/media`, {
      fields:
        'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: limite,
    })
    return (resp.data ?? [])
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id as string,
        legenda: m.caption ?? null,
        tipo: m.media_type ?? null,
        thumbUrl: m.thumbnail_url ?? m.media_url ?? null,
        permalink: m.permalink ?? null,
        publicadoEm: m.timestamp ?? null,
        curtidas: numOuNull(m.like_count),
        comentarios: numOuNull(m.comments_count),
      }))
  } catch {
    return []
  }
}

/**
 * Busca métricas total_value. Tenta em lote (1 request); se o Meta rejeitar o
 * lote (ex.: uma métrica inválida na versão), cai para uma chamada por métrica
 * para que as válidas ainda sejam coletadas.
 */
async function buscarInsightsTotalValue(
  contaId: string,
  metricas: readonly string[],
  since: number,
  until: number,
  avisos: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const aplicar = (resp: InsightsResp) => {
    for (const m of resp.data ?? []) {
      const v =
        m.total_value?.value ??
        m.values?.reduce((s, x) => s + (x.value ?? 0), 0)
      if (typeof v === 'number' && Number.isFinite(v)) out.set(m.name, v)
    }
  }

  try {
    aplicar(
      await graphGet<InsightsResp>(`/${contaId}/insights`, {
        metric: metricas.join(','),
        metric_type: 'total_value',
        period: 'day',
        since,
        until,
      }),
    )
    return out
  } catch {
    // Fallback: métrica por métrica (uma inválida não derruba as outras).
    for (const metric of metricas) {
      try {
        aplicar(
          await graphGet<InsightsResp>(`/${contaId}/insights`, {
            metric,
            metric_type: 'total_value',
            period: 'day',
            since,
            until,
          }),
        )
      } catch (e) {
        avisos.push(`${metric}: ${mensagem(e)}`)
      }
    }
    return out
  }
}

function numOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

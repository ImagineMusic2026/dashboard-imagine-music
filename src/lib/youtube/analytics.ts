import { analyticsGet } from './client'
import type { YouTubeAnalytics } from '@/lib/metricas-sociais/types'

/**
 * Camada PRIVADA do YouTube (YouTube Analytics API, via OAuth do artista).
 * SERVER-ONLY. Traz números que a Data API pública não dá: tempo de exibição,
 * duração média, views e inscritos ganhos/perdidos na janela.
 *
 * Usa `ids=channel==MINE` — opera sobre o canal do token autorizado, sem
 * precisar do channelId. Os dados do Analytics têm ~2-3 dias de atraso, por isso
 * a janela termina ontem.
 */

const METRICAS = 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost'

interface ReportResp {
  columnHeaders?: { name?: string }[]
  rows?: (number | string)[][]
}

export async function buscarAnalytics(
  accessToken: string,
  periodoDias = 28,
): Promise<YouTubeAnalytics> {
  const coletadoEm = new Date().toISOString()
  const fim = new Date(Date.now() - 86_400_000) // ontem (dado tem atraso)
  const inicio = new Date(fim.getTime() - (periodoDias - 1) * 86_400_000)

  const resp = await analyticsGet<ReportResp>('/reports', accessToken, {
    ids: 'channel==MINE',
    startDate: iso(inicio),
    endDate: iso(fim),
    metrics: METRICAS,
  })

  const valores = mapearLinha(resp)
  return {
    periodoDias,
    views: valores.get('views') ?? null,
    minutosExibidos: valores.get('estimatedMinutesWatched') ?? null,
    duracaoMediaSeg: valores.get('averageViewDuration') ?? null,
    inscritosGanhos: valores.get('subscribersGained') ?? null,
    inscritosPerdidos: valores.get('subscribersLost') ?? null,
    coletadoEm,
  }
}

/** Mapeia columnHeaders -> valor da 1ª linha (totais da janela). */
function mapearLinha(resp: ReportResp): Map<string, number> {
  const out = new Map<string, number>()
  const headers = resp.columnHeaders ?? []
  const linha = resp.rows?.[0]
  if (!linha) return out
  headers.forEach((h, i) => {
    const v = Number(linha[i])
    if (h.name && Number.isFinite(v)) out.set(h.name, v)
  })
  return out
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

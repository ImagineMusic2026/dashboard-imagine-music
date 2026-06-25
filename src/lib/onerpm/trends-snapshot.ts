import type { StreamingPlataformaItem, StreamingSnapshot } from '@/lib/metricas-sociais/types'
import type { TrendsArtistaAgg } from './trends-types'

/**
 * Monta o `StreamingSnapshot` persistido a partir do agregado de um artista.
 * Puro (só tipos) — compartilhado entre o script de backfill (`scripts/
 * sync-onerpm-trends.ts`) e a lib do cron (`trends-sync.ts`).
 */

/** YYYY-MM-DD menos N dias (UTC, sem fuso). */
export function isoMenosDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Soma os streams dos últimos `n` dias (relativo ao último dia do artista). */
export function somaJanela(
  porDia: { dia: string; streams: number }[],
  ultimoDia: string,
  n: number,
): number {
  const corte = isoMenosDias(ultimoDia, n - 1)
  return porDia.filter((d) => d.dia >= corte).reduce((s, d) => s + d.streams, 0)
}

export function montarSnapshot(a: TrendsArtistaAgg, coletadoEm: string): StreamingSnapshot {
  const ultimoDia = a.periodo.ate || null

  // funde lojas na plataforma canônica (ex.: vários "spotify*" -> Spotify)
  const platMap = new Map<string, StreamingPlataformaItem>()
  for (const l of a.porLoja) {
    let p = platMap.get(l.plataforma)
    if (!p) {
      p = { plataforma: l.plataforma, corKey: l.corKey, iconeTipo: l.iconeTipo, streams: 0, skips: 0 }
      platMap.set(l.plataforma, p)
    }
    p.streams += l.streams
    p.skips += l.skips
  }

  return {
    periodo: a.periodo,
    streams: a.streams,
    skips: a.skips,
    skipRate: a.skipRate,
    streams7d: ultimoDia ? somaJanela(a.porDia, ultimoDia, 7) : null,
    streams28d: ultimoDia ? somaJanela(a.porDia, ultimoDia, 28) : null,
    porPlataforma: Array.from(platMap.values()).sort((x, y) => y.streams - x.streams),
    porPais: a.porPais.slice(0, 12).map((p) => ({ pais: p.pais, streams: p.streams })),
    faixas: a.porFaixa.length,
    lojas: a.porLoja.map((l) => l.loja),
    artistaNome: a.artistaNome,
    ultimoDia,
    coletadoEm,
  }
}

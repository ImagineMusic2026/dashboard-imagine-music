import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'

/**
 * Sinais BRUTOS de saúde de um artista, extraídos do snapshot de
 * `metricas-sociais` — antes de virar nota.
 *
 * Existe porque agora há DUAS réguas lendo os mesmos sinais: a atual (peso fixo,
 * ver `./score`) e a da metodologia IAOS v1.2 (faixa e peso por estágio, ver
 * `./v12`). Sem esta separação, a segunda régua teria que duplicar a extração —
 * e duas cópias divergem no primeiro ajuste.
 *
 * `null` significa "não medido", nunca zero. Quem normaliza decide o que fazer
 * com a ausência.
 */

const DIA = 86_400_000

export interface SinaisSaude {
  /** Seguidores somados nas redes com dado (IG + YT público + TikTok). */
  seguidoresTotal: number
  /** Variação de seguidores desde a coleta anterior (fração, ex.: 0,003 = 0,3%). */
  crescimentoPct: number | null
  /** Mediana de (curtidas + comentários) por post ÷ seguidores, no Instagram. */
  igRate: number | null
  /** Mediana de views por vídeo ÷ inscritos, no YouTube. */
  ytRate: number | null
  /** Dias desde a publicação mais recente (IG ou YT). */
  diasUltimoPost: number | null
  /** Publicações nos últimos 30 dias (IG + YT). */
  posts30d: number
  /** Streams da janela de 28 dias (OneRPM); `null` quando não há streaming. */
  streams28d: number | null
  /** Streams dos últimos 7 dias, para o momentum. */
  streams7d: number
}

function mediana(arr: number[]): number {
  const a = [...arr].sort((x, y) => x - y)
  const n = a.length
  if (!n) return 0
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}

export function extrairSinais(doc: MetricasSociaisDoc, agora = Date.now()): SinaisSaude {
  const ig = doc.instagram
  const yt = doc.youtube
  const tt = doc.tiktok

  // Audiência — seguidores somados (YT só quando a contagem é pública).
  const igSeg = ig?.seguidores ?? 0
  const ytSeg = yt && !yt.inscritosOcultos ? (yt.inscritos ?? 0) : 0
  const ttSeg = tt?.seguidores ?? 0

  // Crescimento — delta vs a coleta anterior (IG e YT carimbam o "antes";
  // a Display API do TikTok não expõe histórico de seguidores).
  let segAtual = 0
  let segAntes = 0
  let temAntes = false
  if (ig?.seguidores != null && ig.seguidoresAntes != null && ig.seguidoresAntes > 0) {
    segAtual += ig.seguidores
    segAntes += ig.seguidoresAntes
    temAntes = true
  }
  if (
    yt?.inscritos != null &&
    yt.inscritosAntes != null &&
    yt.inscritosAntes > 0 &&
    !yt.inscritosOcultos
  ) {
    segAtual += yt.inscritos
    segAntes += yt.inscritosAntes
    temAntes = true
  }

  // Engajamento — mediana por post / base (resiste a um viral isolado).
  let igRate: number | null = null
  if (ig?.seguidores && ig.seguidores > 0 && ig.postsRecentes?.length) {
    const vals = ig.postsRecentes
      .map((p) => (p.curtidas ?? 0) + (p.comentarios ?? 0))
      .filter((v) => v > 0)
    if (vals.length) igRate = mediana(vals) / ig.seguidores
  }
  let ytRate: number | null = null
  if (yt?.inscritos && yt.inscritos > 0 && yt.videosRecentes?.length) {
    const vals = yt.videosRecentes.map((v) => v.views ?? 0).filter((v) => v > 0)
    if (vals.length) ytRate = mediana(vals) / yt.inscritos
  }

  // Conteúdo — recência + volume a partir das datas de publicação.
  const datas: number[] = []
  for (const p of ig?.postsRecentes ?? []) if (p.publicadoEm) datas.push(Date.parse(p.publicadoEm))
  for (const v of yt?.videosRecentes ?? []) if (v.publicadoEm) datas.push(Date.parse(v.publicadoEm))

  const st = doc.streaming
  return {
    seguidoresTotal: igSeg + ytSeg + ttSeg,
    crescimentoPct: temAntes && segAntes > 0 ? (segAtual - segAntes) / segAntes : null,
    igRate,
    ytRate,
    diasUltimoPost: datas.length ? Math.max(0, (agora - Math.max(...datas)) / DIA) : null,
    posts30d: datas.length ? datas.filter((t) => agora - t <= 30 * DIA).length : 0,
    streams28d: st ? (st.streams28d ?? 0) : null,
    streams7d: st?.streams7d ?? 0,
  }
}

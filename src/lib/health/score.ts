import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'

/**
 * Health Score REAL, derivado dos mesmos snapshots de `metricas-sociais` que
 * alimentam os alertas — sem coleção nova, uma única leitura. Função pura (igual
 * a `derivarAlertas`): entra o mapa slug -> snapshot, sai um score 0-100 por
 * artista, com a composição (breakdown) e os sinais que o explicam.
 *
 * Cinco pilares, cada um 0-100, combinados por média ponderada SÓ sobre os
 * pilares com dado (renormaliza o peso quando algum falta — artista com só uma
 * fonte não é penalizado por não ter as outras):
 *
 *   audiência   (20%)  tamanho da base — log dos seguidores somados (IG+YT+TikTok)
 *   crescimento (15%)  momentum — variação de seguidores desde a coleta anterior
 *   engajamento (25%)  curtidas+comentários/seguidores (IG) e views/inscritos (YT)
 *   conteúdo    (15%)  cadência — recência do último post + volume nos últimos 30d
 *   streaming   (25%)  consumo real — volume (28d, log) + momentum (OneRPM)
 *
 * Honestidade: quem não tem NENHUM sinal (sem snapshot ou tudo nulo) fica de
 * fora — não recebe score falso. Crescimento só conta quando há medição anterior
 * carimbada (2+ syncs); até lá o score é composto pelos outros pilares.
 *
 * Calibração (2026-06-23, medida sobre o roster real via scripts/analise-health.mjs):
 * as taxas de engajamento entram em escala LOG por faixa — a de views/inscritos
 * do YT tem cauda longa (mediana ~70%, p90 ~870% em canais pequenos) e satura todo
 * mundo em 100 numa régua linear. Já audiência e cadência seguem padrões ABSOLUTOS,
 * não a mediana do roster: como metade não posta há meses, mover a meta pra mediana
 * "premiaria" a dormência. Pra recalibrar: rode o script de novo e ajuste as faixas.
 */

export interface SaudeBreakdown {
  audiencia: number | null
  crescimento: number | null
  engajamento: number | null
  conteudo: number | null
  /** Streaming (OneRPM): volume da janela + momentum recente. */
  streaming: number | null
}

export type FaixaSaude = 'excelente' | 'saudavel' | 'atencao' | 'critico'

export interface ArtistaSaude {
  slug: string
  nome: string
  /** Score composto 0-100. */
  score: number
  breakdown: SaudeBreakdown
  /** Seguidores somados nas redes com dado (IG + YT + TikTok). */
  seguidoresTotal: number
  /** Variação % de seguidores desde a coleta anterior (null sem base). */
  crescimentoSegPct: number | null
  faixa: FaixaSaude
  /** Pilar mais fraco, nomeado — usado no bloco "zona de risco". */
  motivoRisco: string | null
}

const DIA = 86_400_000

const PESOS: Record<keyof SaudeBreakdown, number> = {
  audiencia: 0.2,
  crescimento: 0.15,
  engajamento: 0.25,
  conteudo: 0.15,
  streaming: 0.25, // streaming (consumo real) entra com o maior peso, junto do engajamento
}

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n))

function mediana(arr: number[]): number {
  const a = [...arr].sort((x, y) => x - y)
  const n = a.length
  if (!n) return 0
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}

/* ── normalizadores: cada sinal bruto -> 0-100 ───────────────────────────── */

/** 1k → 50, 10k → 67, 100k → 83, 1M → 100 (escala log). */
function pontosAudiencia(total: number): number | null {
  if (total <= 0) return null
  return Math.round(clamp((Math.log10(Math.max(1, total)) / 6) * 100))
}

/** 0% desde a última coleta → 50 (neutro); +1% → 100; −1% → 0. */
function pontosCrescimento(pct: number | null): number | null {
  if (pct == null) return null
  return Math.round(clamp(50 + (pct / 0.01) * 50))
}

/** Normaliza uma taxa pela faixa [lo, hi] em escala log (resiste à cauda longa). */
function logBanda(rate: number, lo: number, hi: number): number {
  if (rate <= 0) return 0
  return clamp(((Math.log10(rate) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * 100))
}

/** Taxa de engajamento por rede, normalizada em log por faixa (ver Calibração). */
function pontosEngajamento(igRate: number | null, ytRate: number | null): number | null {
  const xs: number[] = []
  // IG (curtidas+coment/seguidores): faixa típica 0,3%–5% — 5%+ é excepcional.
  if (igRate != null) xs.push(logBanda(igRate, 0.003, 0.05))
  // YT (views/inscritos): faixa larga 3%–1500% — a cauda explode em canais pequenos.
  if (ytRate != null) xs.push(logBanda(ytRate, 0.03, 15))
  if (!xs.length) return null
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
}

/** Recência do último post (0d → 100, 45d → 0) misturada com volume 30d. */
function pontosConteudo(diasUltimo: number | null, posts30d: number): number | null {
  if (diasUltimo == null) return null
  const recencia = clamp(100 - (diasUltimo / 45) * 100) // ~mensal já é borderline
  const volume = clamp((posts30d / 12) * 100) // ~3 posts/semana satura
  return Math.round(0.6 * recencia + 0.4 * volume)
}

/**
 * Streaming (OneRPM): volume da janela (28d, escala log) + momentum recente
 * (última semana vs média das 3 anteriores). 70% volume / 30% momentum, pra o
 * score refletir o tamanho do consumo sem ficar volátil com um pico isolado.
 */
function pontosStreaming(streams28d: number, streams7d: number): number | null {
  if (streams28d <= 0) return null
  const volume = logBanda(streams28d, 500, 800_000) // 500 → 0, ~20k → 50, 800k+ → 100
  const prior = (streams28d - streams7d) / 3 // média semanal das 3 semanas anteriores
  const momentum = prior > 0 ? clamp(50 + ((streams7d - prior) / prior / 0.5) * 50) : 50
  return Math.round(0.7 * volume + 0.3 * momentum)
}

/** Média ponderada só sobre os pilares presentes (renormaliza os pesos). */
function compor(b: SaudeBreakdown): number {
  let soma = 0
  let peso = 0
  for (const k of Object.keys(PESOS) as (keyof SaudeBreakdown)[]) {
    const v = b[k]
    if (v != null) {
      soma += v * PESOS[k]
      peso += PESOS[k]
    }
  }
  return peso > 0 ? Math.round(soma / peso) : 0
}

function faixaDe(score: number): FaixaSaude {
  if (score >= 80) return 'excelente'
  if (score >= 60) return 'saudavel'
  if (score >= 40) return 'atencao'
  return 'critico'
}

function motivoDominante(b: SaudeBreakdown): string | null {
  const cands: [string, number | null][] = [
    ['Perdendo seguidores', b.crescimento],
    ['Engajamento baixo', b.engajamento],
    ['Postando pouco', b.conteudo],
    ['Audiência pequena', b.audiencia],
    ['Streaming baixo', b.streaming],
  ]
  let pior: string | null = null
  let min = Infinity
  for (const [m, v] of cands) {
    if (v != null && v < min) {
      min = v
      pior = m
    }
  }
  return pior
}

/* ── derivação ───────────────────────────────────────────────────────────── */

export function derivarHealthScores(
  mapa: Map<string, MetricasSociaisDoc>,
  nomePorSlug: Map<string, string>,
): ArtistaSaude[] {
  const out: ArtistaSaude[] = []
  const agora = Date.now()

  for (const [slug, doc] of Array.from(mapa)) {
    const nome = nomePorSlug.get(slug) ?? slug
    const ig = doc.instagram
    const yt = doc.youtube
    const tt = doc.tiktok

    // Audiência — seguidores somados (YT só quando a contagem é pública).
    const igSeg = ig?.seguidores ?? 0
    const ytSeg = yt && !yt.inscritosOcultos ? (yt.inscritos ?? 0) : 0
    const ttSeg = tt?.seguidores ?? 0
    const seguidoresTotal = igSeg + ytSeg + ttSeg

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
    const crescimentoSegPct = temAntes && segAntes > 0 ? (segAtual - segAntes) / segAntes : null

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
    let diasUltimo: number | null = null
    let posts30d = 0
    if (datas.length) {
      diasUltimo = Math.max(0, (agora - Math.max(...datas)) / DIA)
      posts30d = datas.filter((t) => agora - t <= 30 * DIA).length
    }

    const st = doc.streaming
    const breakdown: SaudeBreakdown = {
      audiencia: pontosAudiencia(seguidoresTotal),
      crescimento: pontosCrescimento(crescimentoSegPct),
      engajamento: pontosEngajamento(igRate, ytRate),
      conteudo: pontosConteudo(diasUltimo, posts30d),
      streaming: st ? pontosStreaming(st.streams28d ?? 0, st.streams7d ?? 0) : null,
    }

    // Sem nenhum dos pilares "de base" (social OU streaming) não há score honesto.
    if (
      breakdown.audiencia == null &&
      breakdown.engajamento == null &&
      breakdown.conteudo == null &&
      breakdown.streaming == null
    ) {
      continue
    }

    const score = compor(breakdown)
    const faixa = faixaDe(score)
    out.push({
      slug,
      nome,
      score,
      breakdown,
      seguidoresTotal,
      crescimentoSegPct,
      faixa,
      motivoRisco: faixa === 'atencao' || faixa === 'critico' ? motivoDominante(breakdown) : null,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}

/* ── resumo do portfólio ─────────────────────────────────────────────────── */

export interface ResumoSaude {
  /** Média dos scores (0-100), 0 quando ninguém foi avaliado. */
  media: number
  /** Quantos artistas têm dado suficiente pra ter score. */
  avaliados: number
  distribuicao: Record<FaixaSaude, number>
  /** Composição média do portfólio, pilar a pilar (null sem amostra). */
  breakdownMedio: SaudeBreakdown
}

export function resumirSaude(saudes: ArtistaSaude[]): ResumoSaude {
  const distribuicao: Record<FaixaSaude, number> = {
    excelente: 0,
    saudavel: 0,
    atencao: 0,
    critico: 0,
  }
  const acc: Record<keyof SaudeBreakdown, { soma: number; n: number }> = {
    audiencia: { soma: 0, n: 0 },
    crescimento: { soma: 0, n: 0 },
    engajamento: { soma: 0, n: 0 },
    conteudo: { soma: 0, n: 0 },
    streaming: { soma: 0, n: 0 },
  }
  let somaScore = 0
  for (const s of saudes) {
    distribuicao[s.faixa] += 1
    somaScore += s.score
    for (const k of Object.keys(acc) as (keyof SaudeBreakdown)[]) {
      const v = s.breakdown[k]
      if (v != null) {
        acc[k].soma += v
        acc[k].n += 1
      }
    }
  }
  const mediaDe = (k: keyof SaudeBreakdown) => (acc[k].n ? Math.round(acc[k].soma / acc[k].n) : null)
  return {
    media: saudes.length ? Math.round(somaScore / saudes.length) : 0,
    avaliados: saudes.length,
    distribuicao,
    breakdownMedio: {
      audiencia: mediaDe('audiencia'),
      crescimento: mediaDe('crescimento'),
      engajamento: mediaDe('engajamento'),
      conteudo: mediaDe('conteudo'),
      streaming: mediaDe('streaming'),
    },
  }
}

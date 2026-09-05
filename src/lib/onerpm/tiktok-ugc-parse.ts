import { limparArtista, parseCsv } from './trends-parse'
import { slugify } from './aggregate'
import { resolverSlugArtista } from './trends-aliases'

/**
 * Feed de TIKTOK da OneRPM — `Reports/stats/tiktok/YYYY-MM-DD.csv`.
 *
 * Apareceu no SFTP em 2026-08-07 e NÃO é streaming: é a tração de vídeo por
 * faixa. Colunas:
 *
 *   store, date_stat, country_code, content_type, isrc, product_code,
 *   artist_name, creations, video_views, comments, likes, shares, favorites,
 *   avg_watchtime
 *
 * Duas naturezas em `content_type`, e a diferença importa pro selo:
 *  - `UGC`: vídeo que o PÚBLICO fez usando o som — é o que mede viralização;
 *  - `PGC`: conteúdo oficial (o próprio lançamento).
 *
 * Somar tudo junto esconderia exatamente o que a equipe quer saber, então o
 * agregado guarda o total E a parte de UGC.
 *
 * ⚠️ `avg_watchtime` é MÉDIA (em segundos), não contador: somar dá número sem
 * significado. Agregamos ponderando por views — ver `finalizarUgc`.
 *
 * `date_stat` e `country_code` também entram no agregado (série diária do
 * artista, série da faixa e ranking de países). Eram descartados, e sem eles só
 * dava pra ver o acumulado da janela — a tela de Viralização precisa responder
 * "está subindo?" e "de onde?", que é outra pergunta.
 */

const COLUNAS = [
  'store',
  'date_stat',
  'country_code',
  'content_type',
  'isrc',
  'artist_name',
  'creations',
  'video_views',
] as const

export class TikTokUgcParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokUgcParseError'
  }
}

export interface TikTokUgcRow {
  dia: string
  pais: string
  /** 'UGC' (público) ou 'PGC' (oficial); outros valores passam como vieram. */
  tipo: string
  isrc: string
  artistaNome: string
  criacoes: number
  views: number
  comentarios: number
  curtidas: number
  compartilhamentos: number
  favoritos: number
  /** Segundos, MÉDIA da linha (pondere por views ao agregar). */
  watchtimeMedio: number
}

function num(v: string): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

export function lerLinhasTikTokUgc(buf: Buffer | ArrayBuffer | Uint8Array | string): TikTokUgcRow[] {
  const texto = typeof buf === 'string' ? buf : Buffer.from(buf as ArrayBuffer).toString('utf8')
  const linhas = parseCsv(texto).filter((r) => r.some((c) => c.trim() !== ''))
  if (!linhas.length) throw new TikTokUgcParseError('O arquivo está vazio.')

  const header = linhas[0].map((h) => h.trim().toLowerCase())
  const idx = new Map<string, number>()
  header.forEach((h, i) => idx.set(h, i))

  const faltando = COLUNAS.filter((c) => !idx.has(c))
  if (faltando.length) {
    throw new TikTokUgcParseError(
      `Isto não parece o CSV de TikTok da OneRPM. Faltam as colunas: ${faltando.join(', ')}.`,
    )
  }
  const col = (r: string[], nome: string) => (r[idx.get(nome) ?? -1] ?? '').trim()

  const out: TikTokUgcRow[] = []
  for (let i = 1; i < linhas.length; i++) {
    const r = linhas[i]
    const isrc = col(r, 'isrc').toUpperCase()
    // Linha sem ISRC não tem como virar faixa — é o que a tela mostra.
    if (!isrc) continue
    out.push({
      dia: col(r, 'date_stat'),
      pais: col(r, 'country_code').toUpperCase(),
      tipo: col(r, 'content_type').toUpperCase(),
      isrc,
      artistaNome: limparArtista(col(r, 'artist_name')),
      criacoes: num(col(r, 'creations')),
      views: num(col(r, 'video_views')),
      comentarios: num(col(r, 'comments')),
      curtidas: num(col(r, 'likes')),
      compartilhamentos: num(col(r, 'shares')),
      favoritos: num(col(r, 'favorites')),
      watchtimeMedio: num(col(r, 'avg_watchtime')),
    })
  }
  return out
}

/* ── agregação por artista → faixa ─────────────────────────────────────────── */

interface DiaAcc {
  criacoes: number
  views: number
  criacoesUgc: number
  viewsUgc: number
}

interface PaisAcc {
  criacoesUgc: number
  viewsUgc: number
}

interface FaixaAcc {
  isrc: string
  criacoes: number
  views: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  favoritos: number
  criacoesUgc: number
  viewsUgc: number
  /** Σ(watchtime × views) e Σ(views) — a média ponderada sai na finalização. */
  somaWatch: number
  pesoWatch: number
  /** dia → UGC do dia. Vira série (alinhada a `dias`) só nas faixas do topo. */
  porDia: Map<string, { criacoesUgc: number; viewsUgc: number }>
}

interface ArtistaAcc {
  slug: string
  nome: string
  faixas: Map<string, FaixaAcc>
  de: string
  ate: string
  dias: Map<string, DiaAcc>
  paises: Map<string, PaisAcc>
}

export interface TikTokUgcAcumulador {
  porArtista: Map<string, ArtistaAcc>
}

export function novoAcumuladorUgc(): TikTokUgcAcumulador {
  return { porArtista: new Map() }
}

export function acumularUgc(acc: TikTokUgcAcumulador, linhas: TikTokUgcRow[]): void {
  for (const l of linhas) {
    const slug = resolverSlugArtista(slugify(l.artistaNome))
    // Linha da conta do selo sem artista ("Imagine Music co") não vira perfil.
    if (!slug || slug === 'imagine-music-co') continue

    let a = acc.porArtista.get(slug)
    if (!a) {
      a = {
        slug,
        nome: l.artistaNome,
        faixas: new Map(),
        de: l.dia,
        ate: l.dia,
        dias: new Map(),
        paises: new Map(),
      }
      acc.porArtista.set(slug, a)
    }
    const ugc = l.tipo === 'UGC'

    if (l.dia) {
      if (l.dia < a.de) a.de = l.dia
      if (l.dia > a.ate) a.ate = l.dia
      let d = a.dias.get(l.dia)
      if (!d) {
        d = { criacoes: 0, views: 0, criacoesUgc: 0, viewsUgc: 0 }
        a.dias.set(l.dia, d)
      }
      d.criacoes += l.criacoes
      d.views += l.views
      if (ugc) {
        d.criacoesUgc += l.criacoes
        d.viewsUgc += l.views
      }
    }

    // Geografia só do UGC: o país do conteúdo OFICIAL é outra pergunta (onde o
    // lançamento foi distribuído), e misturar as duas não responde nenhuma.
    if (ugc && l.pais) {
      let p = a.paises.get(l.pais)
      if (!p) {
        p = { criacoesUgc: 0, viewsUgc: 0 }
        a.paises.set(l.pais, p)
      }
      p.criacoesUgc += l.criacoes
      p.viewsUgc += l.views
    }

    let f = a.faixas.get(l.isrc)
    if (!f) {
      f = {
        isrc: l.isrc,
        criacoes: 0,
        views: 0,
        curtidas: 0,
        comentarios: 0,
        compartilhamentos: 0,
        favoritos: 0,
        criacoesUgc: 0,
        viewsUgc: 0,
        somaWatch: 0,
        pesoWatch: 0,
        porDia: new Map(),
      }
      a.faixas.set(l.isrc, f)
    }
    f.criacoes += l.criacoes
    f.views += l.views
    f.curtidas += l.curtidas
    f.comentarios += l.comentarios
    f.compartilhamentos += l.compartilhamentos
    f.favoritos += l.favoritos
    if (ugc) {
      f.criacoesUgc += l.criacoes
      f.viewsUgc += l.views
      if (l.dia) {
        let d = f.porDia.get(l.dia)
        if (!d) {
          d = { criacoesUgc: 0, viewsUgc: 0 }
          f.porDia.set(l.dia, d)
        }
        d.criacoesUgc += l.criacoes
        d.viewsUgc += l.views
      }
    }
    // Média ponderada: linha sem view não tem peso e não puxa a média pra baixo.
    if (l.watchtimeMedio > 0 && l.views > 0) {
      f.somaWatch += l.watchtimeMedio * l.views
      f.pesoWatch += l.views
    }
  }
}

export interface TikTokUgcFaixaItem {
  isrc: string
  criacoes: number
  views: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  favoritos: number
  /** Parte do total feita pelo PÚBLICO (content_type = UGC). */
  criacoesUgc: number
  viewsUgc: number
  /** Segundos, ponderado por views. `null` quando nenhuma linha teve view. */
  watchtimeMedio: number | null
  /** Vídeos do público nos últimos 7 dias COM DADO, e nos 7 anteriores. */
  ugc7: number
  ugcAnt7: number
  /** Views desses vídeos nas mesmas duas janelas. */
  viewsUgc7: number
  viewsUgcAnt7: number
  /**
   * Vídeos do público por dia, alinhado a `dias`. Só as faixas do topo levam
   * série — é o que a tabela desenha como sparkline.
   */
  serieUgc?: number[]
}

export interface TikTokUgcDia {
  dia: string
  criacoes: number
  views: number
  criacoesUgc: number
  viewsUgc: number
}

export interface TikTokUgcPais {
  pais: string
  criacoesUgc: number
  viewsUgc: number
}

/** Duas janelas de 7 dias COM DADO (o feed pula dias), para medir aceleração. */
export interface TikTokUgcTendencia {
  ugc7: number
  ugcAnt7: number
  viewsUgc7: number
  viewsUgcAnt7: number
}

export interface TikTokUgcTotais {
  criacoes: number
  views: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  favoritos: number
  criacoesUgc: number
  viewsUgc: number
  watchtimeMedio: number | null
}

export interface TikTokUgcArtista {
  slug: string
  nome: string
  periodo: { de: string; ate: string; dias: number }
  totais: TikTokUgcTotais
  tendencia: TikTokUgcTendencia
  /** Dias com dado, em ordem — é o eixo X de TODAS as séries do documento. */
  dias: string[]
  porDia: TikTokUgcDia[]
  porPais: TikTokUgcPais[]
  porFaixa: TikTokUgcFaixaItem[]
}

/** Quantas faixas guardar por artista (bound do doc, igual ao detalhe de streaming). */
const TOP_FAIXAS = 150
/** Dias guardados na série. A janela do sync é 35 arquivos; 90 cobre com folga. */
const MAX_DIAS = 90
/** Países no ranking. O resto continua nos totais, só não vira linha na tela. */
const TOP_PAISES = 12
/** Faixas que ganham série própria — sparkline só importa no topo da lista. */
const FAIXAS_COM_SERIE = 25
/** Tamanho da janela de comparação, em dias COM DADO. */
const JANELA = 7

function media(soma: number, peso: number): number | null {
  return peso > 0 ? Math.round((soma / peso) * 100) / 100 : null
}

/** Soma os últimos `JANELA` pontos da série e os `JANELA` anteriores a eles. */
function janelas(serie: number[]): { recente: number; anterior: number } {
  const n = serie.length
  let recente = 0
  let anterior = 0
  for (let i = Math.max(0, n - JANELA); i < n; i++) recente += serie[i]
  for (let i = Math.max(0, n - JANELA * 2); i < n - JANELA; i++) anterior += serie[i]
  return { recente, anterior }
}

export function finalizarUgc(acc: TikTokUgcAcumulador): TikTokUgcArtista[] {
  const out: TikTokUgcArtista[] = []
  acc.porArtista.forEach((a) => {
    const faixas = Array.from(a.faixas.values())
    const totais: TikTokUgcTotais = {
      criacoes: 0,
      views: 0,
      curtidas: 0,
      comentarios: 0,
      compartilhamentos: 0,
      favoritos: 0,
      criacoesUgc: 0,
      viewsUgc: 0,
      watchtimeMedio: null,
    }
    let somaWatch = 0
    let pesoWatch = 0
    for (const f of faixas) {
      totais.criacoes += f.criacoes
      totais.views += f.views
      totais.curtidas += f.curtidas
      totais.comentarios += f.comentarios
      totais.compartilhamentos += f.compartilhamentos
      totais.favoritos += f.favoritos
      totais.criacoesUgc += f.criacoesUgc
      totais.viewsUgc += f.viewsUgc
      somaWatch += f.somaWatch
      pesoWatch += f.pesoWatch
    }
    totais.watchtimeMedio = media(somaWatch, pesoWatch)

    // Eixo X único do documento: quem lê alinha qualquer série a esta lista.
    const dias = Array.from(a.dias.keys()).sort().slice(-MAX_DIAS)
    const porDia: TikTokUgcDia[] = dias.map((d) => {
      const v = a.dias.get(d)!
      return {
        dia: d,
        criacoes: v.criacoes,
        views: v.views,
        criacoesUgc: v.criacoesUgc,
        viewsUgc: v.viewsUgc,
      }
    })

    const jCriacoes = janelas(porDia.map((d) => d.criacoesUgc))
    const jViews = janelas(porDia.map((d) => d.viewsUgc))

    const porPais: TikTokUgcPais[] = Array.from(a.paises.entries())
      .map(([pais, p]) => ({ pais, criacoesUgc: p.criacoesUgc, viewsUgc: p.viewsUgc }))
      .sort((x, y) => y.viewsUgc - x.viewsUgc)
      .slice(0, TOP_PAISES)

    const porFaixa: TikTokUgcFaixaItem[] = faixas
      .map((f) => {
        const serie = dias.map((d) => f.porDia.get(d)?.criacoesUgc ?? 0)
        const c = janelas(serie)
        const v = janelas(dias.map((d) => f.porDia.get(d)?.viewsUgc ?? 0))
        return {
          isrc: f.isrc,
          criacoes: f.criacoes,
          views: f.views,
          curtidas: f.curtidas,
          comentarios: f.comentarios,
          compartilhamentos: f.compartilhamentos,
          favoritos: f.favoritos,
          criacoesUgc: f.criacoesUgc,
          viewsUgc: f.viewsUgc,
          watchtimeMedio: media(f.somaWatch, f.pesoWatch),
          ugc7: c.recente,
          ugcAnt7: c.anterior,
          viewsUgc7: v.recente,
          viewsUgcAnt7: v.anterior,
          serie,
        }
      })
      .sort((x, y) => y.views - x.views)
      .slice(0, TOP_FAIXAS)
      // A série vira campo só no topo: 150 faixas × 90 dias engordaria o doc à
      // toa, e ninguém desenha a curva da faixa nº 90.
      .map(({ serie, ...f }, i) => (i < FAIXAS_COM_SERIE ? { ...f, serieUgc: serie } : f))

    out.push({
      slug: a.slug,
      nome: a.nome,
      // `dias` conta os arquivos que existiram, não o intervalo: o feed pula
      // dias (não houve 10, 17 e 20/08), e dizer "19 dias" seria mentira.
      periodo: { de: a.de, ate: a.ate, dias: a.dias.size },
      totais,
      tendencia: {
        ugc7: jCriacoes.recente,
        ugcAnt7: jCriacoes.anterior,
        viewsUgc7: jViews.recente,
        viewsUgcAnt7: jViews.anterior,
      },
      dias,
      porDia,
      porPais,
      porFaixa,
    })
  })
  return out.sort((x, y) => y.totais.views - x.totais.views)
}

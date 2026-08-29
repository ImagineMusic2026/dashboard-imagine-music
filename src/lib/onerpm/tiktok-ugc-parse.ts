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
}

interface ArtistaAcc {
  slug: string
  nome: string
  faixas: Map<string, FaixaAcc>
  de: string
  ate: string
  dias: Set<string>
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
      a = { slug, nome: l.artistaNome, faixas: new Map(), de: l.dia, ate: l.dia, dias: new Set() }
      acc.porArtista.set(slug, a)
    }
    if (l.dia) {
      if (l.dia < a.de) a.de = l.dia
      if (l.dia > a.ate) a.ate = l.dia
      a.dias.add(l.dia)
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
      }
      a.faixas.set(l.isrc, f)
    }
    f.criacoes += l.criacoes
    f.views += l.views
    f.curtidas += l.curtidas
    f.comentarios += l.comentarios
    f.compartilhamentos += l.compartilhamentos
    f.favoritos += l.favoritos
    if (l.tipo === 'UGC') {
      f.criacoesUgc += l.criacoes
      f.viewsUgc += l.views
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
}

export interface TikTokUgcArtista {
  slug: string
  nome: string
  periodo: { de: string; ate: string; dias: number }
  totais: Omit<TikTokUgcFaixaItem, 'isrc'>
  porFaixa: TikTokUgcFaixaItem[]
}

/** Quantas faixas guardar por artista (bound do doc, igual ao detalhe de streaming). */
const TOP_FAIXAS = 150

function media(soma: number, peso: number): number | null {
  return peso > 0 ? Math.round((soma / peso) * 100) / 100 : null
}

export function finalizarUgc(acc: TikTokUgcAcumulador): TikTokUgcArtista[] {
  const out: TikTokUgcArtista[] = []
  acc.porArtista.forEach((a) => {
    const faixas = Array.from(a.faixas.values())
    const totais = {
      criacoes: 0,
      views: 0,
      curtidas: 0,
      comentarios: 0,
      compartilhamentos: 0,
      favoritos: 0,
      criacoesUgc: 0,
      viewsUgc: 0,
      watchtimeMedio: null as number | null,
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

    const porFaixa: TikTokUgcFaixaItem[] = faixas
      .map((f) => ({
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
      }))
      .sort((x, y) => y.views - x.views)
      .slice(0, TOP_FAIXAS)

    out.push({
      slug: a.slug,
      nome: a.nome,
      // `dias` conta os arquivos que existiram, não o intervalo: o feed pula
      // dias (não houve 10, 17 e 20/08), e dizer "19 dias" seria mentira.
      periodo: { de: a.de, ate: a.ate, dias: a.dias.size },
      totais,
      porFaixa,
    })
  })
  return out.sort((x, y) => y.totais.views - x.totais.views)
}

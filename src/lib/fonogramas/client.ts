import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { memoCurtaPorChave, invalidarCachesDeLeitura } from '@/lib/cache-leitura'

/**
 * Fonogramas do artista — a leitura de `catalogo-faixas` filtrada por
 * `artistaSlug`.
 *
 * Não existe coleção nova: o catálogo já é a fonte (ISRC → título, álbum, UPC,
 * lançamento), montado pelo CSV oficial da OneRPM mais o fallback do Deezer. O
 * que faltava era o DONO de cada faixa, e é isso que
 * `scripts/atribuir-fonogramas.mjs` grava, por duas vias:
 *
 *  - `catalogo`: o performer do CSV da OneRPM bate com um slug do roster;
 *  - `streaming`: o CSV não trouxe performer (2 em cada 3 docs), mas o sync de
 *    streaming já sabia de quem era o ISRC.
 *
 * Uma faixa cadastrada à mão pela equipe fica com `manual`. A procedência
 * aparece na tela porque muda a confiança: catálogo é o documento oficial,
 * streaming é inferência boa, manual é o que a equipe afirmou.
 */

export type OrigemFonograma = 'catalogo' | 'streaming' | 'manual'

export interface Fonograma {
  isrc: string
  titulo: string | null
  album: string | null
  upc: string | null
  /** 'YYYY-MM-DD' quando o catálogo trouxe. */
  releaseDate: string | null
  /** Link pra ouvir (só quando veio do Deezer — o catálogo da OneRPM não tem). */
  link: string | null
  /** Performers segundo o catálogo (grafia da OneRPM). */
  artista: string | null
  artistaSlug?: string | null
  atribuicao?: OrigemFonograma
}

export const origemMeta: Record<OrigemFonograma, { label: string; titulo: string; chip: string }> = {
  catalogo: {
    label: 'Catálogo',
    titulo: 'Veio do catálogo oficial da OneRPM',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  streaming: {
    label: 'Streaming',
    titulo: 'Atribuída pelo relatório de streaming da OneRPM (não está no catálogo oficial)',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  manual: {
    label: 'Manual',
    titulo: 'Cadastrada pela equipe no painel',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
}

/** Teto de faixas lidas por artista. Ver a nota de cota em `listarFonogramas`. */
const MAX = 300

async function lerFonogramas(slug: string): Promise<Fonograma[]> {
  const snap = await getDocs(
    query(collection(db, 'catalogo-faixas'), where('artistaSlug', '==', slug), limit(MAX)),
  )
  return snap.docs
    .map((d) => ({ isrc: d.id, ...(d.data() as Omit<Fonograma, 'isrc'>) }))
    // Mais recente primeiro; sem data vai pro fim (não some, só não lidera).
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
}

const cache = memoCurtaPorChave(lerFonogramas, (slug) => slug)

/**
 * Fonogramas de um artista.
 *
 * A consulta SEMPRE filtra por artista e leva `limit` — nunca varre o catálogo
 * inteiro (1.136 docs hoje). Leitura no Firestore custa por doc lido, e a cota
 * gratuita já derrubou o painel uma vez; o maior artista do roster tem 266
 * faixas, então o teto de 300 cobre todos e ainda protege contra um catálogo
 * que cresça sem ninguém perceber.
 */
export function listarFonogramas(slug: string): Promise<Fonograma[]> {
  return cache(slug)
}

/* ── TikTok por faixa ──────────────────────────────────────────────────────── */

/**
 * Tração de vídeo no TikTok de UMA faixa, na janela do último sync.
 * Vem de `metricas-sociais/{slug}/streaming-detalhe/tiktok-ugc` (feed próprio da
 * OneRPM, ver `tiktok-ugc-parse`). `ugc` é a parte feita pelo PÚBLICO — é o
 * número que diz se a faixa está viralizando, e não se confunde com o
 * desempenho do conteúdo oficial.
 */
export interface TikTokFaixa {
  isrc: string
  criacoes: number
  views: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  favoritos: number
  criacoesUgc: number
  viewsUgc: number
  /** Segundos assistidos em média (ponderado por views). */
  watchtimeMedio: number | null
}

export interface TikTokDoArtista {
  periodo: { de: string; ate: string; dias: number }
  totais: Omit<TikTokFaixa, 'isrc'>
  /** Indexado por ISRC pra o card casar com a lista de fonogramas em O(1). */
  porIsrc: Map<string, TikTokFaixa>
}

async function lerTikTok(slug: string): Promise<TikTokDoArtista | null> {
  const snap = await getDoc(doc(db, 'metricas-sociais', slug, 'streaming-detalhe', 'tiktok-ugc'))
  if (!snap.exists()) return null
  const d = snap.data() as {
    periodo?: TikTokDoArtista['periodo']
    totais?: TikTokDoArtista['totais']
    porFaixa?: TikTokFaixa[]
  }
  const porIsrc = new Map<string, TikTokFaixa>()
  for (const f of d.porFaixa ?? []) porIsrc.set(f.isrc, f)
  if (!d.periodo || !d.totais) return null
  return { periodo: d.periodo, totais: d.totais, porIsrc }
}

const cacheTikTok = memoCurtaPorChave(lerTikTok, (slug) => slug)

/**
 * TikTok por faixa de um artista — UM doc lido, não uma consulta por faixa.
 * `null` quando o artista ainda não apareceu no feed (é o caso comum: a OneRPM
 * só publica isto desde 2026-08-07).
 */
export function getTikTokDoArtista(slug: string): Promise<TikTokDoArtista | null> {
  return cacheTikTok(slug)
}

/** Número curto pra caber no card: 1,2M · 34,5k · 812. */
export function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}k`
  return String(n)
}

export interface DadosFonograma {
  isrc: string
  titulo: string
  album?: string | null
  upc?: string | null
  releaseDate?: string | null
  link?: string | null
}

async function chamarApi(metodo: 'POST' | 'DELETE', corpo: unknown): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('sessao')
  const res = await fetch('/api/fonogramas', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'falha')
  }
  invalidarCachesDeLeitura()
}

/**
 * Cadastra/atualiza um fonograma à mão. Passa por rota (Admin SDK) e não pelo
 * client: esta coleção é também o cache ISRC→título da análise de streaming, e a
 * rota valida o ISRC e os campos antes de encostar nela.
 */
export function salvarFonograma(slug: string, dados: DadosFonograma): Promise<void> {
  return chamarApi('POST', { slug, ...dados })
}

/** Desvincula a faixa do artista. Só o que a equipe cadastrou pode ser apagado. */
export function removerFonograma(isrc: string): Promise<void> {
  return chamarApi('DELETE', { isrc })
}

/** ISRC é sempre 12 alfanuméricos (ex.: BKU822500012). */
export function isrcValido(isrc: string): boolean {
  return /^[A-Za-z0-9]{12}$/.test(isrc.trim())
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM-DD' → 'set 2023'; ano solto quando o catálogo só trouxe o ano. */
export function lancamentoCurto(iso: string | null): string | null {
  if (!iso) return null
  const [a, m] = iso.split('-')
  if (!m) return a || null
  return `${MESES[Number(m) - 1] ?? ''} ${a}`
}

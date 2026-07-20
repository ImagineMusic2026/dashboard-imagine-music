import type { ReceitaPlataforma } from '@/types'
import { onerpmConfig, type OneRpmConfig } from './config'
import type { FaixaAgregada, MoneyByCurrency, OneRpmAggregate } from './types'

/**
 * Exibição da receita da OneRPM — SEMPRE na moeda original, nunca convertida nem
 * somada entre moedas (ver `config.ts`). Os helpers aqui só formatam e escolhem a
 * base (líquido/bruto); quem consolida em outra moeda é a cliente, fora do painel.
 */

const SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: '€' }
const simbolo = (moeda: string) => SIMBOLO[moeda] ?? `${moeda} `

/** Moedas com valor irrisório não poluem a exibição. */
function moedasRelevantes(m: MoneyByCurrency): Array<[string, number]> {
  return Object.entries(m)
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => b[1] - a[1])
}

/** Cada moeda relevante já formatada: ["US$ 24.432,85", "R$ 5.275,36"]. Vazio → []. */
export function formatarMoedasPartes(m: MoneyByCurrency): string[] {
  return moedasRelevantes(m).map(
    ([moeda, v]) =>
      `${simbolo(moeda)} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  )
}

/** "US$ 24.432,85  +  R$ 5.275,36". Vazio vira "—". */
export function formatarMoedas(m: MoneyByCurrency): string {
  const partes = formatarMoedasPartes(m)
  return partes.length ? partes.join('  +  ') : '—'
}

/** Versão curta pra espaços apertados (lista): "US$ 24,4k + R$ 5,3k". */
export function formatarMoedasCompacto(m: MoneyByCurrency): string {
  const curto = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const partes = moedasRelevantes(m).map(([moeda, v]) => `${simbolo(moeda)} ${curto(v)}`)
  return partes.length ? partes.join(' + ') : '—'
}

function valorBase(
  gross: MoneyByCurrency,
  net: MoneyByCurrency,
  cfg: OneRpmConfig
): MoneyByCurrency {
  return cfg.base === 'gross' ? gross : net
}

/**
 * "Magnitude" de um valor por moeda: só pra ORDENAR e dimensionar as barras — NUNCA
 * é exibida como número. Soma as moedas ao pé da letra (US$ e R$ contam igual). Não
 * é uma conversão: como ~90%+ da receita de cada artista está numa moeda só, isso
 * reproduz a ordem real de "quem trouxe mais", sem inventar câmbio.
 */
function magnitude(m: MoneyByCurrency): number {
  return Object.values(m).reduce((a, v) => a + Math.abs(v), 0)
}

/**
 * Converte o agregado no formato que o painel exibe (`ReceitaPlataforma[]`),
 * mantendo a receita POR MOEDA (nunca somada na exibição). A ordem e a barra usam
 * a magnitude acima; a receita ao lado sai em cada moeda, exata.
 */
export function receitaPorPlataformaDisplay(
  agg: Pick<OneRpmAggregate, 'porPlataforma'> & Partial<Pick<OneRpmAggregate, 'artistaNome'>>,
  cfg: OneRpmConfig = onerpmConfig
): ReceitaPlataforma[] {
  // `?? []`: docs gravados por versões antigas do importador não têm o campo, e o
  // tipo declara ele obrigatório — o TS não avisa, mas o Firestore devolve undefined.
  const items = (agg.porPlataforma ?? []).map((p) => {
    const receitaPorMoeda = valorBase(p.grossPorMoeda, p.netPorMoeda, cfg)
    return {
      plataforma: p.plataforma,
      cor: p.corKey,
      streams: p.streams,
      receitaPorMoeda,
      faixas: receitaPorFaixasAgregadasDisplay(p.porFaixa ?? [], agg.artistaNome ?? '', cfg),
      mag: magnitude(receitaPorMoeda),
    }
  })

  const totalMag = items.reduce((a, i) => a + i.mag, 0)
  const out: ReceitaPlataforma[] = items.map((i) => ({
    plataforma: i.plataforma,
    cor: i.cor,
    streams: i.streams,
    receitaPorMoeda: i.receitaPorMoeda,
    faixas: i.faixas,
    percentualTotal: totalMag > 0 ? Math.round((i.mag / totalMag) * 100) : 0,
  }))
  out.sort((a, b) => magnitude(b.receitaPorMoeda) - magnitude(a.receitaPorMoeda))
  return out
}

export interface FaixaReceita {
  titulo: string
  streams: number
  receitaPorMoeda: MoneyByCurrency
  /** Quantos lançamentos/ISRCs diferentes foram agrupados nesta música. */
  lancamentos: number
}

const semAcentoLower = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Nome "canônico" da música pra agrupar lançamentos.
 *
 * O vídeo do YouTube vem com o título inteiro: "BODY SPLASH - Netto Brito | Pra
 * Encher e Derramar 3.0". Tiramos o que vem depois do " | " (o álbum) e, se sobrar
 * " - <artista>" no fim, removemos — daí "Body Splash" e a versão-vídeo caem no
 * mesmo balde. NÃO cortamos em qualquer " - ": vídeos como "NETTO BRITO - Retro..."
 * começam com o nome do artista e seriam todos fundidos num balde errado.
 *
 * Heurístico, mas conservador: na dúvida, mantém separado. O dado por lançamento
 * continua guardado — dá pra detalhar depois.
 */
function chaveMusica(titulo: string, artistaNome: string): string {
  let base = titulo.split(' | ')[0].trim()
  const artista = semAcentoLower(artistaNome).trim()
  if (artista) {
    // Remove " - Artista" só quando é sufixo do título (padrão "MÚSICA - Artista").
    const semAcento = semAcentoLower(base)
    const sufixo = ` - ${artista}`
    if (semAcento.endsWith(sufixo)) base = base.slice(0, base.length - sufixo.length)
  }
  return semAcentoLower(base).replace(/\s+/g, ' ').trim()
}

function receitaPorFaixasAgregadasDisplay(
  faixas: FaixaAgregada[],
  artistaNome = '',
  cfg: OneRpmConfig = onerpmConfig
): FaixaReceita[] {
  const grupos = new Map<string, FaixaReceita>()

  for (const f of faixas) {
    const titulo = (f.titulo ?? '').trim() || '(sem título)'
    const key = chaveMusica(titulo, artistaNome) || semAcentoLower(titulo)
    let g = grupos.get(key)
    if (!g) {
      g = { titulo, streams: 0, receitaPorMoeda: {}, lancamentos: 0 }
      grupos.set(key, g)
    }
    // Título de exibição: o mais curto (evita o título-longo de vídeo do YouTube).
    if (titulo.length < g.titulo.length) g.titulo = titulo
    g.streams += f.streams
    g.lancamentos++
    const valor = cfg.base === 'gross' ? f.grossPorMoeda : f.netPorMoeda
    for (const [moeda, v] of Object.entries(valor)) {
      g.receitaPorMoeda[moeda] = (g.receitaPorMoeda[moeda] ?? 0) + v
    }
  }

  return Array.from(grupos.values()).sort(
    (a, b) => magnitude(b.receitaPorMoeda) - magnitude(a.receitaPorMoeda)
  )
}

/**
 * Receita por MÚSICA (agrupa lançamentos), na moeda original, ordenada por receita.
 * Lê `agg.porFaixa` — que já vem por moeda; some se o artista não tiver faixas.
 * `artistaNome` desgruda o título-longo dos vídeos do nome do artista.
 */
export function receitaPorFaixaDisplay(
  agg: Pick<OneRpmAggregate, 'porFaixa'>,
  artistaNome = '',
  cfg: OneRpmConfig = onerpmConfig
): FaixaReceita[] {
  // `?? []` pelo mesmo motivo de `receitaPorPlataformaDisplay`: sem isto, um doc
  // antigo com `agregado` mas sem `porFaixa` derruba o card inteiro num TypeError.
  return receitaPorFaixasAgregadasDisplay(agg.porFaixa ?? [], artistaNome, cfg)
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-04" -> "abr/2026". Devolve a entrada crua se não for um "YYYY-MM". */
function mesLabel(ym: string): string {
  const [ano, mes] = (ym ?? '').split('-')
  const nome = MESES_CURTOS[Number(mes) - 1]
  return nome && ano ? `${nome}/${ano}` : ym
}

function faixaDeMeses(de: string, ate: string): string {
  return de === ate ? mesLabel(de) : `${mesLabel(de)} – ${mesLabel(ate)}`
}

/**
 * Rótulo de um relatório: o mês de LANÇAMENTO — "o que a OneRPM pagou em abril".
 *
 * A distinção importa. O relatório de abril traz consumo desde jan/2024, então
 * rotulá-lo pela faixa de consumo ("2024-01 → 2026-03") não diz nada a quem acabou
 * de subir um arquivo chamado "abril". O mês de lançamento é o que identifica o
 * arquivo, e é dele que sai o `periodoKey`.
 */
export function periodoLabel(periodo: OneRpmAggregate['periodo'] | undefined): string {
  const ym = (s: string | null | undefined) => (s ? s.slice(0, 7) : null)
  const de = ym(periodo?.accountedFrom)
  const ate = ym(periodo?.accountedTo)
  if (de && ate) return faixaDeMeses(de, ate)

  // Sem data de lançamento, o consumo é o melhor que temos.
  const meses = periodo?.transactionMonths ?? []
  if (meses.length) return faixaDeMeses(meses[0], meses[meses.length - 1])
  return 'sem período'
}

/** Faixa de CONSUMO coberta pelo relatório — contexto, não identidade. */
export function consumoLabel(periodo: OneRpmAggregate['periodo'] | undefined): string {
  const meses = periodo?.transactionMonths ?? []
  if (!meses.length) return '—'
  return faixaDeMeses(meses[0], meses[meses.length - 1])
}

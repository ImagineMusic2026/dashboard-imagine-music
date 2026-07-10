import type { ReceitaPlataforma } from '@/types'
import { onerpmConfig, type OneRpmConfig } from './config'
import type { MoneyByCurrency, OneRpmAggregate } from './types'

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

/** "US$ 24.432,85  +  R$ 5.275,36". Vazio vira "—". */
export function formatarMoedas(m: MoneyByCurrency): string {
  const partes = moedasRelevantes(m).map(
    ([moeda, v]) =>
      `${simbolo(moeda)} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  )
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
  agg: Pick<OneRpmAggregate, 'porPlataforma'>,
  cfg: OneRpmConfig = onerpmConfig
): ReceitaPlataforma[] {
  const items = agg.porPlataforma.map((p) => {
    const receitaPorMoeda = valorBase(p.grossPorMoeda, p.netPorMoeda, cfg)
    return { plataforma: p.plataforma, cor: p.corKey, streams: p.streams, receitaPorMoeda, mag: magnitude(receitaPorMoeda) }
  })

  const totalMag = items.reduce((a, i) => a + i.mag, 0)
  const out: ReceitaPlataforma[] = items.map((i) => ({
    plataforma: i.plataforma,
    cor: i.cor,
    streams: i.streams,
    receitaPorMoeda: i.receitaPorMoeda,
    percentualTotal: totalMag > 0 ? Math.round((i.mag / totalMag) * 100) : 0,
  }))
  out.sort((a, b) => magnitude(b.receitaPorMoeda) - magnitude(a.receitaPorMoeda))
  return out
}

import type { ReceitaPlataforma } from '@/types'
import { onerpmConfig, type OneRpmConfig } from './config'
import type { MoneyByCurrency, OneRpmAggregate } from './types'

/** Converte um valor por moeda para BRL usando a taxa configurada. */
export function paraBRL(m: MoneyByCurrency, cfg: OneRpmConfig = onerpmConfig): number {
  let total = 0
  for (const [moeda, v] of Object.entries(m)) {
    const taxa = cfg.cambioParaBRL[moeda] ?? cfg.cambioParaBRL.USD ?? 1
    total += v * taxa
  }
  return total
}

function valorBase(
  gross: MoneyByCurrency,
  net: MoneyByCurrency,
  cfg: OneRpmConfig
): MoneyByCurrency {
  return cfg.base === 'gross' ? gross : net
}

/**
 * Converte o agregado da OneRPM no formato que o painel já usa
 * (`ReceitaPlataforma[]`), aplicando base (net/gross) e câmbio do `config`.
 *
 * Observações honestas sobre os campos:
 * - `variacao`: 0 — um arquivo só não tem período anterior pra comparar.
 *   (Quando houver mais de uma importação, dá pra calcular a variação real.)
 * - `percentualTotal`: participação na receita do próprio arquivo.
 */
export function receitaPorPlataformaDisplay(
  agg: Pick<OneRpmAggregate, 'porPlataforma'>,
  cfg: OneRpmConfig = onerpmConfig
): ReceitaPlataforma[] {
  const items = agg.porPlataforma.map((p) => ({
    plataforma: p.plataforma,
    cor: p.corKey,
    streams: p.streams,
    receita: paraBRL(valorBase(p.grossPorMoeda, p.netPorMoeda, cfg), cfg),
    variacao: 0,
    percentualTotal: 0,
  }))

  const total = items.reduce((a, i) => a + i.receita, 0)
  for (const i of items) {
    i.percentualTotal = total > 0 ? Math.round((i.receita / total) * 100) : 0
  }
  items.sort((a, b) => b.receita - a.receita)
  return items
}

/** Total de receita em BRL, já aplicando base + câmbio. Serve pro artista e pro lote. */
export function totalReceitaBRL(
  agg: Pick<OneRpmAggregate, 'totais'>,
  cfg: OneRpmConfig = onerpmConfig
): number {
  return paraBRL(valorBase(agg.totais.grossPorMoeda, agg.totais.netPorMoeda, cfg), cfg)
}

/**
 * Repasse ao selo em BRL. Só existe em `net` (a aba de shares não tem bruto/líquido
 * separados), então o `base: 'gross'` do config não se aplica aqui.
 */
export function repasseAoSeloBRL(m: MoneyByCurrency, cfg: OneRpmConfig = onerpmConfig): number {
  return paraBRL(m, cfg)
}

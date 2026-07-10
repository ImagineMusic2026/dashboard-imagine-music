/**
 * Decisões de EXIBIÇÃO da receita da OneRPM.
 *
 * A cliente pediu para ver os valores NA MOEDA ORIGINAL (dólar como dólar, real
 * como real): ela fecha o câmbio manualmente na data em que o artista saca, então
 * um câmbio fixo no painel estaria sempre errado. Por isso NÃO convertemos moedas
 * — cada moeda é exibida separada, nunca somada.
 *
 * No Firestore guardamos os valores por moeda (bruto e líquido), então a única
 * decisão que sobra aqui é qual base mostrar.
 */

export type BaseValor = 'net' | 'gross'

export interface OneRpmConfig {
  /** Exibir valor LÍQUIDO (`net`, o que sobra) ou BRUTO (`gross`). Default: net. */
  base: BaseValor
}

export const onerpmConfig: OneRpmConfig = {
  base: 'net',
}

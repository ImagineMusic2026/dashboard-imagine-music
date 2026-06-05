/**
 * Decisões de EXIBIÇÃO da receita da OneRPM que ainda dependem de definição da
 * cliente (são justamente as perguntas da reunião). Ficam centralizadas aqui de
 * propósito: quando ela decidir, muda-se só este arquivo — o resto do app lê daqui.
 *
 * Importante: no Firestore guardamos os valores ORIGINAIS por moeda (bruto e
 * líquido). Então, se a base ou o câmbio mudarem, dá pra recalcular a exibição
 * sem reimportar nada.
 */

export type BaseValor = 'net' | 'gross'

export interface OneRpmConfig {
  /** Exibir valor LÍQUIDO (`net`, o que sobra) ou BRUTO (`gross`). Default: net. */
  base: BaseValor
  /** Moeda consolidada de exibição. O painel hoje formata em R$. */
  moedaExibicao: 'BRL'
  /**
   * Taxa de câmbio p/ consolidar tudo em BRL.
   * ⚠️ PLACEHOLDER — a cliente ainda vai definir fonte e critério (câmbio do dia?
   * do fechamento do mês?). O valor por moeda original fica guardado, então é só
   * ajustar aqui depois.
   */
  cambioParaBRL: Record<string, number>
}

export const onerpmConfig: OneRpmConfig = {
  base: 'net',
  moedaExibicao: 'BRL',
  cambioParaBRL: {
    BRL: 1,
    USD: 5.0, // placeholder — ajustar conforme decisão da cliente
    EUR: 6.0, // placeholder
  },
}

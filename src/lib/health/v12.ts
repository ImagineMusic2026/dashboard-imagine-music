import type { Estagio } from '@/lib/iaos/ige'
import type { SinaisSaude } from './sinais'

/**
 * Health Score na régua **IAOS-DOC-02 v1.2** — quatro pilares, com faixa
 * esperada E peso variando por Estágio.
 *
 * Diferença central para a régua atual (`./score`): lá a audiência é o 5º pilar
 * e todos os artistas são medidos pela mesma régua. Aqui a audiência saiu (virou
 * o componente de 30% do IGE, ver `@/lib/iaos/ige`) e cada métrica é comparada
 * com o que se espera DO PORTE do artista.
 *
 * ⚠️ Prévia. Enquanto a Imagine não homologar os parâmetros abaixo, esta régua
 * NÃO substitui o score oficial — aparece ao lado dele, para comparação. Trocar
 * é mudar quem chama `derivarHealthScores`; nada aqui depende disso.
 *
 * ── De onde vieram os números ──────────────────────────────────────────────
 *
 * A v1.2 manda comparar cada métrica com "a faixa esperada para o Estágio", mas
 * NÃO publica as faixas. Estas foram calibradas sobre o roster real em
 * 2026-09-04 (96 artistas), com dois critérios explícitos:
 *
 *  1. Onde havia amostra, a MEDIANA do estágio pontua ~50 ("saúde intermediária
 *     para o estágio", que é a definição da faixa do meio na própria v1.2).
 *  2. Onde a amostra é pequena (Desenvolvimento n=4, Consolidação n=4,
 *     Mainstream n=3), a escada é suavizada para ser monótona em vez de colar
 *     no ruído de três artistas.
 *
 * O sinal que mais justifica a mudança: views/inscritos tem mediana de 87% na
 * Descoberta e 5,1% no Mainstream — 17× de diferença. A régua única de hoje
 * (3%–1500% para todo mundo) infla canal pequeno e pune canal grande, que é
 * exatamente o que a v1.2 diz que não pode acontecer.
 *
 * ⚠️ Conteúdo NÃO é adaptativo, de propósito. A v1.2 nomeia crescimento e
 * engajamento como as métricas que não podem ter régua única — cadência não
 * entra nessa lista. E calibrar cadência pelo roster premiaria a dormência: a
 * mediana da Descoberta é 139 dias sem publicar.
 *
 * ⚠️ Crescimento também é referência de mercado, não mediana do roster: a
 * variação diária de seguidores é 0,00% para a maioria (as plataformas
 * arredondam a contagem de canais pequenos), então a mediana não informa nada.
 * As metas abaixo equivalem a ~6%/mês na Descoberta e ~2%/mês no Mainstream.
 */

export interface ParametrosEstagio {
  /** Pesos dos 4 pilares — vêm da tabela oficial da v1.2. */
  pesos: { crescimento: number; engajamento: number; conteudo: number; streaming: number }
  /** Variação de seguidores por coleta (≈ diária) que vale 100 pontos. */
  crescimentoMeta: number
  /** Banda log de (curtidas+comentários)/seguidores no Instagram: [0 pontos, 100 pontos]. */
  igRate: [number, number]
  /** Banda log de views/inscritos no YouTube. */
  ytRate: [number, number]
  /** Banda log de streams na janela de 28 dias. */
  streams: [number, number]
}

/**
 * ÚNICO ponto de ajuste da régua. Quando a Imagine devolver as faixas oficiais,
 * é esta tabela que muda — nada mais.
 *
 * `pre-descoberta` herda os pesos de `descoberta`: a v1.2 define cinco estágios
 * mas só publica quatro linhas de peso. Decisão registrada como provisória.
 */
export const PARAMETROS_V12: Record<Estagio, ParametrosEstagio> = {
  'pre-descoberta': {
    pesos: { crescimento: 0.45, engajamento: 0.15, conteudo: 0.3, streaming: 0.1 },
    crescimentoMeta: 0.0025,
    igRate: [0.003, 0.06],
    ytRate: [0.15, 4.5],
    streams: [10, 1_000],
  },
  descoberta: {
    pesos: { crescimento: 0.45, engajamento: 0.15, conteudo: 0.3, streaming: 0.1 },
    crescimentoMeta: 0.002,
    igRate: [0.003, 0.06],
    ytRate: [0.12, 3.6],
    streams: [30, 3_000],
  },
  desenvolvimento: {
    pesos: { crescimento: 0.2, engajamento: 0.35, conteudo: 0.15, streaming: 0.3 },
    crescimentoMeta: 0.0015,
    igRate: [0.003, 0.05],
    ytRate: [0.025, 0.75],
    streams: [1_500, 150_000],
  },
  consolidacao: {
    pesos: { crescimento: 0.15, engajamento: 0.3, conteudo: 0.2, streaming: 0.35 },
    crescimentoMeta: 0.001,
    igRate: [0.0025, 0.04],
    ytRate: [0.012, 0.36],
    streams: [12_000, 1_200_000],
  },
  mainstream: {
    pesos: { crescimento: 0.15, engajamento: 0.25, conteudo: 0.2, streaming: 0.4 },
    crescimentoMeta: 0.0007,
    igRate: [0.002, 0.035],
    ytRate: [0.01, 0.3],
    streams: [50_000, 5_000_000],
  },
}

/** Cadência: absoluta em todos os estágios (ver a nota no topo). */
const RECENCIA_ZERA_EM_DIAS = 45
const VOLUME_SATURA_EM_POSTS = 12

export type FaixaV12 = 'forte' | 'adequada' | 'intermediaria' | 'fragil' | 'critica'

export const FAIXAS_V12: Record<FaixaV12, { titulo: string; leitura: string; cor: string }> = {
  forte: {
    titulo: 'Saúde forte',
    leitura: 'Forte para o estágio.',
    cor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  },
  adequada: {
    titulo: 'Adequada',
    leitura: 'Saúde adequada, com oportunidades de otimização.',
    cor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25',
  },
  intermediaria: {
    titulo: 'Intermediária',
    leitura: 'Saúde intermediária, com gargalos relevantes.',
    cor: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  },
  fragil: {
    titulo: 'Frágil',
    leitura: 'Saúde frágil para o estágio.',
    cor: 'text-orange-300 bg-orange-500/10 border-orange-500/25',
  },
  critica: {
    titulo: 'Crítica',
    leitura: 'Saúde crítica para o estágio.',
    cor: 'text-red-300 bg-red-500/10 border-red-500/25',
  },
}

/**
 * Faixas da v1.2. A metodologia junta "crítica OU dados insuficientes" na mesma
 * linha; aqui NÃO — quem não tem sinal continua sem score, como já era. Dizer
 * "crítico" para quem nunca foi medido é a mentira que o §8 manda evitar.
 */
export function faixaV12(score: number): FaixaV12 {
  if (score >= 80) return 'forte'
  if (score >= 65) return 'adequada'
  if (score >= 50) return 'intermediaria'
  if (score >= 35) return 'fragil'
  return 'critica'
}

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n))

function logBanda(rate: number, [lo, hi]: [number, number]): number {
  if (rate <= 0) return 0
  return clamp(((Math.log10(rate) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100)
}

export interface BreakdownV12 {
  crescimento: number | null
  engajamento: number | null
  conteudo: number | null
  streaming: number | null
}

export interface ResultadoHealthV12 {
  score: number
  faixa: FaixaV12
  breakdown: BreakdownV12
  /** Pesos aplicados, já em função do estágio — a UI rotula com eles. */
  pesos: ParametrosEstagio['pesos']
  /** Fração do peso coberta pelos pilares com dado (0-1). */
  cobertura: number
  estagio: Estagio
}

/**
 * Aplica a régua do estágio aos sinais brutos. `null` quando nenhum dos quatro
 * pilares tem dado — sem sinal não há nota, igual à régua atual.
 */
export function calcularHealthV12(s: SinaisSaude, estagio: Estagio): ResultadoHealthV12 | null {
  const p = PARAMETROS_V12[estagio]

  const crescimento =
    s.crescimentoPct == null
      ? null
      : Math.round(clamp(50 + (s.crescimentoPct / p.crescimentoMeta) * 50))

  const taxas: number[] = []
  if (s.igRate != null) taxas.push(logBanda(s.igRate, p.igRate))
  if (s.ytRate != null) taxas.push(logBanda(s.ytRate, p.ytRate))
  const engajamento = taxas.length
    ? Math.round(taxas.reduce((a, b) => a + b, 0) / taxas.length)
    : null

  const conteudo =
    s.diasUltimoPost == null
      ? null
      : Math.round(
          0.6 * clamp(100 - (s.diasUltimoPost / RECENCIA_ZERA_EM_DIAS) * 100) +
            0.4 * clamp((s.posts30d / VOLUME_SATURA_EM_POSTS) * 100),
        )

  let streaming: number | null = null
  if (s.streams28d != null && s.streams28d > 0) {
    const volume = logBanda(s.streams28d, p.streams)
    const anterior = (s.streams28d - s.streams7d) / 3
    const momentum =
      anterior > 0 ? clamp(50 + ((s.streams7d - anterior) / anterior / 0.5) * 50) : 50
    streaming = Math.round(0.7 * volume + 0.3 * momentum)
  }

  const breakdown: BreakdownV12 = { crescimento, engajamento, conteudo, streaming }

  let soma = 0
  let peso = 0
  for (const k of Object.keys(p.pesos) as (keyof BreakdownV12)[]) {
    const v = breakdown[k]
    if (v != null) {
      soma += v * p.pesos[k]
      peso += p.pesos[k]
    }
  }
  if (peso <= 0) return null

  const score = Math.round(soma / peso)
  return { score, faixa: faixaV12(score), breakdown, pesos: p.pesos, cobertura: peso, estagio }
}

export const ROTULO_PILAR_V12: Record<keyof BreakdownV12, string> = {
  crescimento: 'Crescimento',
  engajamento: 'Engajamento',
  conteudo: 'Conteúdo',
  streaming: 'Streaming',
}

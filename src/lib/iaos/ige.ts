/**
 * IGE — Índice Geral de Estágio (metodologia IAOS-DOC-02 v1.2, 04/09/2026).
 *
 * Função pura, sem I/O: entram os sinais, sai o índice 0-100, a cobertura e o
 * Estágio. Fica separada do Health Score de propósito — a v1.2 existe justamente
 * para não confundir PORTE (o que o IGE mede) com SAÚDE (o que o Health Score
 * mede). Ver `@/lib/health/score`, que segue independente.
 *
 * Quatro componentes ponderados:
 *
 *   audiência ajustada  30%  Instagram + TikTok + YouTube (painel)
 *   consumo             40%  Spotify monthly listeners + YouTube views/28d (Soundcharts)
 *   airplay             20%  execuções em rádio/28d (Soundcharts)
 *   mercado ao vivo     10%  classificação declarada pela equipe
 *
 * ⚠️ HOJE só 40% é apurável: consumo e airplay dependem do Soundcharts, que ainda
 * não está integrado. Por isso o índice SEMPRE carrega a cobertura junto, e o
 * Estágio sai marcado como provisório enquanto ela não fechar em 100%.
 */

export const METODOLOGIA = 'IAOS-DOC-02 v1.2'

export type ComponenteIge = 'audiencia' | 'consumo' | 'airplay' | 'mercadoAoVivo'

export const PESOS_IGE: Record<ComponenteIge, number> = {
  audiencia: 0.3,
  consumo: 0.4,
  airplay: 0.2,
  mercadoAoVivo: 0.1,
}

export const ROTULO_COMPONENTE: Record<ComponenteIge, string> = {
  audiencia: 'Audiência ajustada',
  consumo: 'Consumo musical e audiovisual',
  airplay: 'Airplay',
  mercadoAoVivo: 'Mercado ao vivo',
}

/* ── audiência (30%) ───────────────────────────────────────────────────────── */

/**
 * Fator de equilíbrio pela participação da maior plataforma (tabela da v1.2).
 * Quanto mais concentrada a audiência numa rede só, mais ela é descontada.
 */
export function fatorEquilibrio(participacaoMaior: number): number {
  if (participacaoMaior <= 0.45) return 1.0
  if (participacaoMaior <= 0.6) return 0.9
  if (participacaoMaior <= 0.75) return 0.75
  if (participacaoMaior <= 0.9) return 0.6
  return 0.4
}

/** Cortes de porte da v1.1 preservados, agora como pontuação parcial do IGE. */
export function scoreAudiencia(ajustada: number): number {
  if (ajustada < 50_000) return 20
  if (ajustada < 100_000) return 40
  if (ajustada < 1_000_000) return 60
  if (ajustada < 5_000_000) return 80
  return 100
}

export interface SinaisAudiencia {
  /** Seguidores. `null` = rede não medida (≠ zero seguidores). */
  instagram: number | null
  tiktok: number | null
  /** Inscritos do YouTube; `null` quando a contagem é oculta ou não coletada. */
  youtube: number | null
}

export interface ResultadoAudiencia {
  bruta: number
  ajustada: number
  score: number
  /** Quantas das três redes têm medição (0-3). */
  redesMedidas: number
  /** Participação da maior rede sobre a bruta (0-1); `null` sem base. */
  participacaoMaior: number | null
  fator: number
  /**
   * `false` quando o fator NÃO foi aplicado por falta de base de comparação.
   * Ver a nota de desvio abaixo.
   */
  fatorAplicado: boolean
}

/**
 * Audiência bruta e ajustada.
 *
 * ⚠️ DESVIO CONSCIENTE DA v1.2, pendente de confirmação com a Imagine: o fator de
 * equilíbrio só é aplicado quando há PELO MENOS DUAS redes medidas.
 *
 * Motivo, medido no roster real em 2026-09-04: o painel mede as três redes de
 * apenas 9 dos 96 artistas (Instagram coletado em 11, TikTok em 13 — não por
 * falta de cadastro, mas porque a coleta exige conta business no Meta e OAuth
 * individual no TikTok). Aplicando a tabela ao pé da letra, 74 de 86 artistas
 * cairiam no fator 0,40 ("audiência quase isolada") — e 71 deles têm UMA rede
 * medida. O corte de 60% puniria buraco de coleta, não concentração real, o que
 * contraria o §8 da própria metodologia: "ausência de dado não equivale a zero".
 *
 * Com uma rede só não há evidência de distribuição nenhuma — nem boa nem ruim.
 * O fator fica em 1,00 e `fatorAplicado: false` sinaliza isso na tela, para a
 * leitura não passar por completa. Nada é redistribuído em silêncio.
 */
export function calcularAudiencia(s: SinaisAudiencia): ResultadoAudiencia | null {
  const valores = [s.instagram, s.tiktok, s.youtube].filter(
    (v): v is number => v != null && v > 0,
  )
  if (!valores.length) return null

  const bruta = valores.reduce((a, b) => a + b, 0)
  const participacaoMaior = bruta > 0 ? Math.max(...valores) / bruta : null
  const podeAvaliarEquilibrio = valores.length >= 2
  const fator =
    podeAvaliarEquilibrio && participacaoMaior != null ? fatorEquilibrio(participacaoMaior) : 1
  const ajustada = Math.round(bruta * fator)

  return {
    bruta,
    ajustada,
    score: scoreAudiencia(ajustada),
    redesMedidas: valores.length,
    participacaoMaior,
    fator,
    fatorAplicado: podeAvaliarEquilibrio,
  }
}

/* ── mercado ao vivo (10%) ─────────────────────────────────────────────────── */

export interface NivelMercadoAoVivo {
  nivel: number
  score: number
  titulo: string
  referencia: string
}

/**
 * Os seis níveis declaratórios, transcritos da v1.2. A equipe escolhe a
 * descrição; o score vem junto (ela nunca digita nota).
 *
 * O nível 0 vale 5, não 0 — é o que a tabela oficial define.
 */
export const NIVEIS_MERCADO_AO_VIVO: NivelMercadoAoVivo[] = [
  {
    nivel: 0,
    score: 5,
    titulo: 'Mercado praticamente inativo',
    referencia:
      'Sem rotina consistente de venda; shows inexistentes ou muito esporádicos; ausência de carteira ativa; atuação sem recorrência e sem evidência de demanda organizada.',
  },
  {
    nivel: 1,
    score: 20,
    titulo: 'Operação inicial / irregular',
    referencia:
      'Alguns shows pontuais, baixa frequência mensal, dependência de oportunidades isoladas; carteira pequena ou informal; atuação predominantemente local.',
  },
  {
    nivel: 2,
    score: 40,
    titulo: 'Mercado local ativo',
    referencia:
      'Agenda recorrente em parte do ano; volume mensal identificável; carteira de clientes em formação; predominância municipal/microrregional; primeiros shows ingressados ou experiências de bilheteria podem existir.',
  },
  {
    nivel: 3,
    score: 60,
    titulo: 'Mercado regional estruturado',
    referencia:
      'Boa recorrência de shows; presença em múltiplas cidades e/ou estados da região; carteira ativa e recompra; combinação mais saudável de contratantes; shows ingressados com alguma regularidade e maior previsibilidade.',
  },
  {
    nivel: 4,
    score: 80,
    titulo: 'Mercado consolidado / multirregional',
    referencia:
      'Agenda forte e relativamente previsível; circulação em diferentes regiões/estados; carteira diversificada e recorrente; presença relevante de shows ingressados; demanda comercial consistente e menor dependência de poucos compradores.',
  },
  {
    nivel: 5,
    score: 100,
    titulo: 'Alta demanda / escala nacional',
    referencia:
      'Volume elevado e contínuo; ampla distribuição geográfica; carteira robusta e diversificada; forte recorrência; shows ingressados relevantes; capacidade comprovada de mobilização e venda em escala nacional.',
  },
]

export function nivelMercadoAoVivo(nivel: number): NivelMercadoAoVivo | null {
  return NIVEIS_MERCADO_AO_VIVO.find((n) => n.nivel === nivel) ?? null
}

/* ── estágio ───────────────────────────────────────────────────────────────── */

export type Estagio =
  | 'pre-descoberta'
  | 'descoberta'
  | 'desenvolvimento'
  | 'consolidacao'
  | 'mainstream'

export const ESTAGIOS: Record<Estagio, { titulo: string; leitura: string; cor: string }> = {
  'pre-descoberta': {
    titulo: 'Pré-descoberta',
    leitura: 'Escala ainda incipiente; sinais isolados não configuram presença de mercado.',
    cor: 'text-ink-300 bg-bg-800 border-bg-700/50',
  },
  descoberta: {
    titulo: 'Descoberta',
    leitura: 'Primeiros sinais consistentes de audiência, consumo ou mercado.',
    cor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25',
  },
  desenvolvimento: {
    titulo: 'Desenvolvimento',
    leitura: 'Tração relevante e expansão da base, do consumo ou do mercado.',
    cor: 'text-blue-300 bg-blue-500/10 border-blue-500/25',
  },
  consolidacao: {
    titulo: 'Consolidação',
    leitura: 'Escala robusta, recorrência e presença mais ampla.',
    cor: 'text-violet-300 bg-violet-500/10 border-violet-500/25',
  },
  mainstream: {
    titulo: 'Mainstream',
    leitura: 'Alta escala e presença ampla em múltiplas dimensões.',
    cor: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  },
}

export function estagioDe(ige: number): Estagio {
  if (ige < 20) return 'pre-descoberta'
  if (ige < 40) return 'descoberta'
  if (ige < 60) return 'desenvolvimento'
  if (ige < 80) return 'consolidacao'
  return 'mainstream'
}

/* ── composição ────────────────────────────────────────────────────────────── */

export interface ComponenteApurado {
  chave: ComponenteIge
  rotulo: string
  peso: number
  /** 0-100, ou `null` quando a dimensão não tem dado (ND). */
  score: number | null
  /** Uma linha explicando de onde veio (ou por que falta). */
  origem: string
}

export interface ResultadoIge {
  /** 0-100 sobre a cobertura disponível; `null` quando não há nenhum componente. */
  ige: number | null
  /** Fração do peso total com dado (0-1). 1 = metodologia completa. */
  cobertura: number
  estagio: Estagio | null
  /** `true` sempre que a cobertura for menor que 100% (§8 da metodologia). */
  provisorio: boolean
  componentes: ComponenteApurado[]
  metodologia: string
}

/**
 * Combina os componentes apurados.
 *
 * A média é ponderada SOBRE A COBERTURA disponível, não sobre o peso total. A
 * v1.2 proíbe redistribuir peso "silenciosamente" — a chave é o silêncio: aqui a
 * cobertura vai junto do número, em campo próprio, e a tela mostra ND em cada
 * dimensão que falta. Zerar o ausente seria pior e contraria o §8: com 40% de
 * cobertura, um artista de 4,9M de audiência cairia em "Descoberta" — foi o que
 * a simulação sobre o roster real mostrou em 2026-09-04.
 */
export function calcularIge(componentes: ComponenteApurado[]): ResultadoIge {
  let soma = 0
  let peso = 0
  for (const c of componentes) {
    if (c.score != null) {
      soma += c.score * c.peso
      peso += c.peso
    }
  }
  const pesoTotal = Object.values(PESOS_IGE).reduce((a, b) => a + b, 0)
  const ige = peso > 0 ? Math.round((soma / peso) * 10) / 10 : null
  return {
    ige,
    cobertura: peso / pesoTotal,
    estagio: ige == null ? null : estagioDe(ige),
    provisorio: peso < pesoTotal,
    componentes,
    metodologia: METODOLOGIA,
  }
}

/** Declaração de mercado ao vivo gravada no projeto do artista. */
export interface MercadoAoVivoDeclarado {
  nivel: number
  score: number
  declaradoEm: string
  declaradoPorEmail?: string | null
}

/**
 * Monta os quatro componentes a partir do que o painel tem hoje. Consumo e
 * airplay entram como ND até o Soundcharts existir — a assinatura já os aceita
 * para que ligar a integração não exija mexer aqui.
 */
export function montarComponentes(entradas: {
  audiencia: ResultadoAudiencia | null
  mercadoAoVivo: MercadoAoVivoDeclarado | null
  consumo?: number | null
  airplay?: number | null
}): ComponenteApurado[] {
  const { audiencia, mercadoAoVivo } = entradas
  return [
    {
      chave: 'audiencia',
      rotulo: ROTULO_COMPONENTE.audiencia,
      peso: PESOS_IGE.audiencia,
      score: audiencia?.score ?? null,
      origem: audiencia
        ? `${audiencia.redesMedidas} de 3 redes medidas`
        : 'Nenhuma rede com seguidores coletados',
    },
    {
      chave: 'consumo',
      rotulo: ROTULO_COMPONENTE.consumo,
      peso: PESOS_IGE.consumo,
      score: entradas.consumo ?? null,
      origem: 'Depende do Soundcharts (Spotify monthly listeners + YouTube views/28d)',
    },
    {
      chave: 'airplay',
      rotulo: ROTULO_COMPONENTE.airplay,
      peso: PESOS_IGE.airplay,
      score: entradas.airplay ?? null,
      origem: 'Depende do Soundcharts (execuções em rádio/28d)',
    },
    {
      chave: 'mercadoAoVivo',
      rotulo: ROTULO_COMPONENTE.mercadoAoVivo,
      peso: PESOS_IGE.mercadoAoVivo,
      score: mercadoAoVivo?.score ?? null,
      origem: mercadoAoVivo
        ? `Declarado pela equipe${mercadoAoVivo.declaradoPorEmail ? ` (${mercadoAoVivo.declaradoPorEmail})` : ''}`
        : 'Ainda não declarado pela equipe',
    },
  ]
}

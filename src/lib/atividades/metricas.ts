import {
  concluida,
  diasNaEtapa,
  estaAtrasada,
  hojeISO,
  progressoDe,
  type Atividade,
} from '@/lib/atividades/client'
import { duracaoEmDias, janelaDaDemanda } from '@/lib/atividades/cronograma'
import { esforcoMeta, etapaDe, type ConfigQuadro } from '@/lib/atividades/tipos'

/**
 * Os números do quadro.
 *
 * Tudo é calculado sobre a lista já carregada — nenhuma leitura nova, nenhuma
 * coleção de agregados. É o que permite a faixa de indicadores existir sem
 * custar nada na cota do Firestore: ela é uma leitura DIFERENTE do mesmo dado
 * que o quadro já tem na mão.
 *
 * Os indicadores respeitam os filtros da tela de propósito. Filtrar por um
 * artista e ver "12 entregues no mês" do selo inteiro seria pior que não ter
 * número nenhum — o recorte tem de valer para a conta também.
 */

/** Quantos dias uma demanda parada é "parada" (e não só "andando devagar"). */
const DIAS_PARADA = 7

export interface Indicadores {
  emAberto: number
  atrasadas: number
  semResponsavel: number
  paradas: number
  entreguesNoMes: number
  /** Dias médios do início à entrega, entre as concluídas. `null` sem amostra. */
  tempoMedioEntrega: number | null
  /** Coluna mais cheia entre as não-finais — o gargalo do fluxo. */
  gargalo: { etapa: string; label: string; quantidade: number; estouraWip: boolean } | null
  /** Progresso médio das demandas em aberto. */
  progressoMedio: number
}

export function calcularIndicadores(lista: Atividade[], config: ConfigQuadro): Indicadores {
  const abertas = lista.filter((a) => !concluida(a, config))
  const mes = hojeISO().slice(0, 7)

  const concluidas = lista.filter((a) => concluida(a, config))
  const entreguesNoMes = concluidas.filter((a) => (a.concluidoEm ?? '').slice(0, 7) === mes).length

  // Tempo de entrega: da primeira data conhecida até o carimbo de conclusão.
  // Só entram as que TÊM as duas pontas — estimar a ponta que falta encheria a
  // média de números inventados.
  const duracoes = concluidas
    .map((a) => {
      if (!a.concluidoEm || !a.inicio) return null
      const dias = Math.round(
        (new Date(a.concluidoEm).getTime() - new Date(`${a.inicio}T12:00:00`).getTime()) / 86_400_000,
      )
      return dias >= 0 ? dias : null
    })
    .filter((d): d is number => d !== null)

  let gargalo: Indicadores['gargalo'] = null
  for (const etapa of config.etapas) {
    if (etapa.final) continue
    const quantidade = abertas.filter((a) => a.etapa === etapa.key).length
    if (!quantidade) continue
    const estouraWip = typeof etapa.wip === 'number' && etapa.wip > 0 && quantidade > etapa.wip
    // Estourar o limite de WIP ganha da contagem bruta: uma coluna com 4 cards e
    // teto de 2 é um problema mais urgente que outra com 9 e nenhum teto.
    const melhor =
      !gargalo ||
      (estouraWip && !gargalo.estouraWip) ||
      (estouraWip === gargalo.estouraWip && quantidade > gargalo.quantidade)
    if (melhor) gargalo = { etapa: etapa.key, label: etapa.label, quantidade, estouraWip }
  }

  const progressos = abertas.map((a) => progressoDe(a, lista, config))

  return {
    emAberto: abertas.length,
    atrasadas: abertas.filter((a) => estaAtrasada(a, config)).length,
    semResponsavel: abertas.filter((a) => !a.responsavelUid).length,
    paradas: abertas.filter((a) => (diasNaEtapa(a) ?? 0) >= DIAS_PARADA).length,
    entreguesNoMes,
    tempoMedioEntrega: duracoes.length
      ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length)
      : null,
    gargalo,
    progressoMedio: progressos.length
      ? Math.round(progressos.reduce((s, p) => s + p, 0) / progressos.length)
      : 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Carga do time                                                               */
/* -------------------------------------------------------------------------- */

export interface CargaPessoa {
  uid: string
  nome: string
  emAberto: number
  atrasadas: number
  /** Soma dos pontos de esforço — o "quanto", não o "quantos". */
  pontos: number
  /** Demandas cuja janela cruza os próximos 14 dias. */
  nasProximasSemanas: number
  demandas: Atividade[]
}

/**
 * Quanto cada pessoa está carregando.
 *
 * Conta em PONTOS de esforço e não em número de cards porque três cards não
 * dizem nada quando um deles é um clipe inteiro. Demanda sem esforço informado
 * entra como média (M) — tratá-la como zero faria a pessoa que não preenche o
 * campo parecer a mais livre do time.
 */
export function calcularCarga(
  lista: Atividade[],
  config: ConfigQuadro,
  equipe: { uid: string; nome: string }[],
): CargaPessoa[] {
  const hoje = hojeISO()
  const limite = new Date()
  limite.setDate(limite.getDate() + 14)
  const ateISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`

  const base = new Map<string, CargaPessoa>()
  for (const p of equipe) {
    base.set(p.uid, {
      uid: p.uid,
      nome: p.nome,
      emAberto: 0,
      atrasadas: 0,
      pontos: 0,
      nasProximasSemanas: 0,
      demandas: [],
    })
  }
  base.set('__sem__', {
    uid: '__sem__',
    nome: 'Sem responsável',
    emAberto: 0,
    atrasadas: 0,
    pontos: 0,
    nasProximasSemanas: 0,
    demandas: [],
  })

  for (const a of lista) {
    if (concluida(a, config)) continue

    // Responsável que saiu do time (ou foi desativado) ganha a própria raia, com
    // o nome que a demanda guardou. Jogá-lo no balde "Sem responsável" faria a
    // Carga contradizer o card, a lista e o indicador — que continuam mostrando
    // a pessoa — e esconderia o trabalho órfão justamente de quem precisa
    // redistribuí-lo.
    let chave = '__sem__'
    if (a.responsavelUid && base.has(a.responsavelUid)) {
      chave = a.responsavelUid
    } else if (a.responsavelUid && a.responsavelNome) {
      chave = a.responsavelUid
      base.set(chave, {
        uid: chave,
        nome: `${a.responsavelNome} (fora do time)`,
        emAberto: 0,
        atrasadas: 0,
        pontos: 0,
        nasProximasSemanas: 0,
        demandas: [],
      })
    }

    const p = base.get(chave)
    if (!p) continue
    p.emAberto += 1
    p.demandas.push(a)
    // Marco é acontecimento, não trabalho: ele aparece na lista da pessoa, mas
    // não infla a carga dela. Sem isto, encher o cronograma de marcos faria o
    // time inteiro parecer sobrecarregado.
    if (!a.marco) p.pontos += esforcoMeta[a.esforco ?? 'm'].pontos
    if (estaAtrasada(a, config)) p.atrasadas += 1
    const janela = janelaDaDemanda(a)
    if (janela.inicio <= ateISO && janela.fim >= hoje) p.nasProximasSemanas += 1
  }

  return Array.from(base.values())
    .filter((p) => p.emAberto > 0 || p.uid !== '__sem__')
    .sort((a, b) => {
      if (a.uid === '__sem__') return 1
      if (b.uid === '__sem__') return -1
      return b.pontos - a.pontos
    })
}

/* -------------------------------------------------------------------------- */
/* Tempo por etapa                                                             */
/* -------------------------------------------------------------------------- */

export interface TempoEtapa {
  etapa: string
  label: string
  /** Dias médios que uma demanda passa nesta etapa. */
  mediaDias: number
  amostra: number
}

/**
 * Onde o tempo está indo, etapa a etapa — o "do briefing à entrega, quem come o
 * calendário".
 *
 * Vem de `temposPorEtapa`, que cada movimentação alimenta. Só entram etapas com
 * amostra real; uma média de uma demanda só não é média, é anedota, então o
 * chamador decide o corte olhando `amostra`.
 */
export function tempoPorEtapa(lista: Atividade[], config: ConfigQuadro): TempoEtapa[] {
  const soma = new Map<string, { ms: number; n: number }>()
  for (const a of lista) {
    for (const [etapa, ms] of Object.entries(a.temposPorEtapa ?? {})) {
      if (typeof ms !== 'number' || ms <= 0) continue
      const atual = soma.get(etapa) ?? { ms: 0, n: 0 }
      atual.ms += ms
      atual.n += 1
      soma.set(etapa, atual)
    }
  }
  return config.etapas
    .map((e) => {
      const s = soma.get(e.key)
      if (!s) return null
      return {
        etapa: e.key,
        label: e.label,
        mediaDias: Math.round((s.ms / s.n / 86_400_000) * 10) / 10,
        amostra: s.n,
      }
    })
    .filter((t): t is TempoEtapa => t !== null)
}

/** Rótulo da etapa, com queda pro próprio código quando a coluna foi apagada. */
export function rotuloEtapa(config: ConfigQuadro, key: string): string {
  return etapaDe(config, key)?.label ?? key
}

/** Duração planejada média das demandas em aberto (dias). */
export function duracaoMedia(lista: Atividade[], config: ConfigQuadro): number | null {
  const abertas = lista.filter((a) => !concluida(a, config) && (a.inicio || a.prazo))
  if (!abertas.length) return null
  return Math.round(abertas.reduce((s, a) => s + duracaoEmDias(a), 0) / abertas.length)
}

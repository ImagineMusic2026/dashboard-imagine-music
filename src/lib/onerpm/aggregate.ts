import type {
  FaixaAgregada,
  MesAgregado,
  MoneyByCurrency,
  OneRpmAggregate,
  OneRpmRawRow,
  PlataformaAgregada,
  TerritorioAgregado,
} from './types'
import { normalizarStore } from './stores'

/** Slug estável a partir do nome do artista (sem acento, minúsculo, com hífens). */
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * ID determinístico da importação: um doc por artista + período de apuração.
 * Reimportar o MESMO período (mesmo relatório) sobrescreve em vez de duplicar.
 * Ex.: "rock-salles_2026-03_2026-05".
 */
export function importIdDe(agg: Pick<OneRpmAggregate, 'artistaSlug' | 'periodo'>): string {
  const ym = (s: string | null) => (s ? s.slice(0, 7) : null)
  const de = ym(agg.periodo.accountedFrom)
  const ate = ym(agg.periodo.accountedTo)
  let periodo: string
  if (de && ate) {
    periodo = de === ate ? de : `${de}_${ate}`
  } else if (agg.periodo.transactionMonths.length) {
    const ms = agg.periodo.transactionMonths
    periodo = ms.length === 1 ? ms[0] : `${ms[0]}_${ms[ms.length - 1]}`
  } else {
    periodo = 'sem-periodo'
  }
  return `${agg.artistaSlug || 'desconhecido'}_${periodo}`
}

/**
 * Extrai os performers do campo "Artists".
 * Ex.: "Rock Salles (performer), MC juniinho (writer)" -> ["Rock Salles"].
 * Ignora writer/producer/musician — só quem é creditado como performer.
 */
export function performersDe(artists: string): string[] {
  return (artists ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /\(performer\)/i.test(s))
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)
}

function bump(acc: MoneyByCurrency, moeda: string, valor: number): void {
  acc[moeda] = (acc[moeda] ?? 0) + (valor || 0)
}

function somaMoedas(m: MoneyByCurrency): number {
  return Object.values(m).reduce((a, b) => a + b, 0)
}

/**
 * Agrega as linhas cruas num resumo por artista, plataforma, faixa, país e mês.
 * Função PURA (sem dependência de xlsx/Firebase) — por isso é fácil de testar.
 */
export function agregar(rows: OneRpmRawRow[]): OneRpmAggregate {
  const avisos: string[] = []

  const contagemArtista = new Map<string, number>()
  const labels = new Map<string, number>()
  const plataformas = new Map<string, PlataformaAgregada>()
  const faixas = new Map<string, FaixaAgregada>()
  const territorios = new Map<string, TerritorioAgregado>()
  const meses = new Map<string, MesAgregado>()
  const moedasSet = new Set<string>()
  const transMonths = new Set<string>()

  const totGross: MoneyByCurrency = {}
  const totNet: MoneyByCurrency = {}
  let totStreams = 0
  let accountedFrom: string | null = null
  let accountedTo: string | null = null

  for (const r of rows) {
    const moeda = r.currency || '—'
    moedasSet.add(moeda)
    totStreams += r.quantity
    bump(totGross, moeda, r.gross)
    bump(totNet, moeda, r.net)

    for (const p of performersDe(r.artists)) contagemArtista.set(p, (contagemArtista.get(p) ?? 0) + 1)
    if (r.label) labels.set(r.label, (labels.get(r.label) ?? 0) + 1)
    if (r.transactionMonth) transMonths.add(r.transactionMonth)
    if (r.accountedDate) {
      if (!accountedFrom || r.accountedDate < accountedFrom) accountedFrom = r.accountedDate
      if (!accountedTo || r.accountedDate > accountedTo) accountedTo = r.accountedDate
    }

    // Plataforma (Store normalizado)
    const canon = normalizarStore(r.store)
    let p = plataformas.get(canon.plataforma)
    if (!p) {
      p = { ...canon, linhas: 0, streams: 0, grossPorMoeda: {}, netPorMoeda: {} }
      plataformas.set(canon.plataforma, p)
    }
    p.linhas++
    p.streams += r.quantity
    bump(p.grossPorMoeda, moeda, r.gross)
    bump(p.netPorMoeda, moeda, r.net)

    // Faixa (pelo ID da OneRPM; cai pro título se faltar)
    const fkey = r.trackId || r.title
    let f = faixas.get(fkey)
    if (!f) {
      f = { titulo: r.title, trackId: r.trackId, linhas: 0, streams: 0, grossPorMoeda: {}, netPorMoeda: {} }
      faixas.set(fkey, f)
    }
    f.linhas++
    f.streams += r.quantity
    bump(f.grossPorMoeda, moeda, r.gross)
    bump(f.netPorMoeda, moeda, r.net)

    // Território
    const tkey = r.territory || '—'
    let t = territorios.get(tkey)
    if (!t) {
      t = { territorio: tkey, streams: 0, netPorMoeda: {} }
      territorios.set(tkey, t)
    }
    t.streams += r.quantity
    bump(t.netPorMoeda, moeda, r.net)

    // Mês de transação
    if (r.transactionMonth) {
      let m = meses.get(r.transactionMonth)
      if (!m) {
        m = { mes: r.transactionMonth, streams: 0, netPorMoeda: {} }
        meses.set(r.transactionMonth, m)
      }
      m.streams += r.quantity
      bump(m.netPorMoeda, moeda, r.net)
    }
  }

  // Artista dominante (performer mais frequente)
  let artistaNome = 'Desconhecido'
  let maxC = -1
  for (const [nome, c] of Array.from(contagemArtista)) {
    if (c > maxC) {
      maxC = c
      artistaNome = nome
    }
  }
  if (contagemArtista.size > 1) {
    const outros = Array.from(contagemArtista.keys()).filter((n) => n !== artistaNome)
    avisos.push(
      `O arquivo tem ${contagemArtista.size} performers diferentes; agregado sob "${artistaNome}". ` +
        `Outros: ${outros.slice(0, 5).join(', ')}${outros.length > 5 ? '…' : ''}.`
    )
  }
  if (contagemArtista.size === 0) {
    avisos.push('Nenhum performer identificado no campo "Artists" — verifique o arquivo.')
  }

  // Label dominante
  let label = ''
  let maxL = -1
  for (const [nome, c] of Array.from(labels)) {
    if (c > maxL) {
      maxL = c
      label = nome
    }
  }

  const naoMapeadas = Array.from(
    new Set(
      Array.from(plataformas.values())
        .filter((p) => p.corKey === 'gray')
        .map((p) => p.plataforma)
    )
  )
  if (naoMapeadas.length) {
    avisos.push(`Lojas sem mapeamento próprio (mostradas como genéricas): ${naoMapeadas.join(', ')}.`)
  }

  const porNetDesc = <T extends { netPorMoeda: MoneyByCurrency }>(a: T, b: T) =>
    somaMoedas(b.netPorMoeda) - somaMoedas(a.netPorMoeda)

  return {
    fonte: 'onerpm',
    artistaNome,
    artistaSlug: slugify(artistaNome),
    label,
    periodo: {
      transactionMonths: Array.from(transMonths).sort(),
      accountedFrom,
      accountedTo,
    },
    moedas: Array.from(moedasSet).sort(),
    totais: {
      linhas: rows.length,
      streams: totStreams,
      grossPorMoeda: totGross,
      netPorMoeda: totNet,
    },
    porPlataforma: Array.from(plataformas.values()).sort(porNetDesc),
    porFaixa: Array.from(faixas.values()).sort(porNetDesc),
    porTerritorio: Array.from(territorios.values()).sort(porNetDesc),
    porMes: Array.from(meses.values()).sort((a, b) => a.mes.localeCompare(b.mes)),
    avisos,
  }
}

import type {
  ArtistaAgregado,
  FaixaAgregada,
  MesAgregado,
  MoneyByCurrency,
  OneRpmAggregate,
  OneRpmLote,
  OneRpmRawRow,
  OneRpmShareRow,
  OrigemAtribuicao,
  PlataformaAgregada,
  TerritorioAgregado,
} from './types'
import { normalizarStore } from './stores'
import { resolverSlugArtista } from './trends-aliases'

/** Remove acentos (decompõe e tira os diacríticos combinantes). */
function semAcento(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Slug estável a partir do nome do artista (sem acento, minúsculo, com hífens). */
export function slugify(nome: string): string {
  return semAcento(nome)
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

/** ID determinístico do lote (o arquivo inteiro). Reimportar o mesmo período sobrescreve. */
export function loteIdDe(periodo: OneRpmAggregate['periodo']): string {
  const ym = (s: string | null) => (s ? s.slice(0, 7) : null)
  const de = ym(periodo.accountedFrom)
  const ate = ym(periodo.accountedTo)
  if (de && ate) return de === ate ? `lote_${de}` : `lote_${de}_${ate}`
  const ms = periodo.transactionMonths
  if (ms.length) return ms.length === 1 ? `lote_${ms[0]}` : `lote_${ms[0]}_${ms[ms.length - 1]}`
  return 'lote_sem-periodo'
}

/**
 * "Imagine Music co: Netto Brito" -> "Netto Brito".
 * Sem `:` é a conta do próprio selo (linha não atribuída a um artista) -> null.
 */
export function artistaDeSourceAccount(sourceAccount: string): string | null {
  const i = (sourceAccount ?? '').indexOf(':')
  if (i < 0) return null
  return sourceAccount.slice(i + 1).trim() || null
}

/**
 * Chave de comparação frouxa: sem acento, sem separador, minúscula.
 * Serve pra casar o canal do YouTube com o artista — "NettoBrito" == "Netto Brito" —
 * e pra reconciliar o artista da OneRPM com o cadastro já existente no roster.
 */
export function chaveFrouxa(s: string): string {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Palavras do nome, sem acento e sem pontuação: "Rock Salle - O Camelô" -> [rock, salle, o, camelo]. */
function palavras(s: string): string[] {
  return semAcento(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Nomes curtos demais dariam falso positivo no match por prefixo do canal. */
const MIN_CHAVE_CANAL = 5
/** Soma mínima de letras casadas pra aceitar um match aproximado. */
const MIN_LETRAS_APROXIMADO = 8
/** Abaixo disto, uma letra de diferença não indica duplicata — indica outro artista. */
const MIN_CHAVE_DUPLICATA = 5
/** As grafias divergentes já vistas ficam em 1–2 edições (ver `trends-aliases.ts`). */
const MAX_DISTANCIA_DUPLICATA = 2

/** Quanto erro de digitação uma palavra aguenta. Palavra curta não aguenta nenhum. */
function tolerancia(len: number): number {
  if (len <= 4) return 0
  if (len <= 8) return 1
  return 2
}

/** Levenshtein com corte: desiste assim que toda a linha passa do teto. */
function distancia(a: string, b: string, teto: number): number {
  if (Math.abs(a.length - b.length) > teto) return teto + 1
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    let min = i
    for (let j = 1; j <= b.length; j++) {
      const custo =
        a[i - 1] === b[j - 1]
          ? anterior[j - 1]
          : 1 + Math.min(anterior[j - 1], anterior[j], atual[j - 1])
      atual.push(custo)
      if (custo < min) min = custo
    }
    if (min > teto) return teto + 1
    anterior = atual
  }
  return anterior[b.length]
}

/**
 * O canal começa com o nome do artista, palavra a palavra, tolerando um erro de
 * digitação por palavra: "Rock Salle - O Camelô" casa com "Rock Salles" (falta um
 * "s"), mas "Vitinho Forró" nunca casa com "Vitinho Santos" — a 2ª palavra é outra.
 */
function comecaComNome(canalPal: string[], artistaPal: string[]): boolean {
  if (!artistaPal.length || artistaPal.length > canalPal.length) return false
  let letras = 0
  for (let i = 0; i < artistaPal.length; i++) {
    const tol = tolerancia(artistaPal[i].length)
    if (distancia(artistaPal[i], canalPal[i], tol) > tol) return false
    letras += artistaPal[i].length
  }
  return letras >= MIN_LETRAS_APROXIMADO
}

export interface MatchCanal {
  slug: string
  /** `aproximado` = casou tolerando erro de digitação; merece aparecer nos avisos. */
  via: 'exato' | 'prefixo' | 'aproximado'
}

/**
 * Casa o nome do canal do YouTube com um artista já conhecido, em três estágios:
 *  1. exato    — "McJuniinho" == "Mc Juniinho" (a menos de espaço/acento/caixa)
 *  2. prefixo  — o canal é o nome + sufixo: "RockSallesOCamelo" -> "Rock Salles"
 *  3. aproximado — tolera um typo por palavra: "Rock Salle - O Camelô" -> "Rock Salles"
 *
 * O estágio 3 só decide quando UM único artista casa. Dois candidatos -> devolve
 * null e a linha fica sem atribuição, porque errar o dono do dinheiro é pior.
 */
function casarCanal(canal: string, canonicos: Map<string, string>): MatchCanal | null {
  const c = chaveFrouxa(canal)
  if (!c) return null

  let melhorPrefixo: MatchCanal | null = null
  let melhorLen = 0
  for (const [slug, nome] of Array.from(canonicos)) {
    const chave = chaveFrouxa(nome)
    if (chave === c) return { slug, via: 'exato' }
    if (chave.length >= MIN_CHAVE_CANAL && chave.length > melhorLen && c.startsWith(chave)) {
      melhorPrefixo = { slug, via: 'prefixo' }
      melhorLen = chave.length
    }
  }
  if (melhorPrefixo) return melhorPrefixo

  const canalPal = palavras(canal)
  const candidatos: string[] = []
  for (const [slug, nome] of Array.from(canonicos)) {
    if (comecaComNome(canalPal, palavras(nome))) candidatos.push(slug)
  }
  return candidatos.length === 1 ? { slug: candidatos[0], via: 'aproximado' } : null
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
 * Agrega linhas num resumo por plataforma, faixa, país e mês.
 * Função PURA (sem dependência de xlsx/Firebase) — por isso é fácil de testar.
 *
 * `artistaNome` deve vir resolvido por `agregarPorArtista`. Só quando ele falta
 * (uso avulso, como o script de verificação) caímos no performer dominante — que
 * num relatório de selo inteiro atribuiria a receita de todo mundo a um artista só.
 */
export function agregar(rows: OneRpmRawRow[], artistaNome?: string): OneRpmAggregate {
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

    if (!artistaNome) {
      for (const p of performersDe(r.artists)) contagemArtista.set(p, (contagemArtista.get(p) ?? 0) + 1)
    }
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

  // Sem nome resolvido: cai no performer dominante (ver aviso no doc da função).
  let nome = artistaNome ?? 'Desconhecido'
  if (!artistaNome) {
    let maxC = -1
    for (const [n, c] of Array.from(contagemArtista)) {
      if (c > maxC) {
        maxC = c
        nome = n
      }
    }
    if (contagemArtista.size > 1) {
      const outros = Array.from(contagemArtista.keys()).filter((n) => n !== nome)
      avisos.push(
        `O arquivo tem ${contagemArtista.size} performers diferentes; agregado sob "${nome}". ` +
          `Outros: ${outros.slice(0, 5).join(', ')}${outros.length > 5 ? '…' : ''}.`
      )
    }
    if (contagemArtista.size === 0) {
      avisos.push('Nenhum performer identificado no campo "Artists" — verifique o arquivo.')
    }
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
    artistaNome: nome,
    artistaSlug: slugify(nome),
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

/** Nome do bucket das linhas que nenhuma regra atribuiu. Nunca vira um artista. */
export const NAO_ATRIBUIDO = 'Não atribuído'

/** Um doc do Firestore morre em 1MB, e faixas/países viram cauda longa. */
const MAX_FAIXAS = 300
const MAX_TERRITORIOS = 100

/**
 * Corta a cauda longa de faixas/países. Não afeta o recálculo de base/câmbio, que
 * só depende de `totais` e `porPlataforma` — ambos preservados por inteiro.
 * Aplicado no cliente (antes de subir) e no servidor (antes de gravar).
 */
export function enxugarAgregado<T extends OneRpmAggregate>(agg: T): T {
  return {
    ...agg,
    porFaixa: agg.porFaixa.slice(0, MAX_FAIXAS),
    porTerritorio: agg.porTerritorio.slice(0, MAX_TERRITORIOS),
  }
}

/** Deixa o lote no tamanho em que ele será gravado — é o que trafega pra API. */
export function enxugarLote(lote: OneRpmLote): OneRpmLote {
  return {
    ...lote,
    artistas: lote.artistas.map(enxugarAgregado),
    naoAtribuido: lote.naoAtribuido ? enxugarAgregado(lote.naoAtribuido) : null,
  }
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Fatia o relatório do SELO por artista.
 *
 * O relatório da OneRPM traz todos os artistas numa aba só, e o artista aparece
 * em três lugares diferentes dependendo do tipo de linha:
 *
 *  1. `Source Account` = "Imagine Music co: Netto Brito" — o caso normal.
 *  2. Linhas na conta do selo (sem `:`): o artista está no 1º performer de "Artists".
 *  3. Vídeos do YouTube: vêm sem sub-conta E sem "Artists". Sobra o nome do canal
 *     em "Album/Channel" — que é grudado ("NettoBrito"), daí o match frouxo.
 *
 * O que não cai em nenhuma das três vai pra `naoAtribuido` e NÃO entra na receita
 * de ninguém: melhor uma sobra visível do que dinheiro no artista errado.
 */
export function agregarPorArtista(rows: OneRpmRawRow[], shares: OneRpmShareRow[] = []): OneRpmLote {
  // 1ª passada: quem são os artistas. A sub-conta é autoritativa; o performer só
  // batiza quem não tem sub-conta própria.
  const canonicos = new Map<string, string>() // slug -> nome de exibição
  const comConta = new Set<string>()
  for (const r of rows) {
    const daConta = artistaDeSourceAccount(r.sourceAccount)
    if (!daConta) continue
    const s = slugify(daConta)
    comConta.add(s)
    if (!canonicos.has(s)) canonicos.set(s, daConta)
  }
  for (const r of rows) {
    if (artistaDeSourceAccount(r.sourceAccount)) continue
    const p = performersDe(r.artists)[0]
    if (!p) continue
    const s = slugify(p)
    if (!canonicos.has(s)) canonicos.set(s, p)
  }

  // Poucos canais distintos pra dezenas de milhares de linhas — resolve uma vez cada.
  const cacheCanal = new Map<string, MatchCanal | null>()
  const resolverCanal = (canal: string): MatchCanal | null => {
    const chave = canal.trim()
    if (!cacheCanal.has(chave)) cacheCanal.set(chave, casarCanal(chave, canonicos))
    return cacheCanal.get(chave) ?? null
  }

  // 2ª passada: cada linha vai pro seu artista.
  type Grupo = { nome: string; rows: OneRpmRawRow[]; origens: Record<OrigemAtribuicao, number> }
  const grupos = new Map<string, Grupo>()
  const orfas: OneRpmRawRow[] = []
  const canaisUsados = new Map<string, { nome: string; via: MatchCanal['via']; linhas: number }>()

  for (const r of rows) {
    let slug: string | null = null
    let via: OrigemAtribuicao = 'conta'

    const daConta = artistaDeSourceAccount(r.sourceAccount)
    if (daConta) {
      slug = slugify(daConta)
    } else {
      const p = performersDe(r.artists)[0]
      if (p) {
        slug = slugify(p)
        via = 'performer'
      } else {
        const doCanal = resolverCanal(r.albumChannel)
        if (doCanal) {
          slug = doCanal.slug
          via = 'canal'
          const chave = r.albumChannel.trim()
          const uso = canaisUsados.get(chave) ?? {
            nome: canonicos.get(doCanal.slug) ?? doCanal.slug,
            via: doCanal.via,
            linhas: 0,
          }
          uso.linhas++
          canaisUsados.set(chave, uso)
        }
      }
    }

    if (!slug) {
      orfas.push(r)
      continue
    }

    let g = grupos.get(slug)
    if (!g) {
      g = { nome: canonicos.get(slug) ?? slug, rows: [], origens: { conta: 0, performer: 0, canal: 0 } }
      grupos.set(slug, g)
    }
    g.rows.push(r)
    g.origens[via]++
  }

  const { repasses, pagoTerceirosPorMoeda, artistasComRepasse } = lerRepasses(shares, rows)

  const artistas: ArtistaAgregado[] = Array.from(grupos)
    .map(([slug, g]) => ({
      ...agregar(g.rows, g.nome),
      origens: g.origens,
      repassePorMoeda: repasses.get(slug) ?? {},
    }))
    .sort((a, b) => somaMoedas(b.totais.netPorMoeda) - somaMoedas(a.totais.netPorMoeda))

  const naoAtribuido = orfas.length ? agregar(orfas, NAO_ATRIBUIDO) : null

  // Totais/período/label do arquivo inteiro, independentes do fatiamento.
  const geral = agregar(rows, NAO_ATRIBUIDO)

  const avisos: string[] = []
  if (canaisUsados.size) {
    const total = Array.from(canaisUsados.values()).reduce((a, u) => a + u.linhas, 0)
    const detalhe = Array.from(canaisUsados)
      .sort((a, b) => b[1].linhas - a[1].linhas)
      .map(([canal, u]) => `"${canal}" → ${u.nome}${u.via === 'aproximado' ? ' (nome aproximado)' : ''}`)
      .join(', ')
    avisos.push(
      `${fmtInt(total)} linhas de vídeo do YouTube não trazem o artista; atribuídas pelo canal: ${detalhe}.`
    )
  }
  const semConta = Array.from(canonicos.keys()).filter((s) => !comConta.has(s))
  if (semConta.length) {
    const nomes = semConta.map((s) => canonicos.get(s) ?? s)
    avisos.push(
      `${semConta.length} artistas não têm sub-conta na OneRPM e foram identificados pelo campo "Artists": ` +
        `${nomes.slice(0, 8).join(', ')}${nomes.length > 8 ? '…' : ''}.`
    )
  }
  if (artistasComRepasse) {
    avisos.push(
      `${artistasComRepasse} artistas repassam uma fatia da receita ao selo (aba "Shares In & Out"). ` +
        `O repasse é mostrado separado — a receita gerada continua cheia.`
    )
  }
  if (naoAtribuido) {
    avisos.push(
      `${fmtInt(naoAtribuido.totais.linhas)} linhas (${fmtInt(naoAtribuido.totais.streams)} streams) não foram ` +
        `atribuídas a nenhum artista e ficaram FORA dos perfis. Confira o nome do canal/artista na OneRPM.`
    )
  }
  avisos.push(...geral.avisos) // com nome resolvido, só sobra o aviso de lojas sem mapeamento

  return {
    fonte: 'onerpm',
    label: geral.label,
    periodo: geral.periodo,
    moedas: geral.moedas,
    totais: geral.totais,
    artistas,
    naoAtribuido,
    pagoTerceirosPorMoeda,
    avisos,
  }
}

/** Um artista já cadastrado em `artistas/{slug}`. */
export interface ArtistaRoster {
  slug: string
  nome: string
}

export interface Reconciliacao {
  /** Onde a receita será gravada: o slug do ROSTER quando o artista já existe. */
  slug: string
  /** Não havia cadastro — será criado agora. */
  criado: boolean
  /** Slug do roster que parece o mesmo artista, mas não casou. Exige olho humano. */
  possivelDuplicata?: string
}

/**
 * Casa cada artista do relatório com o cadastro que já existe no roster.
 *
 * Não é firula: o roster tem "Netto Brito" sob o slug `neto-brito` (um "t"), e a
 * OneRPM gera `netto-brito`. Sem reconciliar, a importação criaria um artista
 * duplicado E gravaria a receita num slug que o perfil dele nunca lê.
 *
 * Ordem de resolução:
 *  1. `ALIAS_ARTISTA` — o mapa já confirmado com o cliente, mesma fonte que o sync
 *     de streaming usa. É a única autoridade sobre grafias divergentes.
 *  2. Nome normalizado (sem acento/pontuação/caixa) contra o roster.
 *  3. Não achou: cria. Nomes só PARECIDOS nunca são fundidos sozinhos — viram
 *     `possivelDuplicata` pra alguém decidir e, se for o caso, virar um alias novo.
 */
export function reconciliarArtistas(
  artistas: Array<{ artistaSlug: string; artistaNome: string }>,
  roster: ArtistaRoster[]
): Map<string, Reconciliacao> {
  const slugsDoRoster = new Set(roster.map((r) => r.slug))

  const porChave = new Map<string, string>() // chave frouxa -> slug do roster
  for (const r of roster) {
    const chave = chaveFrouxa(r.nome)
    if (chave) porChave.set(chave, r.slug)
  }
  for (const r of roster) {
    const chave = chaveFrouxa(r.slug)
    if (chave && !porChave.has(chave)) porChave.set(chave, r.slug)
  }

  const out = new Map<string, Reconciliacao>()
  // Dois artistas do relatório jamais podem gravar no mesmo doc de receita.
  const slugsOcupados = new Set<string>()

  for (const a of artistas) {
    const chave = chaveFrouxa(a.artistaNome) || chaveFrouxa(a.artistaSlug)

    const porAlias = resolverSlugArtista(a.artistaSlug)
    const doRoster =
      porAlias !== a.artistaSlug && slugsDoRoster.has(porAlias) ? porAlias : porChave.get(chave)

    if (doRoster && !slugsOcupados.has(doRoster)) {
      slugsOcupados.add(doRoster)
      out.set(a.artistaSlug, { slug: doRoster, criado: false })
      continue
    }

    // Sem cadastro: cria. Antes, avisa se existe alguém quase igual no roster —
    // fundir por conta própria arriscaria juntar dois artistas diferentes.
    const quase =
      chave.length >= MIN_CHAVE_DUPLICATA
        ? roster.find(
            (r) => distancia(chave, chaveFrouxa(r.nome), MAX_DISTANCIA_DUPLICATA) <= MAX_DISTANCIA_DUPLICATA
          )
        : undefined

    // Dois artistas do relatório podem convergir pro mesmo slug (ex.: "Netto Brito"
    // e "Neto Brito"). Sufixar mantém as receitas separadas; o aviso conta o resto.
    let slug = a.artistaSlug
    for (let n = 2; slugsOcupados.has(slug); n++) slug = `${a.artistaSlug}-${n}`
    const conflitou = slug !== a.artistaSlug

    slugsOcupados.add(slug)
    out.set(a.artistaSlug, {
      slug,
      criado: true,
      possivelDuplicata: conflitou ? a.artistaSlug : quase?.slug,
    })
  }

  return out
}

type TipoConta = 'artista' | 'selo' | 'terceiro'

/** Nome da conta do selo — o prefixo antes do ":" nas sub-contas ("Imagine Music co"). */
function contaDoSelo(rows: OneRpmRawRow[]): string {
  const contagem = new Map<string, number>()
  for (const r of rows) {
    const i = r.sourceAccount.indexOf(':')
    const selo = (i >= 0 ? r.sourceAccount.slice(0, i) : r.sourceAccount).trim()
    if (selo) contagem.set(selo, (contagem.get(selo) ?? 0) + 1)
  }
  let nome = ''
  let max = -1
  for (const [n, c] of Array.from(contagem)) {
    if (c > max) {
      max = c
      nome = n
    }
  }
  return nome
}

/**
 * Lê a aba "Shares In & Out", que NÃO é receita nova — é o razão de repasses entre
 * contas. Dois fluxos importam:
 *
 *  - `Share In` de uma sub-conta de artista pro selo: a fatia (ex.: 30%) que a
 *    Imagine fica de cada artista. Esse dinheiro JÁ está na receita do artista em
 *    "Sales"; por isso ele é guardado à parte, nunca somado.
 *  - `Share Out` do selo pra terceiros (contas `listener-*`): o que sai pra
 *    colaboradores. É do selo, não de um artista.
 *
 * O mesmo repasse artista→selo aparece nas duas pontas (`Share In` e `Share Out`).
 * Só o lado `Share In` é contado — somar os dois zeraria o valor.
 */
function lerRepasses(
  shares: OneRpmShareRow[],
  rows: OneRpmRawRow[]
): { repasses: Map<string, MoneyByCurrency>; pagoTerceirosPorMoeda: MoneyByCurrency; artistasComRepasse: number } {
  const repasses = new Map<string, MoneyByCurrency>()
  const pagoTerceirosPorMoeda: MoneyByCurrency = {}
  if (!shares.length) return { repasses, pagoTerceirosPorMoeda, artistasComRepasse: 0 }

  const selo = contaDoSelo(rows)
  const tipo = (nome: string): TipoConta => {
    if (nome.includes(':')) return 'artista'
    return nome.trim() === selo ? 'selo' : 'terceiro'
  }

  for (const s of shares) {
    const ehIn = /share in/i.test(s.shareType)
    const ehOut = /share out/i.test(s.shareType)
    const de = tipo(s.payerName)
    const para = tipo(s.receiverName)

    if (ehIn && de === 'artista' && para === 'selo') {
      const nome = artistaDeSourceAccount(s.payerName)
      if (!nome) continue
      const slug = slugify(nome)
      const acc = repasses.get(slug) ?? {}
      bump(acc, s.currency || '—', s.net)
      repasses.set(slug, acc)
    } else if (ehOut && de === 'selo' && para === 'terceiro') {
      bump(pagoTerceirosPorMoeda, s.currency || '—', s.net)
    }
  }

  return { repasses, pagoTerceirosPorMoeda, artistasComRepasse: repasses.size }
}

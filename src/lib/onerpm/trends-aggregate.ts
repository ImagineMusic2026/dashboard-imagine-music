import { slugify } from './aggregate'
import { normalizarStore } from './stores'
import type {
  OneRpmTrendsAggregate,
  OneRpmTrendsRow,
  TrendsArtistaAgg,
  TrendsDiaPonto,
  TrendsFaixaAgg,
  TrendsLojaAgg,
  TrendsPaisAgg,
} from './trends-types'

/**
 * Agrega as linhas cruas do trends num resumo por ARTISTA (e, dentro de cada um,
 * por dia / país / loja / faixa). Função PURA (sem xlsx/Firebase) — fácil de testar.
 *
 * O artista é agrupado pela `slug` (derivada do nome já sem o prefixo da conta),
 * estável mesmo com a caixa inconsistente do CSV ("ARTISTA 1" e "Artista 1" caem
 * na mesma slug "artista-1").
 *
 * Para o backfill (milhares de arquivos), o agregador é incremental: o sync usa
 * `novoAcumulador()` → `acumular(acc, rows)` por arquivo → `finalizar(acc)`, sem
 * precisar manter todas as linhas cruas na memória ao mesmo tempo.
 */

function rate(skips: number, streams: number): number {
  return streams > 0 ? skips / streams : 0
}

interface AcumArtista {
  nome: string
  slug: string
  streams: number
  skips: number
  dias: Map<string, TrendsDiaPonto>
  paises: Map<string, TrendsPaisAgg>
  lojas: Map<string, TrendsLojaAgg>
  faixas: Map<string, TrendsFaixaAgg>
}

export interface TrendsAcc {
  porArtista: Map<string, AcumArtista>
  storesSet: Set<string>
  isrcsSet: Set<string>
  diasGlobais: Set<string>
  nomesPorSlug: Map<string, Set<string>>
  totStreams: number
  totSkips: number
  totLinhas: number
  de: string | null
  ate: string | null
}

export function novoAcumulador(): TrendsAcc {
  return {
    porArtista: new Map(),
    storesSet: new Set(),
    isrcsSet: new Set(),
    diasGlobais: new Set(),
    nomesPorSlug: new Map(),
    totStreams: 0,
    totSkips: 0,
    totLinhas: 0,
    de: null,
    ate: null,
  }
}

/** Dobra um lote de linhas dentro do acumulador (muta `acc`). */
export function acumular(acc: TrendsAcc, rows: OneRpmTrendsRow[]): void {
  for (const r of rows) {
    acc.totLinhas++
    if (!r.dateStat || !r.isrc) continue
    acc.totStreams += r.quantity
    acc.totSkips += r.skips
    acc.storesSet.add(r.store)
    acc.isrcsSet.add(r.isrc)
    acc.diasGlobais.add(r.dateStat)
    if (!acc.de || r.dateStat < acc.de) acc.de = r.dateStat
    if (!acc.ate || r.dateStat > acc.ate) acc.ate = r.dateStat

    const slug = slugify(r.artistName) || 'desconhecido'
    if (!acc.nomesPorSlug.has(slug)) acc.nomesPorSlug.set(slug, new Set())
    acc.nomesPorSlug.get(slug)!.add(r.artistName)

    let a = acc.porArtista.get(slug)
    if (!a) {
      a = {
        nome: r.artistName || 'Desconhecido',
        slug,
        streams: 0,
        skips: 0,
        dias: new Map(),
        paises: new Map(),
        lojas: new Map(),
        faixas: new Map(),
      }
      acc.porArtista.set(slug, a)
    }
    a.streams += r.quantity
    a.skips += r.skips

    // por dia
    let d = a.dias.get(r.dateStat)
    if (!d) {
      d = { dia: r.dateStat, streams: 0, skips: 0 }
      a.dias.set(r.dateStat, d)
    }
    d.streams += r.quantity
    d.skips += r.skips

    // por país
    const pk = r.countryCode || '—'
    let p = a.paises.get(pk)
    if (!p) {
      p = { pais: pk, streams: 0, skips: 0 }
      a.paises.set(pk, p)
    }
    p.streams += r.quantity
    p.skips += r.skips

    // por loja (store normalizado p/ plataforma canônica)
    let l = a.lojas.get(r.store)
    if (!l) {
      const canon = normalizarStore(r.store)
      l = {
        loja: r.store,
        plataforma: canon.plataforma,
        corKey: canon.corKey,
        iconeTipo: canon.iconeTipo,
        streams: 0,
        skips: 0,
      }
      a.lojas.set(r.store, l)
    }
    l.streams += r.quantity
    l.skips += r.skips

    // por faixa (ISRC)
    let f = a.faixas.get(r.isrc)
    if (!f) {
      f = { isrc: r.isrc, streams: 0, skips: 0 }
      a.faixas.set(r.isrc, f)
    }
    f.streams += r.quantity
    f.skips += r.skips
  }
}

const porStreamsDesc = (a: { streams: number }, b: { streams: number }) => b.streams - a.streams

/** Fecha o acumulador num agregado imutável (ordena e calcula taxas). */
export function finalizar(acc: TrendsAcc): OneRpmTrendsAggregate {
  const avisos: string[] = []
  for (const [slug, nomes] of Array.from(acc.nomesPorSlug)) {
    if (nomes.size > 1) {
      avisos.push(
        `Artista "${slug}" aparece com grafias diferentes no CSV (${Array.from(nomes).join(' / ')}); ` +
          `agrupei pela slug (divergências com o roster se resolvem nos aliases de trends-aliases.ts).`,
      )
    }
  }

  const artistas: TrendsArtistaAgg[] = Array.from(acc.porArtista.values())
    .map((a) => {
      const dias = Array.from(a.dias.values()).sort((x, y) => x.dia.localeCompare(y.dia))
      return {
        artistaNome: a.nome,
        artistaSlug: a.slug,
        streams: a.streams,
        skips: a.skips,
        skipRate: rate(a.skips, a.streams),
        periodo: {
          de: dias[0]?.dia ?? acc.de ?? '',
          ate: dias[dias.length - 1]?.dia ?? acc.ate ?? '',
          dias: a.dias.size,
        },
        porDia: dias,
        porPais: Array.from(a.paises.values()).sort(porStreamsDesc),
        porLoja: Array.from(a.lojas.values()).sort(porStreamsDesc),
        porFaixa: Array.from(a.faixas.values()).sort(porStreamsDesc),
      }
    })
    .sort(porStreamsDesc)

  return {
    fonte: 'onerpm-trends',
    periodo: { de: acc.de ?? '', ate: acc.ate ?? '', dias: acc.diasGlobais.size },
    stores: Array.from(acc.storesSet).sort(),
    totais: {
      linhas: acc.totLinhas,
      streams: acc.totStreams,
      skips: acc.totSkips,
      skipRate: rate(acc.totSkips, acc.totStreams),
      artistas: acc.porArtista.size,
      isrcs: acc.isrcsSet.size,
    },
    porArtista: artistas,
    avisos,
  }
}

/** Conveniência: agrega um lote único de linhas (cria → acumula → finaliza). */
export function agregarTrends(rows: OneRpmTrendsRow[]): OneRpmTrendsAggregate {
  const acc = novoAcumulador()
  acumular(acc, rows)
  return finalizar(acc)
}

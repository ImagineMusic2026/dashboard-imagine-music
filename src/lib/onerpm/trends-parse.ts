import { agregarTrends } from './trends-aggregate'
import type { OneRpmTrendsAggregate, OneRpmTrendsRow } from './trends-types'

/**
 * Leitura do CSV de trends (streaming) da OneRPM -> linhas cruas -> agregado.
 *
 * CSV próprio (sem dependência de xlsx): parser tolerante a aspas/CRLF/BOM que
 * mantém TUDO como string — importante pra preservar `date_stat` como
 * "YYYY-MM-DD" literal (evita a coerção de data que o xlsx faria).
 */

/** Erro de parsing com mensagem amigável pra mostrar na UI. */
export class OneRpmTrendsParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneRpmTrendsParseError'
  }
}

const COLUNAS = ['store', 'date_stat', 'country_code', 'quantity', 'skips', 'isrc', 'artist_name'] as const

/** Parser de CSV minimalista (RFC-4180-ish): aspas duplas, "" escapado, CRLF. */
function parseCsv(texto: string): string[][] {
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto // tira BOM
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let emAspas = false
  let temConteudo = false

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (emAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"'
          i++
        } else emAspas = false
      } else campo += c
    } else if (c === '"') {
      emAspas = true
      temConteudo = true
    } else if (c === ',') {
      linha.push(campo)
      campo = ''
      temConteudo = true
    } else if (c === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
      temConteudo = false
    } else if (c === '\r') {
      // ignora (trata CRLF)
    } else {
      campo += c
      temConteudo = true
    }
  }
  if (temConteudo || campo.length || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas
}

function num(v: string): number {
  const n = parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Remove o prefixo de conta do `artist_name` e normaliza espaços.
 *
 * A OneRPM prefixa o nome com a conta de origem, e a grafia varia entre os
 * arquivos: "ImagineMusic: ARTISTA" (exemplo) e "Imagine Music co: Netto Brit"
 * (arquivos reais). Quando a linha é só o prefixo, sem artista depois dos dois
 * pontos (ex.: "Imagine Music co"), mantemos o texto original.
 */
export function limparArtista(raw: string): string {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim()
  const semPrefixo = s.replace(/^imagine\s*music(\s+co)?\s*:\s*/i, '').trim()
  return semPrefixo || s
}

export function lerLinhasTrends(buf: Buffer | ArrayBuffer | Uint8Array | string): OneRpmTrendsRow[] {
  const texto = typeof buf === 'string' ? buf : Buffer.from(buf as ArrayBuffer).toString('utf8')
  const linhas = parseCsv(texto).filter((r) => r.some((c) => c.trim() !== ''))
  if (!linhas.length) throw new OneRpmTrendsParseError('O arquivo está vazio.')

  const header = linhas[0].map((h) => h.trim().toLowerCase())
  const idx = new Map<string, number>()
  header.forEach((h, i) => idx.set(h, i))

  const faltando = COLUNAS.filter((c) => !idx.has(c))
  if (faltando.length) {
    throw new OneRpmTrendsParseError(
      `Isto não parece o CSV de trends da OneRPM. Faltam as colunas: ${faltando.join(', ')}.`
    )
  }
  const col = (r: string[], nome: string) => (r[idx.get(nome)!] ?? '').trim()

  const out: OneRpmTrendsRow[] = []
  for (let i = 1; i < linhas.length; i++) {
    const r = linhas[i]
    const raw = col(r, 'artist_name')
    out.push({
      store: col(r, 'store'),
      dateStat: col(r, 'date_stat'),
      countryCode: col(r, 'country_code').toUpperCase(),
      quantity: num(col(r, 'quantity')),
      skips: num(col(r, 'skips')),
      isrc: col(r, 'isrc').toUpperCase(),
      artistNameRaw: raw,
      artistName: limparArtista(raw),
    })
  }
  return out
}

/** Pipeline completo: CSV (buffer/string) -> agregado por artista pronto pra usar. */
export function parseTrends(buf: Buffer | ArrayBuffer | Uint8Array | string): OneRpmTrendsAggregate {
  return agregarTrends(lerLinhasTrends(buf))
}

import * as XLSX from 'xlsx'
import { agregar } from './aggregate'
import type { OneRpmAggregate, OneRpmRawRow } from './types'

/**
 * Leitura do XLSX da OneRPM (aba "Sales") -> linhas cruas -> agregado.
 *
 * ⚠️ Só servidor: importa `xlsx`. Parseia direto do BUFFER do upload (sem tocar
 * em disco), então não precisa de `XLSX.set_fs`.
 */

/** Erro de parsing com mensagem amigável pra mostrar na UI. */
export class OneRpmParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneRpmParseError'
  }
}

const COLUNAS_OBRIGATORIAS = ['Title', 'Artists', 'Store', 'Currency', 'Quantity', 'Gross', 'Net']

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Lê uma célula tolerando espaços/caixa diferentes na chave do cabeçalho. */
function makeGetter(row: Record<string, unknown>) {
  const mapa = new Map<string, string>()
  for (const k of Object.keys(row)) mapa.set(k.trim().toLowerCase(), k)
  return (coluna: string): unknown => {
    const real = mapa.get(coluna.trim().toLowerCase())
    return real ? row[real] : null
  }
}

export function lerLinhasOneRpm(buf: Buffer | ArrayBuffer | Uint8Array): OneRpmRawRow[] {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    throw new OneRpmParseError('Não consegui abrir o arquivo. Confirme que é um .xlsx válido exportado da OneRPM.')
  }

  const sheetName = wb.SheetNames.includes('Sales') ? 'Sales' : wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) throw new OneRpmParseError('A planilha está vazia ou sem a aba de vendas ("Sales").')

  const raw = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]
  if (!raw.length) throw new OneRpmParseError('A planilha não tem linhas de dados.')

  const headers = Object.keys(raw[0]).map((h) => h.trim().toLowerCase())
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !headers.includes(c.toLowerCase()))
  if (faltando.length) {
    throw new OneRpmParseError(
      `Isto não parece um relatório de vendas da OneRPM. Faltam as colunas: ${faltando.join(', ')}.`
    )
  }

  return raw.map((row) => {
    const get = makeGetter(row)
    return {
      sourceAccount: txt(get('Source Account')),
      title: txt(get('Title')),
      albumChannel: txt(get('Album/Channel')),
      artists: txt(get('Artists')),
      label: txt(get('Label')),
      productType: txt(get('Product Type')),
      parentId: txt(get('Parent ID')),
      trackId: txt(get('ID')),
      salesType: txt(get('Sales Type')),
      transactionMonth: txt(get('Transaction Month')),
      accountedDate: txt(get('Accounted Date')),
      quantity: num(get('Quantity')),
      territory: txt(get('Territory')),
      store: txt(get('Store')),
      currency: txt(get('Currency')),
      gross: num(get('Gross')),
      net: num(get('Net')),
    }
  })
}

/** Pipeline completo: buffer do XLSX -> agregado pronto pra gravar/exibir. */
export function parseOneRpm(buf: Buffer | ArrayBuffer | Uint8Array): OneRpmAggregate {
  return agregar(lerLinhasOneRpm(buf))
}

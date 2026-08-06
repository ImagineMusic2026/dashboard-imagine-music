import * as XLSX from 'xlsx'
import { agregarPorArtista } from './aggregate'
import type { OneRpmLote, OneRpmRawRow, OneRpmShareRow } from './types'

/**
 * Leitura do XLSX da OneRPM (aba "Sales") -> linhas cruas -> lote por artista.
 *
 * ISOMÓRFICO: roda no browser (Web Worker do importador) e no Node (scripts).
 * Parseia direto do buffer, sem tocar em disco, então não precisa de `XLSX.set_fs`.
 *
 * O relatório do selo inteiro chega a ~15MB / 120k linhas — acima do limite de
 * corpo de requisição da Vercel (4,5MB) e do tempo de uma função serverless. Por
 * isso quem parseia é o browser; o servidor só recebe o agregado, que é pequeno.
 */

/** Erro de parsing com mensagem amigável pra mostrar na UI. */
export class OneRpmParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneRpmParseError'
  }
}

const ABA_VENDAS = 'Sales'
const ABA_REPASSES = 'Shares In & Out'
const COLUNAS_OBRIGATORIAS = ['Title', 'Artists', 'Store', 'Currency', 'Quantity', 'Gross', 'Net']
const COLUNAS_REPASSE = ['Share Type', 'Payer Name', 'Receiver Name', 'Currency', 'Net']

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function toUint8(buf: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  if (buf instanceof Uint8Array) return buf
  return new Uint8Array(buf)
}

/**
 * Lê só as abas que usamos. A pasta tem outras (ex.: "Commissions") e cada aba
 * ignorada é tempo de parse economizado.
 */
function abrir(buf: Buffer | ArrayBuffer | Uint8Array): XLSX.WorkBook {
  const dados = toUint8(buf)
  try {
    const wb = XLSX.read(dados, { type: 'array', sheets: [ABA_VENDAS, ABA_REPASSES], dense: true })
    if (wb.Sheets[ABA_VENDAS]) return wb
    // Sem aba "Sales" (export antigo?): relê o arquivo todo pra tentar a primeira aba.
    return XLSX.read(dados, { type: 'array', dense: true })
  } catch {
    throw new OneRpmParseError('Não consegui abrir o arquivo. Confirme que é um .xlsx válido exportado da OneRPM.')
  }
}

function abaDeVendas(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const ws = wb.Sheets[ABA_VENDAS] ?? (wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined)
  if (!ws) throw new OneRpmParseError('A planilha está vazia ou sem a aba de vendas ("Sales").')
  return ws
}

/**
 * Cabeçalhos que a OneRPM anuncia sem escrever as células. O relatório de
 * jan/2026 ganhou "Creations" e "Views" no MEIO do cabeçalho, mas as linhas de
 * dados continuaram sem essas duas células — então todo dado à direita de
 * "Quantity" fica 2 colunas antes do que o cabeçalho promete (Territory lia
 * "USD", Store lia um número, Gross/Net liam null → receita zerada e agregado
 * com milhares de "moedas"/"lojas", grande demais até pra subir).
 */
const CABECALHOS_SEM_DADOS = new Set(['creations', 'views'])

const moedaParece = (v: unknown): boolean => /^[A-Za-z]{3}$/.test(txt(v))

/** Matriz de células + índice do cabeçalho, resolvido UMA vez (são ~120k linhas). */
function tabela(ws: XLSX.WorkSheet): { matriz: unknown[][]; posicao: Map<string, number>; realinhado: boolean } {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false })
  const posicao = new Map<string, number>()
  ;(matriz[0] ?? []).forEach((h, i) => posicao.set(txt(h).toLowerCase(), i))
  return realinharSePreciso(matriz, posicao)
}

/**
 * O cabeçalho é validado contra os DADOS antes de valer: a coluna "Currency"
 * tem de conter códigos de moeda ("USD", "BRL"). Quando não contém, o cabeçalho
 * mentiu — recompõe o índice como se as colunas sem dados não existissem e
 * valida de novo. Num export futuro em que Creations/Views venham DE VERDADE
 * preenchidas (alinhadas), a validação passa de primeira e nada muda.
 */
function realinharSePreciso(
  matriz: unknown[][],
  posicao: Map<string, number>
): { matriz: unknown[][]; posicao: Map<string, number>; realinhado: boolean } {
  // Sem coluna Currency não há régua — segue como está (as obrigatórias acusam depois).
  const validaMoeda = (pos: Map<string, number>): boolean => {
    const i = pos.get('currency') ?? -1
    if (i < 0) return true
    let comValor = 0
    let validas = 0
    for (let n = 1; n < matriz.length && comValor < 50; n++) {
      const v = matriz[n]?.[i]
      if (v == null || txt(v) === '') continue
      comValor++
      if (moedaParece(v)) validas++
    }
    return comValor === 0 || validas / comValor >= 0.8
  }
  if (validaMoeda(posicao)) return { matriz, posicao, realinhado: false }

  const compacta = new Map<string, number>()
  let idx = 0
  for (const h of matriz[0] ?? []) {
    const nome = txt(h).toLowerCase()
    if (CABECALHOS_SEM_DADOS.has(nome)) continue
    compacta.set(nome, idx)
    idx++
  }
  if (validaMoeda(compacta)) return { matriz, posicao: compacta, realinhado: true }
  // Não melhorou: devolve o original pra falha aparecer do jeito de sempre.
  return { matriz, posicao, realinhado: false }
}

const emCelula = (linha: unknown[], i: number): unknown => (i < 0 ? null : linha[i])

/** Abre o arquivo e devolve as duas abas já em linhas cruas (+ avisos de leitura). */
export function lerOneRpm(buf: Buffer | ArrayBuffer | Uint8Array): {
  vendas: OneRpmRawRow[]
  repasses: OneRpmShareRow[]
  avisos: string[]
} {
  const wb = abrir(buf)
  const avisos: string[] = []
  const vendas = lerVendas(abaDeVendas(wb), avisos)
  const repasses = lerRepasses(wb, avisos)
  return { vendas, repasses, avisos }
}

function lerVendas(ws: XLSX.WorkSheet, avisos: string[] = []): OneRpmRawRow[] {
  const { matriz, posicao, realinhado } = tabela(ws)
  if (realinhado) {
    avisos.push(
      'O cabeçalho da aba "Sales" anuncia colunas sem dados (Creations/Views) — as colunas foram realinhadas automaticamente. Confira os totais com o relatório da OneRPM.'
    )
  }
  if (matriz.length < 2) throw new OneRpmParseError('A planilha não tem linhas de dados.')

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !posicao.has(c.toLowerCase()))
  if (faltando.length) {
    throw new OneRpmParseError(
      `Isto não parece um relatório de vendas da OneRPM. Faltam as colunas: ${faltando.join(', ')}.`
    )
  }

  const col = (nome: string) => posicao.get(nome.toLowerCase()) ?? -1
  const iSourceAccount = col('Source Account')
  const iTitle = col('Title')
  const iAlbumChannel = col('Album/Channel')
  const iArtists = col('Artists')
  const iLabel = col('Label')
  const iProductType = col('Product Type')
  const iParentId = col('Parent ID')
  const iTrackId = col('ID')
  const iSalesType = col('Sales Type')
  const iTransactionMonth = col('Transaction Month')
  const iAccountedDate = col('Accounted Date')
  const iQuantity = col('Quantity')
  const iTerritory = col('Territory')
  const iStore = col('Store')
  const iCurrency = col('Currency')
  const iGross = col('Gross')
  const iNet = col('Net')

  const linhas: OneRpmRawRow[] = []
  for (let i = 1; i < matriz.length; i++) {
    const l = matriz[i]
    if (!l) continue
    linhas.push({
      sourceAccount: txt(emCelula(l, iSourceAccount)),
      title: txt(emCelula(l, iTitle)),
      albumChannel: txt(emCelula(l, iAlbumChannel)),
      artists: txt(emCelula(l, iArtists)),
      label: txt(emCelula(l, iLabel)),
      productType: txt(emCelula(l, iProductType)),
      parentId: txt(emCelula(l, iParentId)),
      trackId: txt(emCelula(l, iTrackId)),
      salesType: txt(emCelula(l, iSalesType)),
      transactionMonth: txt(emCelula(l, iTransactionMonth)),
      accountedDate: txt(emCelula(l, iAccountedDate)),
      quantity: num(emCelula(l, iQuantity)),
      territory: txt(emCelula(l, iTerritory)),
      store: txt(emCelula(l, iStore)),
      currency: txt(emCelula(l, iCurrency)),
      gross: num(emCelula(l, iGross)),
      net: num(emCelula(l, iNet)),
    })
  }
  if (!linhas.length) throw new OneRpmParseError('A planilha não tem linhas de dados.')
  return linhas
}

/**
 * Aba de repasses. É OPCIONAL: exports de um artista só não a trazem, e nesse caso
 * o lote simplesmente não tem split. Cabeçalho estranho também vira lista vazia —
 * um repasse ausente não pode impedir a importação da receita.
 */
function lerRepasses(wb: XLSX.WorkBook, avisos: string[] = []): OneRpmShareRow[] {
  const ws = wb.Sheets[ABA_REPASSES]
  if (!ws) return []

  const { matriz, posicao, realinhado } = tabela(ws)
  if (realinhado) {
    avisos.push('A aba "Shares In & Out" também veio com o cabeçalho desalinhado — colunas realinhadas.')
  }
  if (matriz.length < 2) return []
  if (COLUNAS_REPASSE.some((c) => !posicao.has(c.toLowerCase()))) return []

  const col = (nome: string) => posicao.get(nome.toLowerCase()) ?? -1
  const iShareType = col('Share Type')
  const iPayer = col('Payer Name')
  const iReceiver = col('Receiver Name')
  const iCurrency = col('Currency')
  const iNet = col('Net')

  const linhas: OneRpmShareRow[] = []
  for (let i = 1; i < matriz.length; i++) {
    const l = matriz[i]
    if (!l) continue
    linhas.push({
      shareType: txt(emCelula(l, iShareType)),
      payerName: txt(emCelula(l, iPayer)),
      receiverName: txt(emCelula(l, iReceiver)),
      currency: txt(emCelula(l, iCurrency)),
      net: num(emCelula(l, iNet)),
    })
  }
  return linhas
}

/** Pipeline completo: buffer do XLSX -> lote fatiado por artista (com repasses). */
export function parseOneRpm(buf: Buffer | ArrayBuffer | Uint8Array): OneRpmLote {
  const { vendas, repasses, avisos } = lerOneRpm(buf)
  const lote = agregarPorArtista(vendas, repasses)
  // Avisos de LEITURA na frente: se o cabeçalho precisou de conserto, é a primeira
  // coisa que quem importa deve saber.
  lote.avisos = [...avisos, ...lote.avisos]
  return lote
}

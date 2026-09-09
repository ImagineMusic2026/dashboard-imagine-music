/**
 * Renderiza as abas da exportação num .xlsx com a identidade da Imagine.
 * SÓ SERVIDOR — o ExcelJS é grande e não deve entrar no pacote do navegador.
 *
 * Por que não o SheetJS, que o projeto já usa: a versão comunitária dele NÃO
 * grava estilo de célula (cor, fonte, borda) — testado, o `fill` volta como
 * `patternType: none`. Formato numérico ele grava; cor, não. Como a cliente
 * pediu identidade visual, aqui é ExcelJS; nos outros lugares o SheetJS segue.
 *
 * A paleta é a do painel (`tailwind.config.ts`), mas INVERTIDA: a tela é escura
 * e a planilha é clara. Fundo escuro numa planilha gasta tinta, atrapalha quem
 * imprime e briga com qualquer gráfico que a pessoa insira depois. O escuro
 * fica só no cabeçalho, que é onde a marca precisa aparecer.
 */
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { AbaPlanilha } from './exportar'

/** Paleta do painel em ARGB. */
const COR = {
  fundoMarca: 'FF0F0B1F',
  cabecalho: 'FF1A1530',
  destaque: 'FFFBBF24',
  textoClaro: 'FFF1F5F9',
  textoEscuro: 'FF1A1530',
  ausente: 'FF94A3B8',
  listra: 'FFF6F6FA',
  borda: 'FFE2E8F0',
} as const

const AUSENTE = 'não medido'

/** Linhas do topo reservadas à marca, antes do conteúdo de cada aba. */
const LINHAS_MARCA = 3

async function lerLogo(): Promise<Buffer | null> {
  try {
    // Versão reduzida (720px): a original tem 10070px e engorda o arquivo à toa.
    return await readFile(
      path.join(process.cwd(), 'src/components/images/LOGO_ImagineMusic-planilha.png'),
    )
  } catch {
    // Sem logo a planilha sai igual, só sem a marca — nunca falha por causa disso.
    return null
  }
}

export async function renderizarPlanilha(
  abas: AbaPlanilha[],
  meta: { artista: string; geradoEm?: Date },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Painel Imagine'
  wb.created = meta.geradoEm ?? new Date()

  const logoBuffer = await lerLogo()
  // O ExcelJS declara o próprio `Buffer`, que não bate com o do Node nas tipagens
  // recentes; o valor em runtime é o mesmo.
  const logoId = logoBuffer
    ? wb.addImage({ buffer: logoBuffer as unknown as ExcelJS.Buffer, extension: 'png' })
    : null

  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome, {
      views: [{ state: 'frozen', ySplit: LINHAS_MARCA + 1 }],
    })
    ws.columns = aba.larguras.map((width) => ({ width }))

    /* ── faixa da marca ─────────────────────────────────────────────────── */
    ws.getRow(1).height = 42
    if (logoId != null) {
      ws.addImage(logoId, { tl: { col: 0.25, row: 0.35 }, ext: { width: 176, height: 40 } })
    }
    const totalColunas = Math.max(1, aba.larguras.length)
    for (let l = 1; l <= LINHAS_MARCA; l++) {
      for (let c = 1; c <= totalColunas; c++) {
        ws.getCell(l, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.fundoMarca } }
      }
    }
    // O nome do artista à direita do logo, para a aba se identificar sozinha
    // quando alguém imprime uma só ou manda por e-mail fora de contexto.
    const titulo = ws.getCell(2, Math.min(3, totalColunas))
    titulo.value = `${meta.artista} · ${aba.nome}`
    titulo.font = { bold: true, size: 12, color: { argb: COR.textoClaro } }
    titulo.alignment = { horizontal: 'right', vertical: 'middle' }

    // Contexto e avisos ficam AQUI, na faixa escura, e não no corpo da tabela:
    // no corpo eles disputariam a linha do cabeçalho (que o filtro usa) e
    // passariam batidos no meio dos números.
    ws.getRow(3).height = aba.subtitulo ? 18 : 6
    if (aba.subtitulo) {
      const sub = ws.getCell(3, 1)
      sub.value = aba.subtitulo
      sub.font = { size: 10, bold: true, color: { argb: COR.destaque } }
      sub.alignment = { horizontal: 'left', vertical: 'middle' }
      if (totalColunas > 1) ws.mergeCells(3, 1, 3, totalColunas)
    }

    /* ── conteúdo ───────────────────────────────────────────────────────── */
    const inicio = LINHAS_MARCA + 1
    aba.linhas.forEach((linha, i) => {
      const r = ws.getRow(inicio + i)
      linha.forEach((valor, j) => {
        const celula = r.getCell(j + 1)
        celula.value = valor ?? null
        const formato = aba.formatos?.[j]
        if (formato && typeof valor === 'number') celula.numFmt = formato
        // Ausência PARECE ausência: cinza e itálico. Numa planilha, "não medido"
        // no meio de números precisa saltar aos olhos, senão vira só mais um texto.
        if (valor === AUSENTE) celula.font = { italic: true, color: { argb: COR.ausente } }
        celula.border = {
          bottom: { style: 'hair', color: { argb: COR.borda } },
          right: { style: 'hair', color: { argb: COR.borda } },
        }
        celula.alignment = { vertical: 'middle', wrapText: j === linha.length - 1 }
      })
      r.height = 18
    })

    /* ── cabeçalho da tabela ────────────────────────────────────────────── */
    // A primeira linha de conteúdo é cabeçalho em toda aba, menos na de texto
    // corrido ("Como ler"), que é um documento e não uma tabela.
    const ehTabela = aba.linhas.length > 1 && aba.larguras.length > 1
    if (ehTabela) {
      const cab = ws.getRow(inicio)
      cab.height = 22
      cab.eachCell((celula) => {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cabecalho } }
        celula.font = { bold: true, color: { argb: COR.textoClaro }, size: 11 }
        celula.alignment = { vertical: 'middle', wrapText: false }
      })
      ws.autoFilter = {
        from: { row: inicio, column: 1 },
        to: { row: inicio + aba.linhas.length - 1, column: totalColunas },
      }

      // Listra nas linhas pares: leitura de tabela larga sem perder a linha.
      for (let i = 1; i < aba.linhas.length; i += 2) {
        const r = ws.getRow(inicio + i)
        r.eachCell((celula) => {
          if (!celula.fill || celula.fill.type !== 'pattern') {
            celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.listra } }
          }
        })
      }
    } else {
      // Aba de texto: o título em destaque e o resto legível, sem cara de tabela.
      const primeira = ws.getRow(inicio)
      primeira.font = { bold: true, size: 13, color: { argb: COR.textoEscuro } }
      primeira.height = 24
      for (let i = 0; i < aba.linhas.length; i++) {
        ws.getRow(inicio + i).eachCell((celula) => {
          celula.border = {}
        })
      }
    }

  }

  const saida = await wb.xlsx.writeBuffer()
  return Buffer.from(saida)
}

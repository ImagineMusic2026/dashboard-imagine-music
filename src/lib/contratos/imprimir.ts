import logoImagineMusic from '@/components/images/LOGO_ImagineMusic.png'
import { EMPRESA } from '@/lib/empresa'
import { blocosDe } from '@/lib/contratos/modelo'
import { dataPorExtenso, type Assinatura } from '@/lib/contratos/tipos'

/**
 * O contrato virando documento — pra assinar em papel, arquivar ou mandar pro
 * artista.
 *
 * O caminho é a IMPRESSÃO do navegador ("Salvar como PDF"), não uma lib de PDF.
 * É a mesma escolha do questionário (`diagnostico/exportar.ts`) e aqui ela tem
 * um motivo a mais: sem Firebase Storage, o painel não teria onde guardar um
 * arquivo. Não guardando nenhum, o documento é REGERADO a partir do que está no
 * Firestore (texto do modelo copiado, valores e assinaturas) toda vez que
 * alguém pede — e sai sempre igual, porque a data do documento está congelada
 * em `emitidoEm`.
 *
 * O bloco de auditoria no fim não é decoração: numa assinatura eletrônica
 * simples, é ele (data do servidor, IP e o hash do texto) que sustenta o
 * documento depois. O hash é do texto renderizado no instante da assinatura —
 * confere com este se nada mudou.
 */

/** Texto que veio de formulário dentro de um HTML montado à mão — escapar não é opcional. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * `break-inside: avoid` no bloco de assinatura é das poucas quebras que importam
 * de verdade: uma rubrica separada do nome em páginas diferentes é um documento
 * que ninguém aceita.
 */
const CSS = `
*, *::before, *::after { box-sizing: border-box; }
@page { size: A4; margin: 18mm 18mm 16mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.6; color: #17161c; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  orphans: 2; widows: 2;
}
.topo { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  padding-bottom: 10px; border-bottom: 2px solid #17161c; }
.topo img { height: 26px; width: auto; display: block; }
.kicker { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; font-weight: 700;
  color: #6d28d9; text-align: right; white-space: nowrap; }
h1 { font-size: 16pt; font-weight: 800; letter-spacing: -0.01em; margin: 18px 0 4px; }
.meta { font-size: 8.5pt; color: #57545f; margin: 0 0 22px; }
.meta strong { color: #17161c; font-weight: 600; }
h2 { font-size: 9pt; letter-spacing: .08em; font-weight: 700; color: #17161c;
  margin: 18px 0 8px; break-after: avoid; page-break-after: avoid; }
p.corpo { margin: 0 0 10px; text-align: justify; white-space: pre-wrap; }
.assinaturas { display: flex; gap: 32px; margin-top: 34px; break-inside: avoid; page-break-inside: avoid; }
.bloco { flex: 1; break-inside: avoid; page-break-inside: avoid; }
.traco { height: 54px; display: flex; align-items: flex-end; border-bottom: 1px solid #17161c; }
.traco img { max-height: 52px; max-width: 100%; display: block; }
.quem { font-size: 9pt; font-weight: 700; margin: 5px 0 0; }
.doc { font-size: 8pt; color: #57545f; margin: 1px 0 0; }
.auditoria { margin-top: 30px; padding-top: 8px; border-top: 1px solid #e6e3ee;
  font-size: 7.5pt; color: #57545f; break-inside: avoid; page-break-inside: avoid; }
.auditoria p { margin: 0 0 3px; }
.hash { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 7pt; word-break: break-all; color: #8a8696; }
.rodape { margin-top: 14px; font-size: 7.5pt; color: #8a8696; }
`

function blocoAssinatura(rotulo: string, a: Assinatura | null, nomeFallback: string): string {
  const traco = a?.imagem
    ? `<img src="${esc(a.imagem)}" alt="Assinatura de ${esc(a.nome)}">`
    : ''
  const quem = a?.nome || nomeFallback
  const doc = a?.documento ? `<p class="doc">${esc(a.documento)}</p>` : ''
  const quando = a?.em ? `<p class="doc">Assinado em ${esc(dataHora(a.em))}</p>` : ''
  return `
  <div class="bloco">
    <div class="traco">${traco}</div>
    <p class="quem">${esc(quem)}</p>
    <p class="doc">${esc(rotulo)}</p>
    ${doc}
    ${quando}
  </div>`
}

function linhaAuditoria(rotulo: string, a: Assinatura | null): string {
  if (!a) return ''
  const partes = [
    `${esc(a.nome)}`,
    a.documento ? `documento ${esc(a.documento)}` : '',
    `em ${esc(dataHora(a.em))}`,
    a.ip ? `IP ${esc(a.ip)}` : '',
  ].filter(Boolean)
  return `<p><strong>${esc(rotulo)}:</strong> assinado eletronicamente por ${partes.join(', ')}.</p>
  <p class="hash">Código de verificação do documento: ${esc(a.hash)}</p>`
}

export interface DadosImpressao {
  /** Nome do modelo — vira o título do documento. */
  modeloNome: string
  artistaNome: string
  tipoLabel: string
  /** O texto JÁ renderizado — o mesmo que foi assinado. */
  texto: string
  emitidoEm: string | null
  vigencia: { inicio: string; fim: string | null }
  assinaturaArtista: Assinatura | null
  assinaturaImagine: Assinatura | null
}

function montarHtml(d: DadosImpressao, titulo: string): string {
  const logo = new URL(logoImagineMusic.src, window.location.origin).href
  const corpo = blocosDe(d.texto)
    .map((b) =>
      b.tipo === 'titulo'
        ? `<h2>${esc(b.texto)}</h2>`
        : `<p class="corpo">${esc(b.texto)}</p>`,
    )
    .join('\n')

  const vigencia = d.vigencia.fim
    ? `${dataPorExtenso(d.vigencia.inicio)} a ${dataPorExtenso(d.vigencia.fim)}`
    : `a partir de ${dataPorExtenso(d.vigencia.inicio)}, por prazo indeterminado`

  const auditoria = [
    linhaAuditoria('Contratante', d.assinaturaArtista),
    linhaAuditoria('Contratada', d.assinaturaImagine),
  ]
    .filter(Boolean)
    .join('\n')

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head>
<body data-contrato>
  <div class="topo">
    <img src="${esc(logo)}" alt="Imagine Music">
    <div class="kicker">${esc(d.tipoLabel)}</div>
  </div>
  <h1>${esc(d.modeloNome)}</h1>
  <p class="meta">
    <strong>${esc(d.artistaNome)}</strong>
    &middot; vigência ${esc(vigencia)}
    ${d.emitidoEm ? `&middot; emitido em ${esc(dataPorExtenso(d.emitidoEm))}` : ''}
  </p>
  ${corpo}
  <div class="assinaturas">
    ${blocoAssinatura('Contratante', d.assinaturaArtista, d.artistaNome)}
    ${blocoAssinatura('Contratada', d.assinaturaImagine, EMPRESA.razaoSocial)}
  </div>
  ${
    auditoria
      ? `<div class="auditoria">
    <p><strong>Registro da assinatura eletrônica</strong></p>
    ${auditoria}
    <p>Assinatura eletrônica nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020. O código de verificação é o resumo criptográfico (SHA-256) do texto assinado: qualquer alteração no documento muda o código.</p>
  </div>`
      : ''
  }
  <p class="rodape">${esc(EMPRESA.razaoSocial)} &middot; CNPJ ${esc(EMPRESA.cnpj)} &middot; ${esc(EMPRESA.endereco)}</p>
</body>
</html>`
}

/**
 * Monta o documento e abre a impressão do navegador.
 *
 * O iframe é 0×0 e fora de vista, mas NÃO pode ser `display:none` — o navegador
 * não pagina o que não renderiza. O título do documento é o que vira o nome
 * sugerido no "Salvar como PDF"; alguns navegadores usam o da PÁGINA e não o do
 * iframe, daí a troca temporária do `document.title`.
 */
export function imprimirContrato(d: DadosImpressao): void {
  const titulo = `${d.modeloNome} — ${d.artistaNome}`
  const html = montarHtml(d, titulo)
  const tituloAnterior = document.title

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'

  let encerrado = false
  const limpar = () => {
    if (encerrado) return
    encerrado = true
    document.title = tituloAnterior
    iframe.remove()
  }

  let disparado = false
  iframe.onload = () => {
    // Inserir um iframe no DOM dispara um `load` do `about:blank` inicial, ANTES
    // do documento de verdade. Sem conferir o marcador, quem ia pra impressora
    // era a página vazia — e com o título certo, porque o título vem do pai.
    const conteudo = iframe.contentDocument
    const win = iframe.contentWindow
    if (disparado || !win || !conteudo?.querySelector('[data-contrato]')) return
    disparado = true
    win.addEventListener('afterprint', limpar, { once: true })
    document.title = titulo
    win.focus()
    win.print()
  }

  // `srcdoc` ANTES de inserir: o iframe já entra no DOM carregando o documento certo.
  iframe.srcdoc = html
  document.body.appendChild(iframe)
  // Rede de segurança: o Safari não dispara `afterprint` em iframe, e se o
  // documento nunca carregar o `onload` não roda. `limpar` é idempotente.
  window.setTimeout(limpar, 60_000)
}

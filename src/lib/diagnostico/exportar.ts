import logoImagineMusic from '@/components/images/LOGO_ImagineMusic.png'
import type { DiagnosticoDoc } from './client'
import { NOME_CURTO, progressoDe, questionario, type TipoDiagnostico } from './perguntas'

/**
 * O questionário respondido virando um documento — pra mandar pro artista, levar pra
 * reunião ou anexar num plano.
 *
 * O caminho é a IMPRESSÃO do navegador ("Salvar como PDF"), não uma lib de PDF: o
 * documento é HTML montado aqui, num iframe invisível, e quem pagina é o navegador.
 * Evita ~300kB de dependência pra gerar duas páginas de texto, e de quebra o mesmo
 * botão serve pra imprimir de verdade.
 *
 * O que sai é o mesmo que a equipe lê no modal — mesma ordem, mesmas seções, e as não
 * respondidas continuam lá: saber o que ficou em branco também é informação. A
 * diferença é o tema, claro, porque isso vai pro papel.
 */

/** Texto do artista dentro de um HTML montado à mão — escapar não é opcional. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function data(ms: number | null): string | null {
  if (!ms) return null
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * `break-after: avoid` no rótulo em vez de `break-inside: avoid` no bloco inteiro: a
 * pergunta pode quebrar de página no meio da resposta (algumas passam de 3000
 * caracteres), o que não pode é o rótulo ficar sozinho no pé da página.
 */
const CSS = `
*, *::before, *::after { box-sizing: border-box; }
@page { size: A4; margin: 16mm 15mm 14mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.5; color: #17161c; background: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  orphans: 2; widows: 2;
}
.topo { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  padding-bottom: 10px; border-bottom: 2px solid #17161c; }
.topo img { height: 28px; width: auto; display: block; }
.kicker { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; font-weight: 700;
  color: #6d28d9; text-align: right; white-space: nowrap; }
h1 { font-size: 19pt; font-weight: 800; letter-spacing: -0.01em; margin: 18px 0 5px; }
.meta { font-size: 9pt; color: #57545f; margin: 0 0 24px; }
.meta strong { color: #17161c; font-weight: 600; }
h2 { font-size: 8.5pt; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #6d28d9;
  margin: 24px 0 12px; padding-bottom: 5px; border-bottom: 1px solid #e6e3ee;
  break-after: avoid; page-break-after: avoid; }
.pergunta { margin: 0 0 14px; }
.rotulo { font-size: 9pt; font-weight: 700; color: #46434f; margin: 0 0 2px;
  break-after: avoid; page-break-after: avoid; }
.resposta { margin: 0; white-space: pre-wrap; }
.vazia { margin: 0; color: #9a96a6; font-style: italic; }
.rodape { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e6e3ee; font-size: 8pt; color: #8a8696; }
`

function montarHtml(tipo: TipoDiagnostico, artistaNome: string, doc: DiagnosticoDoc | undefined, titulo: string): string {
  const q = questionario(tipo)
  const prog = progressoDe(tipo, doc?.respostas)
  const enviadoEm = doc?.status === 'enviado' ? data(doc.enviadoEmMs) : null

  const estado = doc?.status === 'enviado' ? `Enviado${enviadoEm ? ` em ${enviadoEm}` : ''}` : 'Rascunho'

  const corpo = q.secoes
    .map((secao) => {
      const perguntas = secao.perguntas
        .map((p) => {
          const r = (doc?.respostas?.[p.id] ?? '').trim()
          // `pre-wrap` na resposta: as quebras de linha são do artista.
          const resposta = r
            ? `<p class="resposta">${esc(r)}</p>`
            : '<p class="vazia">— sem resposta</p>'
          return `<div class="pergunta"><p class="rotulo">${esc(p.rotulo)}</p>${resposta}</div>`
        })
        .join('')
      const cabecalho = secao.titulo ? `<h2>${esc(secao.titulo)}</h2>` : ''
      return cabecalho + perguntas
    })
    .join('')

  // O logo é PNG preto sobre transparente — no painel ele é invertido pro tema
  // escuro; aqui vai como veio, que é o certo pro papel.
  const logo = new URL(logoImagineMusic.src, window.location.origin).href

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>${CSS}</style>
</head>
<body data-questionario>
  <div class="topo">
    <img src="${esc(logo)}" alt="Imagine Music">
    <div class="kicker">Questionário de Estruturação</div>
  </div>
  <h1>${esc(artistaNome)}</h1>
  <p class="meta">
    <strong>${esc(NOME_CURTO[tipo])}</strong>
    &middot; ${esc(estado)}
    &middot; ${prog.respondidas} de ${prog.total} respondidas
  </p>
  ${corpo}
  <p class="rodape">Gerado pelo Painel Imagine em ${esc(data(Date.now()) ?? '')}.</p>
</body>
</html>`
}

/**
 * Monta o documento e abre a impressão do navegador.
 *
 * O iframe é 0×0 e fora de vista, mas NÃO pode ser `display:none` — o navegador não
 * pagina o que não renderiza. O título do documento é o que vira o nome sugerido do
 * arquivo no "Salvar como PDF"; alguns navegadores usam o da PÁGINA e não o do
 * iframe, daí a troca temporária do `document.title`.
 */
export function exportarDiagnosticoPdf(tipo: TipoDiagnostico, artistaNome: string, doc: DiagnosticoDoc | undefined): void {
  const titulo = `Questionário ${NOME_CURTO[tipo]} — ${artistaNome}`
  const html = montarHtml(tipo, artistaNome, doc, titulo)
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
    // Inserir um iframe no DOM dispara um `load` do `about:blank` inicial, ANTES do
    // documento de verdade. Sem conferir o marcador, quem ia pra impressora era a
    // página vazia — e com o título certo, porque o título vem do documento pai.
    const conteudo = iframe.contentDocument
    const win = iframe.contentWindow
    if (disparado || !win || !conteudo?.querySelector('[data-questionario]')) return
    disparado = true
    win.addEventListener('afterprint', limpar, { once: true })
    document.title = titulo
    win.focus()
    win.print()
  }

  // `srcdoc` ANTES de inserir: o iframe já entra no DOM carregando o documento certo.
  iframe.srcdoc = html
  document.body.appendChild(iframe)
  // Rede de segurança: o Safari não dispara `afterprint` em iframe, e se o documento
  // nunca carregar o `onload` não roda — sem isto o iframe ficaria pendurado no DOM e
  // o título da aba, trocado. `limpar` é idempotente.
  window.setTimeout(limpar, 60_000)
}

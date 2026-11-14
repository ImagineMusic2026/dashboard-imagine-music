/**
 * O padrão de título das demandas: `Artista - o que precisa ser feito`.
 *
 * Pedido da cliente em 11/2026: no calendário e nas listas a equipe precisa saber
 * de imediato de que artista é cada demanda, e os títulos vinham em todo formato —
 * "(OS CLONES) PROGRAMAR…", "LANÇAMENTO MUSICAL - GLAUCO", "LINK BIO [GLAUCO]",
 * "Youtube - Nenho". O nome NÃO é digitado: vem do artista escolhido na demanda,
 * como está no cadastro, e entra na hora de MOSTRAR. Em `titulo` fica gravado só o
 * que a pessoa escreve ("Lançamento", "Card", "Presskit").
 *
 * Mostrar em vez de gravar, de propósito: renomear o artista no cadastro muda todas
 * as demandas dele, e os títulos antigos não precisam de migração —
 * `semArtistaNoTitulo` tira o nome que alguém escreveu à mão nas PONTAS do título,
 * nos formatos que o quadro já tinha. O meio do título nunca é mexido: "Revisar
 * redes de Nenho (YouTube)" fala do artista, não o rotula.
 *
 * Na dúvida, o nome fica: repetido ("Glauco - Show (Nenho & Glauco)") é feio, mas
 * cortado errado some texto que alguém escreveu — e salvar o formulário grava o corte.
 */

import type { TemplateDemanda } from './tipos'

/** O que separa o artista do resto do título. */
export const SEPARADOR = ' - '

/**
 * Separadores que alguém usou à mão entre o nome e o resto. A barra ficou de fora:
 * "JUNINHO/NENHO" é dupla, não rótulo.
 */
const SEP = '[-\\u2013\\u2014:|]'
const SO_SEPARADOR = new RegExp(`^${SEP}+$`)

/**
 * O mesmo, quando vem colado no texto que fica: traço grudado num número é sinal,
 * não separador — "(GLAUCO) -50% NO INGRESSO" não pode perder o menos.
 */
const SEP_ANTES_DO_TEXTO = '(?:[-\\u2013\\u2014](?!\\d)|[:|])'

/**
 * O separador como rótulo: com espaço em pelo menos um dos lados. Colado dos dois
 * ("Beira-Mar", "Arco-Íris") é palavra composta, e cortar ali comeria meia palavra.
 */
const SEP_ROTULO = `(?:\\s+${SEP_ANTES_DO_TEXTO}\\s*|\\s*${SEP}\\s+)`

/** O que liga o título ao nome no fim: "Revisar lançamento DE Silfarley", "Card P/ Nenho". */
const PREPOSICAO = '(?:de|do|da|dos|das|com|c/|para|pra|pro|p/)'

/**
 * Palavras que, deixadas penduradas antes do nome no fim, mostram que o nome era
 * PARTE da frase e não um rótulo: "Ajustar a luz" (artista Luz), "Single do Nenho
 * feat. Glauco", "Collab Nenho x Glauco", "Show do Nenho e do Glauco", "Matéria
 * sobre Glauco", "Ensaio sem Glauco". Símbolo solto ("Nenho & Glauco", "Nenho +
 * Glauco") conta igual. Valem antes do nome, de "de Nome" e de "(Nome)".
 */
const LIGACOES = new Set([
  'a', 'o', 'as', 'os', 'e', 'ou', 'ao', 'aos', 'no', 'na', 'nos', 'nas', 'em', 'um', 'uma',
  'sobre', 'sem', 'por', 'pelo', 'pela', 'contra', 'entre', 'ate',
  'x', 'vs', 'feat', 'ft', 'part',
])

/**
 * As preposições do fim como palavra solta ("c/" e "p/" sem a barra). Antes do
 * nome SOLTO elas o seguram: se "do Glauco" não pôde sair inteiro ("Show do Nenho
 * e do Glauco"), tirar só o nome deixaria "do" pendurado.
 */
const PREPOSICOES = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'c', 'para', 'pra', 'pro', 'p'])

/**
 * Logo depois de "(NOME)" no começo, sem separador, estas palavras mostram que o
 * nome é parte da frase: "(GLAUCO) E NENHO - LIVE". Artigo não entra — "(OS
 * CLONES) O CLIPE NOVO" é rótulo mais título.
 */
const PARCERIA = new Set(['e', 'ou', 'x', 'vs', 'feat', 'ft', 'part', 'com'])

/** A palavra que encosta no trecho que sairia, sem pontuação; e se ela é só símbolo. */
function vizinha(token: string): { palavra: string; simbolo: boolean } {
  const palavra = token.replace(/[^a-z0-9]/g, '')
  return { palavra, simbolo: !!token && !palavra && !SO_SEPARADOR.test(token) }
}

/**
 * Minúsculas e sem acento, CARACTERE a caractere, guardando de onde veio cada um —
 * a comparação ignora acento e caixa, mas o corte é feito no texto original.
 */
function comMapa(s: string): { norm: string; origem: number[] } {
  let norm = ''
  const origem: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    for (const k of c) {
      norm += k
      origem.push(i)
    }
  }
  origem.push(s.length)
  return { norm, origem }
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * As palavras do nome, em minúsculas e sem acento. O "e" do meio sai: "Jorge &
 * Mateus" e "Jorge e Mateus" são o mesmo nome escrito de dois jeitos.
 */
function palavrasDo(artista: string): string[] {
  const p = comMapa(artista).norm.split(/[^a-z0-9]+/).filter(Boolean)
  return p.filter((w, i) => !(w === 'e' && i > 0 && i < p.length - 1))
}

/**
 * Um nome como padrão de busca: as palavras em qualquer caixa e sem acento, com
 * qualquer pontuação (ou um "e") entre elas e pontuação no fim — o cadastro tem
 * "Glauco!", e os títulos escrevem "GLAUCO". Parêntese, colchete e aspas NÃO entram
 * como pontuação do fim: "Single (feat. Glauco)" perderia o ")" e ficaria com o "("
 * aberto; 'Divulgar “Arraiá do Nenho”' perderia a aspa que fecha.
 */
function padraoDe(palavras: string[]): string {
  return `${palavras.map(escapar).join('[^a-z0-9]+(?:e[^a-z0-9]+)?')}[^a-z0-9\\s()\\[\\]"'\\u201c\\u201d\\u2018\\u2019\\u00ab\\u00bb]*`
}

/**
 * O nome também vale ABREVIADO pelas primeiras palavras — "(OS CLONES)" para "Os
 * Clones do Brasil", "(IVANA)" para "Ivana Barreto" —, desde que com 4 letras ou
 * mais: "(ANA)" poderia ser outra pessoa. Entre parênteses, que é rótulo de
 * propósito, basta uma palavra. Depois de um separador ("Youtube - Os Clones") são
 * pelo menos duas: uma palavra solta ali pode ser outra coisa — "Turnê - Bahia",
 * numa demanda da Bahia Hits, é o lugar.
 */
function padraoAbreviado(palavras: string[], minimoDePalavras: number): string {
  const variantes = [padraoDe(palavras)]
  for (let k = palavras.length - 1; k >= minimoDePalavras; k--) {
    const inicio = palavras.slice(0, k)
    if (inicio.join('').length >= 4) variantes.push(padraoDe(inicio))
  }
  return `(?:${variantes.join('|')})`
}

/** Corte que não fecha parêntese de fora nem deixa um aberto. */
function equilibrado(trecho: string): boolean {
  const abre = trecho.replace(/[^([]/g, '').length
  const fecha = trecho.replace(/[^)\]]/g, '').length
  return abre === fecha
}

const maiuscula = (c: string) => c !== c.toLowerCase()
const minuscula = (c: string) => c !== c.toUpperCase()

/**
 * Nas formas sem delimitador — "de Nome" e o nome solto no fim —, num título que
 * mistura maiúsculas e minúsculas, o nome só sai se estiver escrito como nome
 * próprio: "Mapa de luz" não perde o "luz" para uma artista Luz. Título numa caixa
 * só ("CARD NOTICIAS NETTO") não tem como dizer, e o corte vale. Artista que se
 * escreve em minúscula ("allan fernandes") vale de qualquer jeito.
 */
function escritoComoNome(titulo: string, inicio: number, artista: string): boolean {
  const letras = Array.from(titulo)
  if (!letras.some(maiuscula) || !letras.some(minuscula)) return true
  const doCadastro = Array.from(artista).find((c) => maiuscula(c) || minuscula(c))
  if (doCadastro && minuscula(doCadastro)) return true
  const c = titulo[inicio] ?? ''
  return maiuscula(c) || !minuscula(c)
}

/** Uma passada com um nome. Devolve o próprio `titulo` quando não há o que tirar. */
function semONome(titulo: string, artista: string): string {
  const palavras = palavrasDo(artista)
  if (!palavras.length) return titulo
  const nome = padraoDe(palavras)
  const entreParenteses = padraoAbreviado(palavras, 1)
  const aposSeparador = padraoAbreviado(palavras, 2)
  const { norm, origem } = comMapa(titulo)

  // No começo: "(NOME) …", "[NOME] …", "NOME - …", "NOME: …".
  let ini = 0
  const comeco = new RegExp(
    `^\\s*(?:[([]\\s*${entreParenteses}\\s*[)\\]]\\s*(?:${SEP_ANTES_DO_TEXTO}\\s*)?|${aposSeparador}${SEP_ROTULO})`,
  ).exec(norm)
  if (comeco && equilibrado(comeco[0])) {
    // "(GLAUCO) E NENHO - LIVE": sem separador depois do parêntese, uma parceria
    // logo em seguida mostra que o nome é parte da frase.
    const semSeparador = /[)\]]\s*$/.test(comeco[0])
    const seguinte = norm.slice(comeco[0].length).trim().split(/\s+/)[0] ?? ''
    const parceria = PARCERIA.has(vizinha(seguinte).palavra) || /^[&+]/.test(seguinte)
    if (!(semSeparador && parceria)) ini = comeco[0].length
  }
  const resto = norm.slice(ini)

  // No fim, na ordem: "… - NOME"; "… (NOME)" e "… de (NOME)"; "… de NOME"; o nome
  // solto ("CARD NOTICIAS NETTO"). Fora o primeiro, todos olham a palavra de antes
  // (LIGACOES); os dois sem delimitador também olham se o nome está escrito como
  // nome, e o solto ainda recusa preposição, vírgula e símbolo colado antes dele
  // ("CARD FELIZ ANIVERSÁRIO, GLAUCO!" é vocativo, "Nenho& Glauco" é dupla).
  const finais: { re: RegExp; forma: 'separador' | 'parenteses' | 'preposicao' | 'solto' }[] = [
    { re: new RegExp(`${SEP_ROTULO}${aposSeparador}\\s*$`), forma: 'separador' },
    {
      re: new RegExp(`\\s*(?:\\s${PREPOSICAO}\\s+)?[([]\\s*${entreParenteses}\\s*[)\\]]\\s*$`),
      forma: 'parenteses',
    },
    { re: new RegExp(`\\s+${PREPOSICAO}\\s+(${nome}\\s*)$`), forma: 'preposicao' },
    { re: new RegExp(`\\s+(${nome}\\s*)$`), forma: 'solto' },
  ]
  let fim = norm.length
  for (const { re, forma } of finais) {
    const m = re.exec(resto)
    if (!m || !equilibrado(m[0])) continue
    if (forma === 'preposicao' || forma === 'solto') {
      const inicioDoNome = ini + m.index + m[0].length - m[1].length
      if (!escritoComoNome(titulo, origem[inicioDoNome], artista)) continue
    }
    if (forma !== 'separador') {
      const antes = resto.slice(0, m.index).trim().split(/\s+/).pop() ?? ''
      const { palavra, simbolo } = vizinha(antes)
      if (LIGACOES.has(palavra) || simbolo) continue
      if (forma === 'solto' && (!palavra || PREPOSICOES.has(palavra) || /[,;&+/]$/.test(antes))) continue
    }
    fim = ini + m.index
    break
  }
  if (ini === 0 && fim === norm.length) return titulo

  let limpo = titulo.slice(origem[ini], origem[fim])
  if (ini > 0) limpo = limpo.replace(new RegExp(`^(?:\\s|${SEP_ANTES_DO_TEXTO}|[,;])+`), '')
  if (fim < norm.length) limpo = limpo.replace(new RegExp(`(?:\\s|${SEP}|[,;])+$`), '')
  limpo = limpo.trim()
  return limpo || titulo
}

/**
 * O título sem o nome do artista escrito à mão nas pontas. Devolve o título
 * original quando não sobra nada (o título ERA só o nome).
 *
 * No começo: "(NOME) …", "[NOME] …", "NOME - …", "NOME: …".
 * No fim: "… - NOME", "… (NOME)", "… [NOME]", "… de (NOME)", "… de NOME",
 * "… com NOME" e o nome solto ("CARD NOTICIAS NETTO").
 *
 * `artista` pode trazer mais de um nome — o do cadastro e o gravado na demanda,
 * que difere quando o artista foi renomeado: o título antigo foi escrito com o
 * nome antigo. Repete as passadas até nada mais sair, para que limpar de novo o
 * que já foi limpo não mude nada: o que o quadro mostra é o que o formulário grava.
 */
export function semArtistaNoTitulo(
  titulo: string,
  artista: string | null | undefined | ReadonlyArray<string | null | undefined>,
): string {
  const lista = typeof artista === 'string' || artista == null ? [artista] : artista
  const nomes = Array.from(new Set(lista.map((n) => (n ?? '').trim()).filter(Boolean)))
  let atual = titulo.trim()
  for (;;) {
    let proximo = atual
    for (const n of nomes) proximo = semONome(proximo, n)
    // Cada passada que tira algo encurta o texto: o laço sempre termina.
    if (proximo === atual) return atual
    atual = proximo
  }
}

/**
 * O título como aparece: `Artista - título`, ou só o título numa demanda interna.
 * `nomeGravado` é o nome que estava na demanda quando ela foi escrita, se o
 * cadastro mudou desde então.
 */
export function tituloComArtista(
  titulo: string,
  artista: string | null | undefined,
  nomeGravado?: string | null,
): string {
  const nome = (artista ?? '').trim()
  if (!nome) return titulo
  return `${nome}${SEPARADOR}${semArtistaNoTitulo(titulo, [nome, nomeGravado])}`
}

/** Separadores em volta de um `{artista}` de modelo — ali a barra também conta. */
const SEP_MODELO = '[-\\u2013\\u2014:|/]'

/**
 * O título sugerido por um modelo de projeto, sem o `{artista}`: o nome já entra
 * sozinho na frente. Leva junto o separador e o "de" que estavam colados nele —
 * "Lançamento — {artista}" vira "Lançamento"; "Show de {artista} em SP", "Show em SP".
 */
export function tituloDoModelo(modelo: string): string {
  return modelo
    .replace(
      new RegExp(`(?:\\s*${SEP_MODELO})?(?:\\s+(?:de|do|da))?\\s*\\{artista\\}\\s*(?:${SEP_MODELO}\\s*)?`, 'gi'),
      ' ',
    )
    .replace(/[([]\s*[)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`^(?:\\s|${SEP_MODELO})+|(?:\\s|${SEP_MODELO})+$`, 'g'), '')
}

/**
 * O título que um modelo sugere para a demanda mãe. Se, sem o nome, ele fica igual
 * ao de uma das etapas do próprio modelo — o "Lançamento — {artista}" das
 * configurações salvas antes de 11/2026 tem o marco "Lançamento" —, vai o nome do
 * modelo ("Lançamento de single"): mãe e marco apareceriam os dois como "Glauco -
 * Lançamento", e o quadro mostraria dois cards iguais.
 */
export function tituloSugeridoDoModelo(m: Pick<TemplateDemanda, 'nome' | 'titulo' | 'etapas'>): string {
  const t = tituloDoModelo(m.titulo ?? '')
  const chave = (s: string) => comMapa(s).norm.replace(/[^a-z0-9]+/g, ' ').trim()
  const repetido = !!t && (m.etapas ?? []).some((e) => chave(e.titulo) === chave(t))
  return repetido ? m.nome : t
}

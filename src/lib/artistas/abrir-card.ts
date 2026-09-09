/**
 * Navegação entre os cards do perfil do artista, a partir do comparativo
 * "Canais" ou de um alerta com âncora.
 *
 * Os cards são irmãos com estado próprio de colapso, e desde que o perfil virou
 * ABAS eles nem sempre estão montados — um CustomEvent na janela resolve os dois
 * casos sem içar estado pro pai só por causa disso.
 */

const EVENTO_ABRIR_CARD = 'perfil:abrir-card'
const EVENTO_TROCAR_ABA = 'perfil:trocar-aba'

/**
 * Em que aba cada card mora. Vive aqui, e não no componente do perfil, porque
 * quem pede a navegação (um alerta, o comparativo) não conhece as abas — só
 * conhece a âncora do card.
 */
export const ABA_DO_CARD: Record<string, string> = {
  'card-instagram': 'canais',
  'card-tiktok': 'canais',
  'card-youtube': 'canais',
  'card-streaming': 'streaming',
}

/**
 * Card pedido antes de existir na tela.
 *
 * Trocar de aba MONTA o card, e a montagem acontece depois do evento — sem esta
 * memória o pedido de expandir se perderia justamente no caso novo (vir de
 * outra aba). O card confere ao montar; o prazo evita que uma visita futura
 * abra sozinha um card que ninguém pediu.
 */
let pendente: { key: string; ate: number } | null = null
const VALIDADE_MS = 2000

/** Pede pro card do canal se expandir (dispara antes do scroll até ele). */
export function abrirCardCanal(key: string): void {
  pendente = { key, ate: Date.now() + VALIDADE_MS }
  window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_CARD, { detail: key }))
}

/** Registra o listener de um card; retorna o cleanup (uso direto em useEffect). */
export function aoAbrirCardCanal(key: string, abrir: () => void): () => void {
  // Chegou depois do pedido (trocou de aba agora): atende e consome.
  if (pendente && pendente.key === key && Date.now() < pendente.ate) {
    pendente = null
    abrir()
  }
  const handler = (e: Event) => {
    if ((e as CustomEvent<string>).detail === key) abrir()
  }
  window.addEventListener(EVENTO_ABRIR_CARD, handler)
  return () => window.removeEventListener(EVENTO_ABRIR_CARD, handler)
}

/** O perfil escuta para trocar de aba quando alguém aponta pra um card de outra. */
export function aoTrocarAba(trocar: (aba: string) => void): () => void {
  const handler = (e: Event) => trocar((e as CustomEvent<string>).detail)
  window.addEventListener(EVENTO_TROCAR_ABA, handler)
  return () => window.removeEventListener(EVENTO_TROCAR_ABA, handler)
}

/**
 * Rola suave até um elemento, repetindo depois que a animação de expansão do
 * card (300ms) termina — a mudança de altura no meio do caminho interrompe o
 * smooth scroll do navegador e deixaria a rolagem parada antes do alvo. A
 * repetição também cobre o card que acabou de montar por troca de aba.
 */
export function rolarAteCard(id: string): void {
  const rolar = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  rolar()
  window.setTimeout(rolar, 450)
}

/**
 * Ir até um card do perfil, venha de onde vier: troca de aba se ele estiver em
 * outra, manda expandir e rola. É o que um alerta ou o comparativo devem chamar
 * — assim nenhum dos dois precisa saber que abas existem.
 */
export function irParaCard(id: string): void {
  const aba = ABA_DO_CARD[id]
  if (aba) window.dispatchEvent(new CustomEvent<string>(EVENTO_TROCAR_ABA, { detail: aba }))
  if (id.startsWith('card-')) abrirCardCanal(id.slice(5))
  rolarAteCard(id)
}

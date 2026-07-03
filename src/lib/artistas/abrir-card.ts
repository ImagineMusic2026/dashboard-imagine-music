/**
 * Sinal para abrir/expandir um card de plataforma do perfil do artista a
 * partir do comparativo "Canais" (ou de um alerta com âncora). Os cards são
 * irmãos com estado próprio de colapso — um CustomEvent na janela evita
 * içar estado pro pai só por causa disso. Só as 4 plataformas participam
 * (instagram/tiktok/youtube/streaming); os demais cards não escutam.
 */

const EVENTO_ABRIR_CARD = 'perfil:abrir-card'

/** Pede pro card do canal se expandir (dispara antes do scroll até ele). */
export function abrirCardCanal(key: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_CARD, { detail: key }))
}

/** Registra o listener de um card; retorna o cleanup (uso direto em useEffect). */
export function aoAbrirCardCanal(key: string, abrir: () => void): () => void {
  const handler = (e: Event) => {
    if ((e as CustomEvent<string>).detail === key) abrir()
  }
  window.addEventListener(EVENTO_ABRIR_CARD, handler)
  return () => window.removeEventListener(EVENTO_ABRIR_CARD, handler)
}

/**
 * Rola suave até um elemento, repetindo depois que a animação de expansão do
 * card (300ms) termina — a mudança de altura no meio do caminho interrompe o
 * smooth scroll do navegador e deixaria a rolagem parada antes do alvo.
 */
export function rolarAteCard(id: string): void {
  const rolar = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  rolar()
  window.setTimeout(rolar, 450)
}

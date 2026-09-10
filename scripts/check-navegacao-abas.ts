/**
 * Confere a navegação entre as abas do perfil do artista, sem navegador.
 *
 *   npx tsx scripts/check-navegacao-abas.ts
 *
 * O `abrir-card` só usa `window` e `document.getElementById`, então um
 * EventTarget do Node basta para exercitar a lógica inteira.
 *
 * O caso que justifica o script é o 4: um alerta na Visão geral aponta para um
 * card que mora em OUTRA aba, e trocar de aba MONTA esse card depois do pedido
 * de expandir. Sem a memória de dois segundos, o "Ver streaming" abriria a aba
 * certa com o card fechado — e isso só apareceria clicando na tela.
 *
 * ⚠️ NÃO usa Firestore: pode rodar à vontade, diferente do
 * `medir-leituras-perfil.mjs`.
 */
const alvo = new EventTarget()
const rolados: string[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = {
  addEventListener: alvo.addEventListener.bind(alvo),
  removeEventListener: alvo.removeEventListener.bind(alvo),
  dispatchEvent: alvo.dispatchEvent.bind(alvo),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).document = {
  getElementById: (id: string) => ({ scrollIntoView: () => rolados.push(id) }),
}

async function main() {
  const { aoAbrirCardCanal, aoTrocarAba, irParaCard, ABA_DO_CARD } = await import(
    '../src/lib/artistas/abrir-card'
  )


  let passou = 0
  let falhou = 0
  const conferir = (nome: string, ok: boolean, detalhe = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FALHOU'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
    ok ? passou++ : falhou++
  }

  // ── 1. o mapa cobre os cards que moram fora da Visão geral ───────────────────
  conferir('streaming aponta pra aba streaming', ABA_DO_CARD['card-streaming'] === 'streaming')
  conferir('instagram aponta pra aba canais', ABA_DO_CARD['card-instagram'] === 'canais')

  // ── 2. card JÁ montado: recebe o pedido pelo evento ──────────────────────────
  {
    let abriu = false
    const limpar = aoAbrirCardCanal('streaming', () => (abriu = true))
    irParaCard('card-streaming')
    conferir('card já montado expande', abriu)
    limpar()
  }

  // ── 3. o perfil recebe a ordem de trocar de aba ──────────────────────────────
  {
    let destino: string | null = null
    const limpar = aoTrocarAba((d) => (destino = d))
    irParaCard('card-instagram')
    conferir('pede a aba certa', destino === 'canais', `recebeu "${destino}"`)
    limpar()
  }

  // ── 4. O CASO QUE IMPORTA: card monta DEPOIS do pedido ───────────────────────
  {
    let abriu = false
    irParaCard('card-streaming') // ninguém escutando ainda — a aba nem trocou
    await new Promise((r) => setTimeout(r, 50)) // React renderizando a aba nova
    const limpar = aoAbrirCardCanal('streaming', () => (abriu = true))
    conferir('card que monta depois AINDA expande', abriu)
    limpar()
  }

  // ── 5. o pedido não sobrevive pra uma visita futura ──────────────────────────
  {
    let abriu = false
    irParaCard('card-streaming')
    await new Promise((r) => setTimeout(r, 2100)) // além dos 2s de validade
    const limpar = aoAbrirCardCanal('streaming', () => (abriu = true))
    conferir('pedido velho NÃO abre card sozinho', !abriu)
    limpar()
  }

  // ── 6. o pedido é consumido: um segundo card não herda ───────────────────────
  {
    let primeiro = false
    let segundo = false
    irParaCard('card-streaming')
    const l1 = aoAbrirCardCanal('streaming', () => (primeiro = true))
    const l2 = aoAbrirCardCanal('streaming', () => (segundo = true))
    conferir('só o primeiro consome o pedido', primeiro && !segundo)
    l1()
    l2()
  }

  // ── 7. rolou até o alvo ──────────────────────────────────────────────────────
  conferir('rolou até o card', rolados.includes('card-streaming'))

  console.log(`\n${passou} passaram, ${falhou} falharam`)
  process.exit(falhou ? 1 : 0)

}

main()

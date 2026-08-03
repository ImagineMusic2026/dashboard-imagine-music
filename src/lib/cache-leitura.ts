/**
 * Cache curto das leituras de COLEÇÃO INTEIRA (roster, métricas, alertas).
 *
 * Motivo: várias partes da tela pedem a mesma lista ao mesmo tempo e cada pedido
 * era uma varredura do Firestore. O caso extremo é o número do sino — sidebar e
 * topbar montam juntas, cada uma chamava `carregarAlertas()` por conta própria, e
 * o mesmo roster de 85 artistas + 83 docs de métricas era lido DUAS vezes só pra
 * mostrar um número. Somando a leitura da própria página, um carregamento passava
 * de 500 leituras; com o cache fica em ~170.
 *
 * Guarda a PROMESSA, não o resultado: quem pede enquanto a primeira leitura ainda
 * está no ar entra na mesma. Falha não fica guardada — o próximo tenta de novo.
 *
 * O TTL é curto de propósito. Isto é remendo de rajada (a mesma tela pedindo em
 * duplicata), não cache de sessão: dado que mudou por fora aparece no minuto
 * seguinte, e o que muda por dentro do painel invalida na hora (ver
 * `invalidarCachesDeLeitura`).
 */

/** Janela em que uma leitura repetida reaproveita a anterior. */
const TTL_PADRAO = 60_000

const invalidadores = new Set<() => void>()

/** Registra um cache "de fora" (ex.: o mapa por slug das métricas) no invalidador geral. */
export function registrarInvalidacao(invalidar: () => void): void {
  invalidadores.add(invalidar)
}

/** Envolve uma leitura sem argumentos num cache curto. */
export function memoCurta<T>(
  carregar: () => Promise<T>,
  ttlMs: number = TTL_PADRAO,
): { ler: () => Promise<T>; invalidar: () => void } {
  let atual: { promessa: Promise<T>; em: number } | null = null

  const invalidar = () => {
    atual = null
  }
  registrarInvalidacao(invalidar)

  const ler = (): Promise<T> => {
    const agora = Date.now()
    if (atual && agora - atual.em < ttlMs) return atual.promessa
    const promessa = carregar().catch((e) => {
      // Só descarta se ninguém já pôs uma leitura mais nova no lugar.
      if (atual?.promessa === promessa) atual = null
      throw e
    })
    atual = { promessa, em: agora }
    return promessa
  }

  return { ler, invalidar }
}

/**
 * Zera TODOS os caches de leitura. Chamar depois de gravar algo que as telas
 * listam (criar/editar/excluir artista, importar roster, sincronizar uma fonte):
 * sem isto a tela recarregaria e ainda veria a lista velha por até um minuto.
 *
 * Zerar tudo, e não só o cache afetado, é de propósito: o custo de errar pra mais
 * é uma releitura, e o de errar pra menos é a equipe olhando dado velho.
 */
export function invalidarCachesDeLeitura(): void {
  invalidadores.forEach((f) => f())
}

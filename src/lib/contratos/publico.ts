import type { Assinatura, CampoContrato } from '@/lib/contratos/tipos'

/**
 * O IO da página pública de assinatura — separado do `client.ts` DE PROPÓSITO,
 * pra não arrastar o SDK do Firebase pro bundle de quem só vai assinar um
 * contrato (mesma razão de `diagnostico/publico.ts`).
 *
 * A convenção de erro aqui é o que a página usa pra distinguir "link morto" de
 * "deu ruim agora":
 *
 * - `null` → o servidor DISSE 404: o link não existe mais.
 * - `throw` → qualquer outra coisa (rede, 500): falha temporária, o link
 *   continua valendo e dá pra tentar de novo.
 *
 * Dizer "link desativado" num soluço de infraestrutura mandaria a pessoa pedir
 * um link novo que não resolveria nada.
 */

export interface ContratoViaLink {
  artistaNome: string
  modeloNome: string
  tipoLabel: string
  /** O texto do modelo como foi copiado pro contrato (o snapshot). */
  texto: string
  /**
   * Automáticas + o que a equipe preencheu, montadas NO SERVIDOR. A página não
   * recalcula nada disto: é o que garante que o texto lido e o texto cujo hash
   * foi gravado são o mesmo.
   */
  valoresBase: Record<string, string>
  /** Só os campos que cabem ao artista. */
  campos: CampoContrato[]
  vigencia: { inicio: string; fim: string | null }
  /** Já assinado: a página mostra o recibo em vez do formulário. */
  assinado: boolean
  assinadoEm?: string | null
  /**
   * As assinaturas já apostas. Vão pra quem tem o link de propósito: é o
   * contrato DELE, e sem elas o artista não consegue levar a própria via.
   */
  assinaturas: { artista: Assinatura | null; imagine: Assinatura | null }
  /** Data de emissão ('YYYY-MM-DD'), a que sai no documento. */
  emitidoEm: string | null
}

export interface EnvioAssinatura {
  valores: Record<string, string>
  nome: string
  documento: string
  /** dataURL PNG do traço. */
  imagem: string
}

const ROTA = '/api/contrato-link'

export async function carregarContratoViaLink(token: string): Promise<ContratoViaLink | null> {
  const res = await fetch(`${ROTA}?token=${encodeURIComponent(token)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Falha ao carregar o contrato (${res.status})`)
  return (await res.json()) as ContratoViaLink
}

/**
 * Assina. Devolve a mensagem de recusa do servidor quando ele recusou por algo
 * que a pessoa pode consertar (campo faltando, link já assinado) — nesses casos
 * repetir o envio não adianta, e esconder o motivo deixaria a tela mentindo.
 */
export async function assinarViaLink(
  token: string,
  envio: EnvioAssinatura,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const res = await fetch(ROTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, aceite: true, ...envio }),
  })
  if (res.ok) return { ok: true }
  if (res.status >= 500) throw new Error(`Falha ao assinar (${res.status})`)
  const corpo = (await res.json().catch(() => null)) as { error?: string } | null
  return { ok: false, erro: corpo?.error ?? 'Não consegui registrar a assinatura.' }
}

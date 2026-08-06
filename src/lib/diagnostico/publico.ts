import type { TipoDiagnostico } from './perguntas'
import type { OrigemDiagnostico } from './client'

/**
 * IO da página PÚBLICA do questionário (`/q/{token}`) — quem responde não tem
 * login, então nada aqui toca o Firestore direto: tudo passa por
 * `/api/questionario-link`, que valida o token e escreve com o Admin SDK.
 *
 * Módulo separado do `client.ts` de propósito: é o par de funções que o form usa
 * no modo `link`, sem arrastar o SDK do Firebase pra dentro do fluxo público.
 */

export type QuestionarioViaLink = {
  tipo: TipoDiagnostico
  artistaNome: string
  respostas: Record<string, string>
  status: 'rascunho' | 'enviado'
  origem: OrigemDiagnostico
}

/** Carrega o questionário do link. `null` = token inválido ou revogado. */
export async function carregarViaLink(token: string): Promise<QuestionarioViaLink | null> {
  const res = await fetch(`/api/questionario-link?token=${encodeURIComponent(token)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Não foi possível carregar o questionário.')
  return (await res.json()) as QuestionarioViaLink
}

/** Salva (rascunho ou envio). Lança se o link foi revogado no meio do caminho. */
export async function salvarViaLink(
  token: string,
  respostas: Record<string, string>,
  enviar: boolean
): Promise<void> {
  const res = await fetch('/api/questionario-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, respostas, enviar }),
  })
  if (!res.ok) throw new Error('Não foi possível salvar as respostas.')
}

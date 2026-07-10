import { agregarPorArtista } from './aggregate'
import { lerOneRpm, OneRpmParseError } from './parse'
import type { OneRpmLote } from './types'

/**
 * Parse do XLSX da OneRPM fora da thread principal.
 *
 * O relatório do selo tem ~120k linhas e leva alguns segundos pra ler; na thread
 * principal isso congelaria a aba (nem o spinner repintaria). Aqui o custo é
 * invisível pro usuário.
 */

export type EntradaWorker = { arquivo: ArrayBuffer }
export type SaidaWorker =
  | { ok: true; etapa: 'lendo' | 'agregando' }
  | { ok: true; etapa: 'pronto'; lote: OneRpmLote }
  | { ok: false; erro: string }

// `self` num worker é o escopo global dele; a lib "dom" do tsconfig não expõe
// DedicatedWorkerGlobalScope, e `Worker` tem a mesma forma que usamos aqui.
const ctx = self as unknown as Worker

ctx.onmessage = (e: MessageEvent<EntradaWorker>) => {
  const responder = (msg: SaidaWorker) => ctx.postMessage(msg)
  try {
    responder({ ok: true, etapa: 'lendo' })
    const { vendas, repasses } = lerOneRpm(new Uint8Array(e.data.arquivo))

    responder({ ok: true, etapa: 'agregando' })
    const lote = agregarPorArtista(vendas, repasses)

    responder({ ok: true, etapa: 'pronto', lote })
  } catch (err) {
    responder({
      ok: false,
      erro:
        err instanceof OneRpmParseError
          ? err.message
          : 'Não consegui ler a planilha. Confirme que é o .xlsx exportado da OneRPM.',
    })
  }
}

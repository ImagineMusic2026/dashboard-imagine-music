'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { invalidarCachesDeLeitura } from '@/lib/cache-leitura'
import { AssinaturaCanvas } from '@/components/contratos/assinatura-canvas'
import { ContratoTexto } from '@/components/contratos/contrato-texto'
import { EMPRESA } from '@/lib/empresa'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/**
 * A contra-assinatura da Imagine, feita pelo painel.
 *
 * O texto mostrado aqui é o mesmo que o artista assinou — e o que vai ser
 * hasheado é o que o SERVIDOR renderiza do banco, não este. A tela mostra pra
 * conferir; quem decide o que foi assinado é a rota.
 */
export function AssinarImagineDialog({
  slug,
  contratoId,
  texto,
  onClose,
  onAssinado,
}: {
  slug: string
  contratoId: string
  texto: string
  onClose: () => void
  onAssinado: () => void | Promise<void>
}) {
  const [nome, setNome] = useState('')
  // `EMPRESA` é `as const`, então sem o tipo explícito o estado nasceria preso
  // ao literal do CNPJ e não aceitaria edição.
  const [documento, setDocumento] = useState<string>(EMPRESA.cnpj)
  const [imagem, setImagem] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!imagem) {
      setErro('Desenhe a assinatura no quadro.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sessão expirada.')
      const res = await fetch('/api/contratos/assinar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, contratoId, nome, documento, imagem }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) {
        setErro(corpo?.error ?? 'Não consegui registrar a assinatura.')
        setEnviando(false)
        return
      }
      // A escrita foi do SERVIDOR, então nada invalidou o cache de leitura aqui
      // — sem isto o card continua mostrando "falta a Imagine" por até 5
      // minutos, e quem clicar de novo leva um 409. As funções de escrita do
      // client fazem isso sozinhas; as que passam por rota precisam fazer na mão.
      invalidarCachesDeLeitura()
      await onAssinado()
    } catch {
      setErro('Não consegui registrar a assinatura. Tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl z-10">
          <div className="font-bold text-ink-100">Assinar como Imagine</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form className="p-5 space-y-4" onSubmit={handleSubmit}>
          <section className="bg-bg-950 border border-bg-700/40 rounded-lg p-4 max-h-56 overflow-y-auto">
            <ContratoTexto texto={texto} />
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ai-nome" className={rotulo}>
                Quem assina pela Imagine
              </label>
              <input
                id="ai-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo do representante"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="ai-doc" className={rotulo}>
                CNPJ
              </label>
              <input
                id="ai-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className={cn(campo, 'num')}
              />
            </div>
          </div>

          <AssinaturaCanvas onChange={setImagem} rotulo="Assinatura do representante" />

          {erro && (
            <p className="text-[12px] text-red-400" role="alert">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-ink-300 hover:bg-bg-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !imagem || !nome.trim()}
              className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {enviando ? 'Registrando…' : 'Assinar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  descricao: ReactNode
  labelConfirmar: string
  /** 'perigo' = vermelho (ações destrutivas) · 'aviso' = âmbar (reversíveis). */
  tom?: 'perigo' | 'aviso'
  /** Ação a executar ao confirmar. Se lançar, o erro aparece dentro do modal. */
  onConfirmar: () => Promise<void>
  onFechar: () => void
}

const TONS = {
  perigo: { icone: 'bg-red-500/15 text-red-400', botao: 'bg-red-500 hover:bg-red-600 text-white' },
  aviso: { icone: 'bg-amber-500/15 text-amber-400', botao: 'bg-amber-500 hover:bg-amber-600 text-bg-950' },
} as const

/** Modal de confirmação no estilo do painel (substitui o window.confirm nativo). */
export function ConfirmarAcaoDialog({
  titulo,
  descricao,
  labelConfirmar,
  tom = 'perigo',
  onConfirmar,
  onFechar,
}: Props) {
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const cores = TONS[tom]

  // Fecha no Esc (a menos que esteja no meio de uma ação).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processando) onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar, processando])

  async function confirmar() {
    if (processando) return
    setErro(null)
    setProcessando(true)
    try {
      await onConfirmar()
      // sucesso: quem chamou fecha o modal (recarregando a lista)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
      setProcessando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm"
        onClick={processando ? undefined : onFechar}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl"
      >
        <button
          type="button"
          onClick={onFechar}
          disabled={processando}
          aria-label="Fechar"
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className={cn('w-12 h-12 rounded-xl grid place-items-center mb-4', cores.icone)}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-bold text-ink-100">{titulo}</h2>
          <div className="text-sm text-ink-400 mt-1.5 leading-relaxed">{descricao}</div>

          {erro && (
            <div
              role="alert"
              className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onFechar}
              disabled={processando}
              className="flex-1 bg-bg-800 hover:bg-bg-700 text-ink-200 font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={processando}
              aria-busy={processando}
              className={cn(
                'flex-1 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-80 disabled:cursor-wait',
                cores.botao
              )}
            >
              {processando && <RefreshCw className="w-4 h-4 animate-spin" />}
              {processando ? 'Processando...' : labelConfirmar}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

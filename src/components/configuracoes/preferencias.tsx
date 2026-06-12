'use client'

import { useEffect, useState } from 'react'
import { Check, Home } from 'lucide-react'
import { getHomePadrao, setHomePadrao, PAGINAS_INICIAIS } from '@/lib/preferencias'
import { cn } from '@/lib/utils'

/** Aba "Preferências" das Configurações. Ajustes salvos no navegador. */
export function Preferencias() {
  const [home, setHome] = useState<string>(PAGINAS_INICIAIS[0].value)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    setHome(getHomePadrao())
  }, [])

  function escolher(value: string) {
    setHome(value)
    setHomePadrao(value)
    setSalvo(true)
    window.setTimeout(() => setSalvo(false), 1800)
  }

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30">
        <div className="font-bold text-ink-100">Preferências</div>
        <p className="text-[12px] text-ink-400 mt-0.5">
          Ajustes de exibição do painel (salvos neste navegador).
        </p>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
          <Home className="w-4 h-4 text-violet-400" />
          Página inicial
        </div>
        <p className="text-[12px] text-ink-500 mt-0.5 mb-3">
          A tela que abre quando você entra no painel.
        </p>

        <div className="grid grid-cols-2 gap-2 max-w-md">
          {PAGINAS_INICIAIS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => escolher(p.value)}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors',
                home === p.value
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/30 font-semibold'
                  : 'bg-bg-950 text-ink-300 border-bg-700/50 hover:bg-bg-800',
              )}
            >
              {p.label}
              {home === p.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>

        {salvo && (
          <div className="mt-3 text-[12px] text-emerald-400">
            Preferência salva — vale a partir do próximo login.
          </div>
        )}
      </div>
    </div>
  )
}

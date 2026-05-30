import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PlataformaCardProps = {
  nomeDisplay: string
  cor: string
  icone: ReactNode
  valorPrincipal: { numero: string; label: string }
  statsSecundarios: { valor: string; label: string }[]
  variacao: { texto: string; positivo: boolean }
  viral?: boolean
  statusApi?: string
}

export function PlataformaCard({
  nomeDisplay,
  cor,
  icone,
  valorPrincipal,
  statsSecundarios,
  variacao,
  viral = false,
  statusApi = 'API',
}: PlataformaCardProps) {
  return (
    <div
      className={cn(
        'bg-bg-900 border rounded-xl p-4 relative overflow-hidden',
        viral ? 'border-cyan-500/30' : 'border-bg-700/40'
      )}
    >
      {viral && (
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-cyan-500/20 blur-2xl pointer-events-none" />
      )}

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-lg grid place-items-center text-white shrink-0 bg-gradient-to-br',
                cor
              )}
            >
              <span className="block w-5 h-5">{icone}</span>
            </div>
            <span className="font-semibold text-sm text-ink-100">{nomeDisplay}</span>
          </div>
          {viral ? (
            <span className="text-[10px] tracking-wider font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded">
              VIRAL
            </span>
          ) : (
            <span className="text-[10px] tracking-wider font-semibold text-ink-500 bg-bg-800 px-2 py-0.5 rounded">
              {statusApi}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="num text-2xl font-bold text-ink-100">{valorPrincipal.numero}</span>
          <span className="text-[11px] text-ink-500">{valorPrincipal.label}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {statsSecundarios.map((s, idx) => (
            <div key={idx} className="min-w-0">
              <div className="text-[12px] num font-semibold text-ink-200 truncate">{s.valor}</div>
              <div className="text-[10px] text-ink-500 truncate">{s.label}</div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            'text-[11px] num mt-3 pt-3 border-t border-bg-700/30',
            variacao.positivo ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {variacao.texto}
        </div>
      </div>
    </div>
  )
}

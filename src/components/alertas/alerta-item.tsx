import type { Alerta, Severidade } from '@/types'
import { artistas } from '@/lib/mock-data/artistas'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { cn } from '@/lib/utils'

type AlertaItemProps = {
  alerta: Alerta
}

const severidadeMap: Record<
  Severidade,
  { borderL: string; badgeBg: string; badgeText: string; label: string }
> = {
  critico: {
    borderL: 'bg-red-500',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    label: 'CRÍTICO',
  },
  atencao: {
    borderL: 'bg-amber-500',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    label: 'ATENÇÃO',
  },
  oportunidade: {
    borderL: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    label: 'OPORTUNIDADE',
  },
  operacional: {
    borderL: 'bg-blue-500',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    label: 'OPERACIONAL',
  },
}

export function AlertaItem({ alerta }: AlertaItemProps) {
  const artista = artistas.find((a) => a.id === alerta.artistaId)
  const sev = severidadeMap[alerta.severidade]

  return (
    <div className="relative flex items-start gap-3 p-4 hover:bg-bg-800/30 transition-colors">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', sev.borderL)} />

      {artista && (
        <AvatarFallback
          iniciais={artista.iniciais}
          gradient={artista.corAvatar}
          size="sm"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              'text-[10px] font-bold tracking-wider px-2 py-0.5 rounded',
              sev.badgeBg,
              sev.badgeText
            )}
          >
            {sev.label}
          </span>
          <span className="text-[11px] text-ink-500 num">{alerta.criadoHa}</span>
        </div>
        <div className="font-semibold text-sm text-ink-100">{alerta.titulo}</div>
        <div className="text-[13px] text-ink-300 mt-0.5">{alerta.descricao}</div>
      </div>

      {alerta.acaoSugerida && (
        <button
          type="button"
          className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-center transition-colors"
        >
          {alerta.acaoSugerida} →
        </button>
      )}
    </div>
  )
}

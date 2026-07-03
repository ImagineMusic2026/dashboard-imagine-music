import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AccentColor = 'violet' | 'amber' | 'emerald' | 'red' | 'fuchsia'

type KPICardProps = {
  label: string
  value: ReactNode
  variation?: { text: string; positive?: boolean }
  subtitle?: ReactNode
  icon?: LucideIcon
  accentColor?: AccentColor
}

const glowMap: Record<AccentColor, string> = {
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/15',
  emerald: 'bg-emerald-500/10',
  red: 'bg-red-500/10',
  fuchsia: 'bg-fuchsia-500/10',
}

const iconColorMap: Record<AccentColor, string> = {
  violet: 'text-violet-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  fuchsia: 'text-fuchsia-400',
}

export function KPICard({
  label,
  value,
  variation,
  subtitle,
  icon: Icon,
  accentColor = 'violet',
}: KPICardProps) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 relative overflow-hidden">
      <div
        className={cn(
          'absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none',
          glowMap[accentColor]
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
            {label}
          </span>
          {Icon && <Icon className={cn('w-5 h-5', iconColorMap[accentColor])} />}
        </div>

        <div className="num text-3xl font-bold text-ink-100">{value}</div>

        {variation && (
          <div
            className={cn(
              'text-[12px] mt-1 num',
              variation.positive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {variation.text}
          </div>
        )}

        {subtitle && !variation && <div className="text-[12px] mt-1">{subtitle}</div>}
      </div>
    </div>
  )
}

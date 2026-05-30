import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PillVariant = 'default' | 'violet' | 'amber' | 'emerald' | 'red' | 'blue'

type PillBadgeProps = {
  children: ReactNode
  variant?: PillVariant
  className?: string
}

const variantMap: Record<PillVariant, string> = {
  default: 'bg-bg-700/50 text-ink-300',
  violet: 'bg-violet-500/15 text-violet-300',
  amber: 'bg-amber-500/15 text-amber-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-red-500/15 text-red-400',
  blue: 'bg-blue-500/15 text-blue-400',
}

export function PillBadge({ children, variant = 'default', className }: PillBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
        variantMap[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

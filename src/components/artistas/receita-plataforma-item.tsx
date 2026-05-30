import type { ReactNode } from 'react'
import type { ReceitaPlataforma } from '@/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

type CorMap = {
  iconBg: string
  iconColor: string
  barFrom: string
  barTo: string
}

const corMap: Record<string, CorMap> = {
  emerald: {
    iconBg: 'bg-emerald-500',
    iconColor: 'text-emerald-100',
    barFrom: 'from-emerald-500',
    barTo: 'to-emerald-400',
  },
  pink: {
    iconBg: 'bg-pink-500',
    iconColor: 'text-pink-100',
    barFrom: 'from-pink-500',
    barTo: 'to-pink-400',
  },
  red: {
    iconBg: 'bg-red-500',
    iconColor: 'text-red-100',
    barFrom: 'from-red-500',
    barTo: 'to-red-400',
  },
  violet: {
    iconBg: 'bg-violet-500',
    iconColor: 'text-violet-100',
    barFrom: 'from-violet-500',
    barTo: 'to-violet-400',
  },
  gray: {
    iconBg: 'bg-bg-700',
    iconColor: 'text-ink-400',
    barFrom: 'from-bg-700',
    barTo: 'to-ink-500',
  },
}

type ReceitaPlataformaItemProps = {
  item: ReceitaPlataforma
  icone: ReactNode
}

export function ReceitaPlataformaItem({ item, icone }: ReceitaPlataformaItemProps) {
  const cores = corMap[item.cor] ?? corMap.gray
  const variacaoCor =
    item.variacao > 5
      ? 'text-emerald-400'
      : item.variacao < -5
      ? 'text-red-400'
      : 'text-ink-400'
  const arrow = item.variacao > 0 ? '↑' : item.variacao < 0 ? '↓' : '—'

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors">
      <div
        className={cn(
          'w-9 h-9 rounded-lg grid place-items-center shrink-0',
          cores.iconBg,
          cores.iconColor
        )}
      >
        <span className="block w-5 h-5">{icone}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-ink-100">{item.plataforma}</span>
          <span className="text-ink-500">·</span>
          <span className="text-[11px] num text-ink-400">
            {formatNumber(item.streams)} streams
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r', cores.barFrom, cores.barTo)}
              style={{ width: `${item.percentualTotal}%` }}
            />
          </div>
          <span className="text-[10px] text-ink-500 num shrink-0 w-8 text-right">
            {item.percentualTotal}%
          </span>
        </div>
      </div>

      <div className="shrink-0 w-32 text-right">
        <div className="num text-base font-bold text-ink-100">{formatCurrency(item.receita)}</div>
        <div className={cn('text-[11px] num mt-0.5', variacaoCor)}>
          {item.variacao === 0 ? '— estável' : `${arrow} ${Math.abs(item.variacao)}%`}
        </div>
      </div>
    </div>
  )
}

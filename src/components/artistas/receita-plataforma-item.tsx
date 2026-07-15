'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ReceitaPlataforma } from '@/types'
import { formatarMoedas } from '@/lib/onerpm/display'
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
  blue: {
    iconBg: 'bg-blue-500',
    iconColor: 'text-blue-100',
    barFrom: 'from-blue-500',
    barTo: 'to-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-500',
    iconColor: 'text-amber-100',
    barFrom: 'from-amber-500',
    barTo: 'to-amber-400',
  },
  cyan: {
    iconBg: 'bg-cyan-500',
    iconColor: 'text-cyan-100',
    barFrom: 'from-cyan-500',
    barTo: 'to-cyan-400',
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
  const [aberto, setAberto] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  const cores = corMap[item.cor] ?? corMap.gray
  // Receita por moeda (novo) ou o valor único em R$ dos mocks antigos (fallback).
  const valor = item.receitaPorMoeda ? formatarMoedas(item.receitaPorMoeda) : formatCurrency(item.receita ?? 0)
  const faixas = item.faixas ?? []
  const faixasVisiveis = verTodas ? faixas : faixas.slice(0, 8)
  const expansivel = faixas.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors',
          expansivel && 'cursor-pointer'
        )}
        role={expansivel ? 'button' : undefined}
        tabIndex={expansivel ? 0 : undefined}
        aria-expanded={expansivel ? aberto : undefined}
        onClick={expansivel ? () => setAberto((v) => !v) : undefined}
        onKeyDown={
          expansivel
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setAberto((v) => !v)
                }
              }
            : undefined
        }
      >
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
            {expansivel && <span className="text-[11px] text-ink-500">· {faixas.length} faixas</span>}
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

        <div className="shrink-0 w-40 text-right">
          <div className="num text-sm font-bold text-ink-100 leading-tight">{valor}</div>
        </div>
        {expansivel && (
          <ChevronDown className={cn('w-4 h-4 text-ink-500 transition-transform shrink-0', aberto && 'rotate-180')} />
        )}
      </div>

      {expansivel && aberto && (
        <div className="px-4 pb-4 pl-16">
          <div className="rounded-lg bg-bg-950/40 border border-bg-700/30 divide-y divide-bg-700/20 overflow-hidden">
            {faixasVisiveis.map((f) => (
              <div key={`${item.plataforma}-${f.titulo}`} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink-100 truncate">{f.titulo}</div>
                  <div className="text-[11px] text-ink-500 num">
                    {formatNumber(f.streams)} streams
                    {f.lancamentos > 1 && ` · ${f.lancamentos} lançamentos`}
                  </div>
                </div>
                <div className="num text-[13px] font-semibold text-ink-200 shrink-0 text-right">
                  {formatarMoedas(f.receitaPorMoeda)}
                </div>
              </div>
            ))}
          </div>
          {faixas.length > 8 && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              className="mt-3 text-[12px] text-amber-400 hover:text-amber-300 font-semibold"
            >
              {verTodas ? 'Mostrar menos' : `Ver todas as ${faixas.length} faixas`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

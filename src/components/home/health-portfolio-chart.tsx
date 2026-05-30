'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const data = [
  { mes: 'fev', medio: 60, mediana: 62 },
  { mes: 'mar', medio: 64, mediana: 65 },
  { mes: 'abr', medio: 67, mediana: 66 },
  { mes: 'mai', medio: 68, mediana: 68 },
]

type TooltipPayload = {
  name?: string | number
  value?: number
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-bg-900 border border-bg-700/60 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-1">{label}</div>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center gap-2 text-[12px]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-ink-300 capitalize">{item.name}</span>
          <span className="num font-semibold text-ink-100 ml-auto">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function HealthPortfolioChart() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="relative h-64" aria-hidden />
  }

  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#2A2540" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2A2540' }}
          />
          <YAxis
            domain={[40, 80]}
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#2A2540', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="medio"
            name="Score médio"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#8B5CF6', stroke: '#0F0B1F', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#A78BFA', stroke: '#0F0B1F', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="mediana"
            name="Mediana"
            stroke="#FBBF24"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 2.5, fill: '#FBBF24', stroke: '#0F0B1F', strokeWidth: 1 }}
          />
          <ReferenceDot
            x="mai"
            y={68}
            r={5}
            fill="#A78BFA"
            stroke="#0F0B1F"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="absolute top-4 right-6 num bg-violet-500/15 text-violet-300 px-2 py-1 rounded-md text-[11px] font-semibold">
        68 hoje
      </div>
    </div>
  )
}

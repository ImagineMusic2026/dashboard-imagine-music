'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Point = { mes: string; score: number }

type ChartTooltipPayload = {
  value?: number
  payload?: Point
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-bg-900 border border-bg-700/60 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-0.5">{label}</div>
      <div className="num text-base font-semibold text-violet-300">
        {payload[0].value} <span className="text-ink-500 text-sm">/100</span>
      </div>
    </div>
  )
}

type HealthEvolutionChartProps = {
  data: Point[]
  releaseMes?: string
  releaseLabel?: string
  scoreAtual?: number
}

export function HealthEvolutionChart({
  data,
  releaseMes,
  releaseLabel,
  scoreAtual,
}: HealthEvolutionChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ultimoMes = data[data.length - 1]?.mes
  const ultimoScore = scoreAtual ?? data[data.length - 1]?.score

  if (!mounted) {
    return <div className="relative h-64" aria-hidden />
  }

  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="violetArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2A2540" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2A2540' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#64748B"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#2A2540', strokeWidth: 1 }} />
          {releaseMes && (
            <ReferenceLine
              x={releaseMes}
              stroke="#A78BFA"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{
                value: releaseLabel ?? 'Release',
                fill: '#A78BFA',
                fontSize: 10,
                position: 'insideTopRight',
                offset: 6,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="score"
            stroke="#8B5CF6"
            strokeWidth={2}
            fill="url(#violetArea)"
            dot={{ r: 3, fill: '#8B5CF6', stroke: '#0F0B1F', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#A78BFA', stroke: '#0F0B1F', strokeWidth: 2 }}
          />
          {ultimoMes && typeof ultimoScore === 'number' && (
            <ReferenceDot
              x={ultimoMes}
              y={ultimoScore}
              r={5}
              fill="#A78BFA"
              stroke="#0F0B1F"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {typeof ultimoScore === 'number' && (
        <div className="absolute top-4 right-6 num bg-violet-500/15 text-violet-300 px-2 py-1 rounded-md text-[11px] font-semibold">
          {ultimoScore} hoje
        </div>
      )}
    </div>
  )
}

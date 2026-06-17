'use client'

import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartResponsivo } from '@/components/shared/chart-responsivo'
import { formatNumber } from '@/lib/utils'

/**
 * Mini gráfico de área (sparkline de tendência) dos cards de métrica do artista.
 * Usa o ChartResponsivo (mede a largura com ResizeObserver e passa width/height
 * numéricos), em vez do ResponsiveContainer — evita o warning "width(-1)" do
 * Recharts.
 */
const ALTURA = 96

export function MiniAreaChart({
  data,
  dataKey,
  cor,
  label,
  gradId,
}: {
  data: object[]
  dataKey: string
  cor: string
  label: string
  gradId: string
}) {
  return (
    <div className="px-2 pt-3">
      <ChartResponsivo altura={ALTURA}>
        {(largura) => (
          <AreaChart width={largura} height={ALTURA} data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity={0.5} />
                <stop offset="100%" stopColor={cor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              contentStyle={{ background: '#1a1a1f', border: '1px solid #33333a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(value) => [formatNumber(Number(value)), label]}
            />
            <Area type="monotone" dataKey={dataKey} stroke={cor} strokeWidth={2} fill={`url(#${gradId})`} />
          </AreaChart>
        )}
      </ChartResponsivo>
    </div>
  )
}

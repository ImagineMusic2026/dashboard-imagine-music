import { useId } from 'react'

type SparklineProps = {
  data: number[]
  color?: string
  width?: number
  height?: number
}

/**
 * Mini-gráfico de tendência em estilo ÁREA: curva suave (Catmull-Rom → Bézier)
 * + preenchimento em degradê. SVG puro (sem recharts), leve o suficiente pra ir
 * numa célula de tabela. Cor pela direção (sobe verde, desce vermelho, estável
 * violeta). 0 pontos → nada; 1 ponto → um ponto (a série preenche com os dias).
 */
export function Sparkline({ data, color, width = 100, height = 24 }: SparklineProps) {
  const gid = `sk-${useId().replace(/:/g, '')}`
  if (data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const sobe = data[data.length - 1] > data[0]
  const desce = data[data.length - 1] < data[0]
  const stroke = color ?? (sobe ? '#34D399' : desce ? '#F87171' : '#8B5CF6')

  const pad = 2
  const usableH = height - pad * 2

  if (data.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <circle cx={width / 2} cy={height / 2} r={2} fill={stroke} />
      </svg>
    )
  }

  const stepX = width / (data.length - 1)
  const pts = data.map((v, i) => ({ x: i * stepX, y: pad + (1 - (v - min) / range) * usableH }))
  const linha = suave(pts)
  const area = `${linha} L ${pts[pts.length - 1].x.toFixed(2)},${height} L ${pts[0].x.toFixed(2)},${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={linha}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Curva suave passando pelos pontos (Catmull-Rom convertido em Bézier cúbico). */
function suave(pts: { x: number; y: number }[]): string {
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

type SparklineProps = {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color, width = 100, height = 24 }: SparklineProps) {
  if (data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const stroke =
    color ??
    (data[data.length - 1] > data[0]
      ? '#34D399'
      : data[data.length - 1] < data[0]
      ? '#F87171'
      : '#64748B')

  // 1 ponto: ainda não dá linha — mostra um ponto (a série preenche com os dias).
  if (data.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <circle cx={width / 2} cy={height / 2} r={2} fill={stroke} />
      </svg>
    )
  }

  const padding = 1.5
  const usableHeight = height - padding * 2
  const stepX = data.length > 1 ? width / (data.length - 1) : 0

  const points = data
    .map((v, i) => {
      const x = i * stepX
      const y = padding + (1 - (v - min) / range) * usableHeight
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

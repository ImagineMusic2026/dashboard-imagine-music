'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Wrapper de gráfico responsivo SEM o ResponsiveContainer do Recharts.
 *
 * O ResponsiveContainer mede o container de forma síncrona no 1º render e, quando
 * ele ainda é 0, loga "The width(-1) and height(-1) of chart should be greater
 * than 0" (cosmético, mas polui o console). Aqui medimos a largura com um
 * ResizeObserver e só renderizamos o gráfico quando ela é > 0 — passando largura
 * e altura numéricas pro chart. Assim o warning nunca acontece.
 *
 * Uso: <ChartResponsivo altura={96}>{(largura) => <AreaChart width={largura} height={96} .../>}</ChartResponsivo>
 */
export function ChartResponsivo({
  altura,
  children,
}: {
  altura: number
  children: (largura: number) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0)
      setLargura((atual) => (w > 0 && w !== atual ? w : atual))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ width: '100%', height: altura }}>
      {largura > 0 && children(largura)}
    </div>
  )
}

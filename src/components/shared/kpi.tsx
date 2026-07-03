import type { ReactNode } from 'react'
import { formatNumber } from '@/lib/utils'

/**
 * Célula de KPI dos cards de plataforma do perfil do artista (grid 3 colunas).
 * Compartilhada entre Instagram/TikTok/YouTube/Streaming — antes cada card
 * carregava uma cópia própria; a cor do ícone é a única diferença entre eles.
 */
export function Kpi({
  icone,
  label,
  valor,
  nota,
  corIcone = 'text-ink-400',
}: {
  icone: ReactNode
  label: string
  valor: string
  nota?: string
  corIcone?: string
}) {
  return (
    <div className="p-4 bg-bg-900">
      <div className="flex items-center gap-1.5 text-ink-500">
        <span className={corIcone}>{icone}</span>
        <span className="text-[10px] tracking-wider font-semibold uppercase">{label}</span>
      </div>
      <div className="num text-lg font-bold text-ink-100 mt-1">{valor}</div>
      {nota && <div className="text-[10px] text-ink-600 num">{nota}</div>}
    </div>
  )
}

/** Número formatado ou "—" para nulo — padrão dos cards de métrica. */
export function fmt(n: number | null | undefined): string {
  return n == null ? '—' : formatNumber(n)
}

/** "há Xmin/h/d" simples a partir de um ISO timestamp. */
export function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

/**
 * Rótulo de janela real de uma série diária ("em 34d"): dias corridos entre o
 * primeiro e o último ponto. Substitui o antigo "no período", que não dizia
 * quanto tempo o delta cobria.
 */
export function janelaDaSerie(dias: { dia: string }[]): string | null {
  if (dias.length < 2) return null
  const ms = Date.parse(dias[dias.length - 1].dia) - Date.parse(dias[0].dia)
  const d = Math.max(1, Math.round(ms / 86_400_000))
  return `em ${d}d`
}

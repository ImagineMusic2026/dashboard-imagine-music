import type { HealthScoreBreakdown as HSBData } from '@/types'

type Pillar = {
  key: keyof HSBData
  label: string
  weight: number
  bg: string
}

const pillars: Pillar[] = [
  { key: 'audiencia', label: 'Audiência', weight: 25, bg: 'bg-violet-500' },
  { key: 'engajamento', label: 'Engajamento', weight: 35, bg: 'bg-pink-500' },
  { key: 'conteudo', label: 'Conteúdo', weight: 25, bg: 'bg-amber-500' },
  { key: 'negocio', label: 'Negócio', weight: 15, bg: 'bg-emerald-500' },
]

function scoreToOpacity(score: number): number {
  const clamped = Math.max(0, Math.min(100, score))
  return 0.3 + (clamped / 100) * 0.7
}

type HealthScoreBreakdownProps = {
  breakdown: HSBData
}

export function HealthScoreBreakdown({ breakdown }: HealthScoreBreakdownProps) {
  return (
    <div className="w-full">
      <div className="flex h-2 rounded overflow-hidden bg-bg-800">
        {pillars.map((p) => (
          <div
            key={p.key}
            className={p.bg}
            style={{
              width: `${p.weight}%`,
              opacity: scoreToOpacity(breakdown[p.key]),
            }}
          />
        ))}
      </div>
      <div className="flex mt-1.5">
        {pillars.map((p) => (
          <div
            key={p.key}
            style={{ width: `${p.weight}%` }}
            className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold"
          >
            {p.label}
          </div>
        ))}
      </div>
    </div>
  )
}

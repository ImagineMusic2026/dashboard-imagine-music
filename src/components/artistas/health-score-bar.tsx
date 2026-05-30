import { cn, getHealthColor, getHealthGradient } from '@/lib/utils'

type HealthScoreBarProps = {
  score: number
  showNumber?: boolean
  size?: 'sm' | 'md'
}

export function HealthScoreBar({ score, showNumber = true, size = 'md' }: HealthScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const trackWidth = size === 'sm' ? 'w-24' : 'w-32'
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="flex items-center gap-2">
      <div className={cn(trackWidth, trackHeight, 'bg-bg-700 rounded-full overflow-hidden')}>
        <div
          className={cn('h-full bg-gradient-to-r rounded-full', getHealthGradient(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showNumber && (
        <span className={cn('num font-bold text-sm', getHealthColor(clamped))}>{clamped}</span>
      )}
    </div>
  )
}

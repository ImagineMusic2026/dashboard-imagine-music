import { cn } from '@/lib/utils'

type AvatarFallbackProps = {
  iniciais: string
  gradient: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap: Record<NonNullable<AvatarFallbackProps['size']>, string> = {
  sm: 'w-7 h-7 text-[10px] rounded-full',
  md: 'w-9 h-9 text-xs rounded-full',
  lg: 'w-12 h-12 text-sm rounded-full',
  xl: 'w-20 h-20 text-2xl rounded-2xl',
}

export function AvatarFallback({ iniciais, gradient, size = 'md' }: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        'bg-gradient-to-br grid place-items-center text-bg-950 font-bold shrink-0',
        gradient,
        sizeMap[size]
      )}
    >
      {iniciais}
    </div>
  )
}

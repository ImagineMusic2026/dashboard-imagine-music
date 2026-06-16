import Image from 'next/image'
import logoImagineMusic from '@/components/images/LOGO_ImagineMusic.png'
import { cn } from '@/lib/utils'

/**
 * Logo da Imagine Music (wordmark horizontal).
 *
 * O arquivo original é preto sobre fundo transparente; como o painel usa tema
 * escuro, aplicamos `brightness-0 invert` para renderizar em branco. Caso um dia
 * seja usado sobre fundo claro, passe `brightness-100 invert-0` no `className`.
 *
 * Controle o tamanho pela altura via `className` (ex.: `h-7`) — a largura é
 * automática para preservar a proporção (~4.38:1).
 */
export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={logoImagineMusic}
      alt="Imagine Music"
      priority={priority}
      className={cn('w-auto select-none brightness-0 invert', className)}
    />
  )
}

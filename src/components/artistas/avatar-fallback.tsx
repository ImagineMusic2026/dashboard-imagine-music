'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type AvatarFallbackProps = {
  iniciais: string
  gradient: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Foto do artista (URL). Se carregar, aparece no lugar das iniciais. */
  fotoUrl?: string | null
}

const sizeMap: Record<NonNullable<AvatarFallbackProps['size']>, string> = {
  sm: 'w-7 h-7 text-[10px] rounded-full',
  md: 'w-9 h-9 text-xs rounded-full',
  lg: 'w-12 h-12 text-sm rounded-full',
  xl: 'w-20 h-20 text-2xl rounded-2xl',
}

export function AvatarFallback({ iniciais, gradient, size = 'md', fotoUrl }: AvatarFallbackProps) {
  // Se a foto quebrar (URL morta/privada), cai nas iniciais — nunca fica vazio.
  const [erro, setErro] = useState(false)
  const mostrarFoto = !!fotoUrl && !erro

  return (
    <div
      className={cn(
        'bg-gradient-to-br grid place-items-center text-bg-950 font-bold shrink-0 overflow-hidden',
        gradient,
        sizeMap[size],
      )}
    >
      {mostrarFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária; next/image exigiria allowlist de domínios
        <img
          src={fotoUrl as string}
          alt=""
          loading="lazy"
          onError={() => setErro(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        iniciais
      )}
    </div>
  )
}

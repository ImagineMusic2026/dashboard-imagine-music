import { cn } from '@/lib/utils'

export type PlataformaTipo =
  | 'instagram'
  | 'spotify'
  | 'youtube'
  | 'tiktok'
  | 'apple-music'
  | 'deezer'
  | 'meta'
  | 'generica'

type PlataformaIconProps = {
  tipo: PlataformaTipo
  className?: string
}

function MetaSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M14.5 6.5h2V3.5h-2.5a4 4 0 0 0-4 4v2.5H7.5v3h2.5v8h3v-8h2.6l.4-3h-3V8c0-.83.67-1.5 1.5-1.5z"
        fill="currentColor"
      />
    </svg>
  )
}

function InstagramSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" />
    </svg>
  )
}

function YoutubeSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="3" fill="currentColor" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="#0F0B1F" />
    </svg>
  )
}

function SpotifySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.5 10.2c2.8-.6 6.3-.4 9 .9M7.7 12.6c2.4-.5 5.1-.3 7.3.7M8 14.8c2-.4 4-.2 5.7.5"
        stroke="#0F0B1F"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function TikTokSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M14 4v8.5a3.5 3.5 0 1 1-2.5-3.36"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 4c0 2.2 1.8 4 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AppleMusicSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M10 7.5l6-1.2v8.5a2.4 2.4 0 1 1-1.4-2.2V8.7L11 9.6v6.8a2.4 2.4 0 1 1-1.4-2.2V7.5z"
        fill="#0F0B1F"
      />
    </svg>
  )
}

function DeezerSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="14" width="3" height="3" fill="currentColor" />
      <rect x="7" y="14" width="3" height="3" fill="currentColor" />
      <rect x="11" y="14" width="3" height="3" fill="currentColor" />
      <rect x="15" y="14" width="3" height="3" fill="currentColor" />
      <rect x="19" y="14" width="3" height="3" fill="currentColor" />
      <rect x="7" y="10" width="3" height="3" fill="currentColor" opacity="0.7" />
      <rect x="11" y="10" width="3" height="3" fill="currentColor" opacity="0.7" />
      <rect x="15" y="10" width="3" height="3" fill="currentColor" opacity="0.7" />
      <rect x="11" y="6" width="3" height="3" fill="currentColor" opacity="0.4" />
      <rect x="15" y="6" width="3" height="3" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

export function PlataformaIcon({ tipo, className }: PlataformaIconProps) {
  const baseClass = cn('w-full h-full', className)
  switch (tipo) {
    case 'instagram':
      return <InstagramSvg className={baseClass} />
    case 'youtube':
      return <YoutubeSvg className={baseClass} />
    case 'spotify':
      return <SpotifySvg className={baseClass} />
    case 'tiktok':
      return <TikTokSvg className={baseClass} />
    case 'apple-music':
      return <AppleMusicSvg className={baseClass} />
    case 'deezer':
      return <DeezerSvg className={baseClass} />
    case 'meta':
      return <MetaSvg className={baseClass} />
    default:
      return <div className={cn('rounded-full bg-current opacity-30', baseClass)} />
  }
}

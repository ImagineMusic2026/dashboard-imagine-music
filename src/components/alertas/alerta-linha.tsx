import Link from 'next/link'
import { Bell, Flame, MoonStar, Star, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { corAvatarDe, iniciaisDe } from '@/lib/artistas/client'
import type { AlertaDerivado, SeveridadeAlerta } from '@/lib/alertas/derivar'
import { cn } from '@/lib/utils'

export const SEV: Record<
  SeveridadeAlerta,
  { label: string; borderL: string; badgeBg: string; badgeText: string }
> = {
  critico: { label: 'CRÍTICO', borderL: 'bg-red-500', badgeBg: 'bg-red-500/15', badgeText: 'text-red-400' },
  atencao: { label: 'ATENÇÃO', borderL: 'bg-amber-500', badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-400' },
  oportunidade: { label: 'OPORTUNIDADE', borderL: 'bg-emerald-500', badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-400' },
  operacional: { label: 'OPERACIONAL', borderL: 'bg-blue-500', badgeBg: 'bg-blue-500/15', badgeText: 'text-blue-400' },
}

export const ICONE_ALERTA: Record<string, LucideIcon> = {
  viralizacao: Flame,
  destaque: Star,
  sem_postar: MoonStar,
  crescimento_seguidores: TrendingUp,
  queda_seguidores: TrendingDown,
  marco_seguidores: Trophy,
}

/** "há 2h", "há 14min", "agora" — recência relativa a partir de um ms. */
export function tempoRelativo(ms: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return `há ${Math.floor(d / 30)}m`
}

/** Uma linha de alerta derivado — compartilhada entre /alertas e a home. */
export function AlertaLinha({ a }: { a: AlertaDerivado }) {
  const sev = SEV[a.severidade]
  const Icone = ICONE_ALERTA[a.categoria] ?? Bell
  const interno = a.url?.startsWith('/') ?? false

  const acao = a.url ? (
    interno ? (
      <Link
        href={a.url}
        className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-center transition-colors"
      >
        {a.acaoSugerida} →
      </Link>
    ) : (
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-center transition-colors"
      >
        {a.acaoSugerida} →
      </a>
    )
  ) : null

  return (
    <div className="relative flex items-start gap-3 p-4 hover:bg-bg-800/30 transition-colors">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', sev.borderL)} />
      <AvatarFallback iniciais={iniciaisDe(a.artistaNome)} gradient={corAvatarDe(a.artistaSlug)} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 rounded', sev.badgeBg, sev.badgeText)}>
            {sev.label}
          </span>
          <span className="text-[11px] text-ink-500 num">{tempoRelativo(a.ts)}</span>
        </div>
        <div className="font-semibold text-sm text-ink-100">{a.artistaNome}</div>
        <div className="text-[13px] text-ink-300 mt-0.5 flex items-start gap-1.5">
          <Icone className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', sev.badgeText)} />
          <span className="min-w-0">{a.descricao}</span>
        </div>
      </div>
      {acao}
    </div>
  )
}

import Link from 'next/link'
import type { Artista, Severidade } from '@/types'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { HealthScoreBar } from '@/components/artistas/health-score-bar'
import { Sparkline } from '@/components/artistas/sparkline'
import { PillBadge } from '@/components/shared/pill-badge'
import { getGestorPorId } from '@/lib/mock-data/gestores'
import { alertas } from '@/lib/mock-data/alertas'
import { ReceitaGate } from '@/components/auth/receita-gate'
import { cn, formatCurrency, formatNumber, formatVariation } from '@/lib/utils'

type ArtistaRowProps = {
  artista: Artista
  atualizado?: string
}

const severidadeOrder: Record<Severidade, number> = {
  critico: 0,
  atencao: 1,
  oportunidade: 2,
  operacional: 3,
}

const severidadeBadge: Record<
  Severidade,
  { bg: string; text: string }
> = {
  critico: { bg: 'bg-red-500/15', text: 'text-red-400' },
  atencao: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  oportunidade: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  operacional: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
}

function getReceitaColor(variacao: number): string {
  if (variacao > 5) return 'text-emerald-400'
  if (variacao < -15) return 'text-red-400'
  if (variacao < -5) return 'text-amber-400'
  return 'text-ink-300'
}

function getSparklineColor(history: number[]): string {
  if (history.length < 2) return '#64748B'
  const last = history[history.length - 1]
  const first = history[0]
  if (last > first) return '#34D399'
  if (last < first) return '#F87171'
  return '#64748B'
}

export function ArtistaRow({ artista, atualizado }: ArtistaRowProps) {
  const gestor = getGestorPorId(artista.gestorId)
  const variacao = formatVariation(artista.receita30dVariacao)
  const receitaCor = getReceitaColor(artista.receita30dVariacao)
  const sparkColor = getSparklineColor(artista.healthHistory)

  const artistaAlertas = alertas.filter((a) => a.artistaId === artista.id)
  const piorSeveridade =
    artistaAlertas.length > 0
      ? artistaAlertas.reduce((acc, cur) =>
          severidadeOrder[cur.severidade] < severidadeOrder[acc.severidade] ? cur : acc
        ).severidade
      : null

  return (
    <tr className="hover:bg-bg-800/50 transition-colors">
      <td className="px-3 py-3">
        <Link
          href={`/artistas/${artista.id}`}
          className="flex items-center gap-3 group"
        >
          <AvatarFallback
            iniciais={artista.iniciais}
            gradient={artista.corAvatar}
            size="md"
          />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-ink-100 group-hover:text-violet-300 transition-colors truncate">
              {artista.nome}
            </div>
            <div className="text-[11px] text-ink-500 num truncate">{artista.handle}</div>
          </div>
        </Link>
      </td>

      <td className="px-3 py-3 text-left">
        <PillBadge>{artista.genero}</PillBadge>
      </td>

      <td className="px-3 py-3 text-left">
        <span className="text-sm text-ink-300">{gestor?.nome ?? '—'}</span>
      </td>

      <td className="px-3 py-3">
        <HealthScoreBar score={artista.healthScore} size="md" />
      </td>

      <td className="px-3 py-3">
        <Sparkline data={artista.healthHistory} color={sparkColor} width={100} height={24} />
      </td>

      <td className="px-3 py-3 text-right num text-sm text-ink-200">
        {formatNumber(artista.audiencia)}
      </td>

      <ReceitaGate>
        <td className="px-3 py-3 text-right">
          <div className={cn('num text-sm font-semibold', receitaCor)}>
            {formatCurrency(artista.receita30d)}
          </div>
          <div className={cn('text-[11px] num mt-0.5', variacao.color)}>{variacao.text}</div>
        </td>
      </ReceitaGate>

      <td className="px-3 py-3 text-center">
        {piorSeveridade && artistaAlertas.length > 0 ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded num font-semibold text-[12px]',
              severidadeBadge[piorSeveridade].bg,
              severidadeBadge[piorSeveridade].text
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {artistaAlertas.length}
          </span>
        ) : (
          <span className="text-ink-600">—</span>
        )}
      </td>

      <td className="px-3 py-3 text-right text-[12px] text-ink-500 num">
        {atualizado ?? '—'}
      </td>
    </tr>
  )
}

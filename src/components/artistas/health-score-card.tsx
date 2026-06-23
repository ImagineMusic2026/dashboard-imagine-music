'use client'

import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { getMetricasSociais } from '@/lib/metricas-sociais/client'
import { derivarHealthScores, type ArtistaSaude, type SaudeBreakdown } from '@/lib/health/score'
import { cn, formatNumber, getHealthColor } from '@/lib/utils'

/**
 * Card "Health Score" do perfil — score REAL do artista, derivado dos mesmos
 * snapshots de `metricas-sociais` (mesma lib da home). Segue o padrão dos
 * outros *ArtistaCard: self-fetch + estados load/vazio/ok. Honesto: sem sinal
 * suficiente, mostra o porquê em vez de um número falso.
 */

type Estado = { st: 'load' } | { st: 'vazio' } | { st: 'ok'; s: ArtistaSaude }

const FAIXA: Record<ArtistaSaude['faixa'], string> = {
  excelente: 'Excelente',
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
}

const PILARES: { key: keyof SaudeBreakdown; label: string; barra: string }[] = [
  { key: 'audiencia', label: 'Audiência', barra: 'bg-violet-500' },
  { key: 'crescimento', label: 'Crescimento', barra: 'bg-emerald-500' },
  { key: 'engajamento', label: 'Engajamento', barra: 'bg-fuchsia-500' },
  { key: 'conteudo', label: 'Conteúdo', barra: 'bg-amber-500' },
]

export function HealthScoreArtistaCard({ slug, nome }: { slug: string; nome: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const doc = await getMetricasSociais(slug)
        if (!vivo) return
        const saudes = doc
          ? derivarHealthScores(new Map([[slug, doc]]), new Map([[slug, nome]]))
          : []
        setEstado(saudes.length ? { st: 'ok', s: saudes[0] } : { st: 'vazio' })
      } catch {
        if (vivo) setEstado({ st: 'vazio' })
      }
    })()
    return () => {
      vivo = false
    }
  }, [slug, nome])

  if (estado.st === 'load') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-center gap-2 text-sm text-ink-400">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Calculando Health Score…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-800 grid place-items-center shrink-0">
          <HeartPulse className="w-5 h-5 text-ink-500" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">Health Score</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            Ainda sem sinal suficiente pra calcular. Assim que houver métricas de seguidores ou
            conteúdo (Instagram, YouTube ou TikTok), o score aparece aqui.
          </p>
        </div>
      </div>
    )
  }

  const { s } = estado

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-violet-400" />
          <span className="font-bold text-ink-100">Health Score</span>
          <span className="text-[10px] tracking-wider font-bold text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30">
            CALCULADO
          </span>
        </div>
        <span className={cn('text-[12px] font-semibold', getHealthColor(s.score))}>{FAIXA[s.faixa]}</span>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
        {/* Score grande */}
        <div className="text-center md:pr-6 md:border-r border-bg-700/40">
          <div className={cn('num text-5xl font-bold leading-none', getHealthColor(s.score))}>
            {s.score}
          </div>
          <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase mt-1">de 100</div>
          {s.seguidoresTotal > 0 && (
            <div className="text-[12px] text-ink-400 mt-2">
              <span className="num text-ink-200">{formatNumber(s.seguidoresTotal)}</span> seguidores
              {s.crescimentoSegPct != null && Math.abs(s.crescimentoSegPct) >= 0.0005 && (
                <span
                  className={cn(
                    'num ml-1.5',
                    s.crescimentoSegPct > 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {s.crescimentoSegPct > 0 ? '↑' : '↓'} {(Math.abs(s.crescimentoSegPct) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Composição */}
        <div className="space-y-2 min-w-0">
          <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase mb-1">
            Composição do score
          </div>
          {PILARES.map((p) => {
            const v = s.breakdown[p.key]
            return (
              <div key={p.key} className="flex items-center gap-3">
                <span className="text-[12px] text-ink-300 w-24 shrink-0">{p.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden">
                  {v != null && (
                    <div className={cn('h-full rounded-full', p.barra)} style={{ width: `${v}%` }} />
                  )}
                </div>
                <span className="num text-[12px] font-semibold text-ink-200 w-7 text-right shrink-0">
                  {v ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

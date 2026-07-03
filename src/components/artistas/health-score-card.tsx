'use client'

import { useEffect, useMemo, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { getHistoricoHealth, getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import type { HistoricoHealthDiaDoc } from '@/lib/metricas-sociais/types'
import {
  PESOS,
  derivarHealthScores,
  type ArtistaSaude,
  type SaudeBreakdown,
} from '@/lib/health/score'
import { MiniAreaChart } from '@/components/artistas/mini-area-chart'
import { cn, formatNumber, getHealthColor } from '@/lib/utils'

/**
 * Card "Health Score" do perfil — score REAL do artista, derivado dos mesmos
 * snapshots de `metricas-sociais` (mesma lib da home). Segue o padrão dos
 * outros *ArtistaCard: self-fetch + estados load/vazio/ok. Honesto: sem sinal
 * suficiente, mostra o porquê em vez de um número falso. Cada pilar é clicável
 * e plota a própria evolução diária (os 5 pilares são carimbados no
 * `historico-health` e antes nunca apareciam).
 */

type Estado = { st: 'load' } | { st: 'vazio' } | { st: 'ok'; s: ArtistaSaude }

const FAIXA: Record<ArtistaSaude['faixa'], string> = {
  excelente: 'Excelente',
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
}

const PILARES: {
  key: keyof SaudeBreakdown
  label: string
  barra: string
  cor: string
  tooltip: string
}[] = [
  {
    key: 'audiencia',
    label: 'Audiência',
    barra: 'bg-violet-500',
    cor: '#8b5cf6',
    tooltip:
      'Tamanho da base: seguidores somados de Instagram + YouTube + TikTok, em escala log (1k→50, 100k→83, 1M→100). "—" = nenhuma rede com contagem coletada.',
  },
  {
    key: 'crescimento',
    label: 'Crescimento',
    barra: 'bg-emerald-500',
    cor: '#10b981',
    tooltip:
      'Momentum: variação % de seguidores desde a coleta anterior (estável→50, +1%→100, −1%→0). "—" = ainda sem medição anterior carimbada.',
  },
  {
    key: 'engajamento',
    label: 'Engajamento',
    barra: 'bg-fuchsia-500',
    cor: '#d946ef',
    tooltip:
      'Resposta por publicação: curtidas+comentários/seguidores (IG) e views/inscritos (YT), em escala log. "—" = sem posts/vídeos recentes coletados.',
  },
  {
    key: 'conteudo',
    label: 'Conteúdo',
    barra: 'bg-amber-500',
    cor: '#f59e0b',
    tooltip:
      'Cadência: recência do último post (45d sem postar→0) + volume nos últimos 30 dias (~3/semana satura). "—" = sem publicações coletadas.',
  },
  // "Carreira & Negócio" no contrato; medido hoje pelo streaming/consumo real (OneRPM).
  {
    key: 'streaming',
    label: 'Carreira & Negócio',
    barra: 'bg-cyan-500',
    cor: '#06b6d4',
    tooltip:
      'Consumo real (OneRPM): volume de streams em 28 dias (escala log) + momentum da última semana vs média. "—" = sem dados de streaming.',
  },
]

const DIA = 86_400_000

export function HealthScoreArtistaCard({ slug, nome }: { slug: string; nome: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  const [hist, setHist] = useState<HistoricoHealthDiaDoc[]>([])
  const [pilarSel, setPilarSel] = useState<keyof SaudeBreakdown | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociaisCached(slug),
          getHistoricoHealth(slug).catch(() => [] as HistoricoHealthDiaDoc[]),
        ])
        if (!vivo) return
        const saudes = doc
          ? derivarHealthScores(new Map([[slug, doc]]), new Map([[slug, nome]]))
          : []
        setHist(historico)
        setEstado(saudes.length ? { st: 'ok', s: saudes[0] } : { st: 'vazio' })
      } catch {
        if (vivo) setEstado({ st: 'vazio' })
      }
    })()
    return () => {
      vivo = false
    }
  }, [slug, nome])

  // Delta do score carimbado (últimos ~7 dias do historico-health, ponto a
  // ponto — nunca o score recalculado agora vs o carimbado, que saltaria).
  const deltaScore = useMemo(() => {
    if (hist.length < 2) return null
    const ult = hist[hist.length - 1]
    const base = hist[Math.max(0, hist.length - 8)]
    const dias = Math.max(1, Math.round((Date.parse(ult.dia) - Date.parse(base.dia)) / DIA))
    return { pts: ult.score - base.score, dias }
  }, [hist])

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
  // Pilar mais fraco, factual (nome + pontos) — o rótulo alarmista do
  // motivoDominante ("Perdendo seguidores") só é verdadeiro quando o pilar
  // está de fato baixo, então aqui mostramos o número e deixamos a frase
  // pros casos atenção/crítico do card de insights.
  const maisFraco = PILARES.reduce<{ label: string; v: number } | null>((pior, p) => {
    const v = s.breakdown[p.key]
    if (v == null) return pior
    return !pior || v < pior.v ? { label: p.label, v } : pior
  }, null)
  const pilarAtivo = pilarSel ? PILARES.find((p) => p.key === pilarSel) ?? null : null
  const serieChart = pilarAtivo ? hist.filter((h) => h[pilarAtivo.key] != null) : hist

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
          {maisFraco && (
            <div
              className={cn(
                'text-[11px] mt-1.5',
                s.faixa === 'critico' ? 'text-red-400' : s.faixa === 'atencao' ? 'text-amber-400' : 'text-ink-500',
              )}
            >
              Pilar mais fraco: {maisFraco.label} · <span className="num">{maisFraco.v}</span>
            </div>
          )}
        </div>

        {/* Composição — cada pilar clicável plota a própria evolução */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase">
              Composição do score
            </span>
            <span className="text-[10px] text-ink-600 hidden sm:block">
              clique num pilar pra ver a evolução dele
            </span>
          </div>
          {PILARES.map((p) => {
            const v = s.breakdown[p.key]
            const ativo = pilarSel === p.key
            return (
              <button
                key={p.key}
                type="button"
                title={p.tooltip}
                onClick={() => setPilarSel((sel) => (sel === p.key ? null : p.key))}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg px-1.5 -mx-1.5 py-1 text-left transition-colors',
                  ativo ? 'bg-bg-800/60' : 'hover:bg-bg-800/40',
                )}
              >
                <span className={cn('text-[12px] w-40 shrink-0', ativo ? 'text-ink-100 font-semibold' : 'text-ink-300')}>
                  {p.label} <span className="text-ink-600 num">· {Math.round(PESOS[p.key] * 100)}%</span>
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden">
                  {v != null && (
                    <div className={cn('h-full rounded-full', p.barra)} style={{ width: `${v}%` }} />
                  )}
                </div>
                <span className="num text-[12px] font-semibold text-ink-200 w-7 text-right shrink-0">
                  {v ?? '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {hist.length >= 2 ? (
        <div className="border-t border-bg-700/30">
          <div className="px-5 pt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase">
              {pilarAtivo ? `Evolução · ${pilarAtivo.label}` : `Evolução do score · ${hist.length} dias`}
            </span>
            {!pilarAtivo && deltaScore && deltaScore.pts !== 0 && (
              <span
                className={cn(
                  'num text-[11px] font-semibold',
                  deltaScore.pts > 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {deltaScore.pts > 0 ? '↑ +' : '↓ −'}
                {Math.abs(deltaScore.pts)} pts em {deltaScore.dias}d
              </span>
            )}
          </div>
          {serieChart.length >= 2 ? (
            <MiniAreaChart
              data={serieChart}
              dataKey={pilarAtivo?.key ?? 'score'}
              cor={pilarAtivo?.cor ?? '#8b5cf6'}
              label={pilarAtivo?.label ?? 'Score'}
              gradId={`health-${slug}-${pilarAtivo?.key ?? 'score'}`}
            />
          ) : (
            <div className="px-5 py-3 text-[12px] text-ink-500">
              Este pilar ainda não tem pontos diários suficientes pra plotar.
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-3 border-t border-bg-700/30 text-[12px] text-ink-500">
          A evolução do score aparece após alguns dias de coleta diária.
        </div>
      )}
    </div>
  )
}

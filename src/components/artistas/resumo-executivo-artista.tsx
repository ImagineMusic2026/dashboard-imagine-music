'use client'

import { useEffect, useState } from 'react'
import { Eye, HeartPulse, PlayCircle, Users } from 'lucide-react'
import { KPICard } from '@/components/shared/kpi-card'
import { derivarHealthScores, type ArtistaSaude } from '@/lib/health/score'
import { getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import { cn, formatNumber, getHealthColor } from '@/lib/utils'

/**
 * Faixa executiva do perfil do artista — "o artista em 10 segundos", antes de
 * qualquer card detalhado: seguidores somados (IG+YT+TikTok), streams 28d,
 * Health Score e alcance do Instagram. Cada número carrega a própria janela no
 * rótulo (28d, 30d…) porque as fontes NÃO são comparáveis entre si. Sem dado é
 * "—" com nota, nunca zero. Some quando o artista ainda não tem nenhum snapshot
 * (os cards abaixo explicam como conectar cada fonte).
 */

type Estado = { st: 'load' } | { st: 'vazio' } | { st: 'ok'; doc: MetricasSociaisDoc; saude: ArtistaSaude | null }

const FAIXA: Record<ArtistaSaude['faixa'], string> = {
  excelente: 'Excelente',
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
}

const ACCENT_FAIXA: Record<ArtistaSaude['faixa'], 'emerald' | 'violet' | 'amber' | 'red'> = {
  excelente: 'emerald',
  saudavel: 'violet',
  atencao: 'amber',
  critico: 'red',
}

export function ResumoExecutivoArtista({ slug, nome }: { slug: string; nome: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })

  useEffect(() => {
    let vivo = true
    getMetricasSociaisCached(slug)
      .then((doc) => {
        if (!vivo) return
        if (!doc) return setEstado({ st: 'vazio' })
        const saudes = derivarHealthScores(new Map([[slug, doc]]), new Map([[slug, nome]]))
        setEstado({ st: 'ok', doc, saude: saudes[0] ?? null })
      })
      .catch(() => vivo && setEstado({ st: 'vazio' }))
    return () => {
      vivo = false
    }
  }, [slug, nome])

  if (estado.st === 'load') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-900 border border-bg-700/40 rounded-xl h-[104px] animate-pulse" />
        ))}
      </div>
    )
  }

  if (estado.st === 'vazio') return null

  const { doc, saude } = estado
  const ig = doc.instagram
  const st = doc.streaming

  // Seguidores somados nas redes com contagem pública — mesma conta do pilar
  // de audiência do Health Score.
  const seguidores =
    (ig?.seguidores ?? 0) +
    (doc.tiktok?.seguidores ?? 0) +
    (doc.youtube && !doc.youtube.inscritosOcultos ? doc.youtube.inscritos ?? 0 : 0)
  const cresc = saude?.crescimentoSegPct ?? null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Seguidores totais"
        icon={Users}
        accentColor="violet"
        value={seguidores > 0 ? formatNumber(seguidores) : '—'}
        variation={
          cresc != null && Math.abs(cresc) >= 0.0005
            ? {
                text: `${cresc > 0 ? '↑' : '↓'} ${(Math.abs(cresc) * 100).toFixed(1)}% vs coleta anterior`,
                positive: cresc > 0,
              }
            : undefined
        }
        subtitle={<span className="text-ink-500">IG + YouTube + TikTok</span>}
      />
      <KPICard
        label="Streams · 28d"
        icon={PlayCircle}
        accentColor="amber"
        value={st?.streams28d != null ? formatNumber(st.streams28d) : '—'}
        subtitle={
          st ? (
            <span className="text-ink-500 num">últimos 7d: {st.streams7d != null ? formatNumber(st.streams7d) : '—'}</span>
          ) : (
            <span className="text-ink-600">sem dados OneRPM</span>
          )
        }
      />
      <KPICard
        label="Health Score"
        icon={HeartPulse}
        accentColor={saude ? ACCENT_FAIXA[saude.faixa] : 'violet'}
        value={
          saude ? (
            <span className={getHealthColor(saude.score)}>
              {saude.score}
              <span className="text-ink-500 text-lg font-semibold"> /100</span>
            </span>
          ) : (
            '—'
          )
        }
        subtitle={
          saude ? (
            <span className={cn('font-semibold', getHealthColor(saude.score))}>{FAIXA[saude.faixa]}</span>
          ) : (
            <span className="text-ink-600">sem sinal suficiente</span>
          )
        }
      />
      <KPICard
        label={`Alcance IG${ig ? ` · ${ig.janelaDias}d` : ''}`}
        icon={Eye}
        accentColor="fuchsia"
        value={ig?.alcance != null ? formatNumber(ig.alcance) : '—'}
        subtitle={
          ig ? (
            <span className="text-ink-500 num block truncate">@{ig.username}</span>
          ) : (
            <span className="text-ink-600">Instagram não conectado</span>
          )
        }
      />
    </div>
  )
}

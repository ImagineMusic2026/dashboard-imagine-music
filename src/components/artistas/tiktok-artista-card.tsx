'use client'

import { useEffect, useState } from 'react'
import { MiniAreaChart } from '@/components/artistas/mini-area-chart'
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Play,
  Share2,
  ThumbsUp,
  Video,
} from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { Kpi, fmt, formatarQuando, janelaDaSerie } from '@/components/shared/kpi'
import { aoAbrirCardCanal } from '@/lib/artistas/abrir-card'
import { getHistoricoTikTok, getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import type { HistoricoTikTokDiaDoc, TikTokSnapshot } from '@/lib/metricas-sociais/types'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Card "TikTok" do perfil do artista — métricas REAIS coletadas via Display API
 * (coleção `metricas-sociais`, legível por qualquer membro ativo). Espelha o
 * InstagramArtistaCard: estados carregando / sem dados / com dados, sparkline de
 * seguidores e grid de KPIs. NÃO vai dentro de <ReceitaGate> (não é sensível).
 */

type Estado =
  | { st: 'load' }
  | { st: 'vazio' }
  | { st: 'ok'; tt: TikTokSnapshot; historico: HistoricoTikTokDiaDoc[] }

export function TikTokArtistaCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  // Começa recolhido — expande pelo header ou pelo comparativo "Canais".
  const [aberto, setAberto] = useState(false)

  useEffect(() => aoAbrirCardCanal('tiktok', () => setAberto(true)), [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociaisCached(slug),
          getHistoricoTikTok(slug).catch(() => [] as HistoricoTikTokDiaDoc[]),
        ])
        if (!vivo) return
        if (doc?.tiktok) setEstado({ st: 'ok', tt: doc.tiktok, historico })
        else setEstado({ st: 'vazio' })
      } catch {
        if (vivo) setEstado({ st: 'vazio' })
      }
    })()
    return () => {
      vivo = false
    }
  }, [slug])

  if (estado.st === 'load') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-center gap-2 text-sm text-ink-400">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Carregando métricas do TikTok…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-cyan-400">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="tiktok" />
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">TikTok</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            Sem métricas coletadas ainda. Conecte a conta em{' '}
            <span className="text-cyan-300">Integrações → TikTok</span> (ou o artista conecta no
            próprio portal) e rode uma sincronização para ver seguidores, curtidas e engajamento aqui.
          </p>
        </div>
      </div>
    )
  }

  const { tt, historico } = estado
  const serie = historico.filter((h) => h.seguidores != null)
  const primeiro = serie[0]?.seguidores ?? null
  const variacao = primeiro != null && tt.seguidores != null ? tt.seguidores - primeiro : null
  const notaRec = tt.videosConsiderados ? `últimos ${tt.videosConsiderados}` : 'recentes'

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title={aberto ? 'Recolher métricas' : 'Expandir métricas'}
        className={cn(
          'w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-bg-800/30 transition-colors',
          aberto && 'border-b border-bg-700/30',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-cyan-400">
            <span className="w-5 h-5 block">
              <PlataformaIcon tipo="tiktok" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">TikTok</span>
              <span className="text-[10px] tracking-wider font-bold text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                DADOS REAIS
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5 num">
              {tt.username ? `@${tt.username} · ` : ''}atualizado {formatarQuando(tt.coletadoEm)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
              Seguidores
            </div>
            <div className="num text-2xl font-bold text-ink-100">{fmt(tt.seguidores)}</div>
            {variacao != null && variacao !== 0 && (
              <div
                className={cn('text-[11px] num', variacao > 0 ? 'text-emerald-400' : 'text-red-400')}
              >
                {variacao > 0 ? '+' : '−'}
                {formatNumber(Math.abs(variacao))} {janelaDaSerie(serie) ?? 'no período'}
              </div>
            )}
          </div>
          <span
            className="grid place-items-center w-7 h-7 rounded-md text-ink-400 hover:text-ink-100 hover:bg-bg-700/40 transition-colors shrink-0"
            aria-hidden
          >
            {aberto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </span>
        </div>
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden min-h-0">
          {aberto && serie.length >= 2 && (
            <MiniAreaChart data={serie} dataKey="seguidores" cor="#22d3ee" label="Seguidores" gradId="tiktok-grad" />
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi corIcone="text-cyan-400/70" icone={<Heart className="w-4 h-4" />} label="Curtidas" valor={fmt(tt.curtidas)} nota="total" />
            <Kpi corIcone="text-cyan-400/70" icone={<Video className="w-4 h-4" />} label="Vídeos" valor={fmt(tt.videos)} nota="total" />
            <Kpi corIcone="text-cyan-400/70" icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(tt.viewsRecentes)} nota={notaRec} />
            <Kpi corIcone="text-cyan-400/70" icone={<ThumbsUp className="w-4 h-4" />} label="Curtidas" valor={fmt(tt.curtidasRecentes)} nota={notaRec} />
            <Kpi corIcone="text-cyan-400/70" icone={<MessageCircle className="w-4 h-4" />} label="Comentários" valor={fmt(tt.comentariosRecentes)} nota={notaRec} />
            <Kpi corIcone="text-cyan-400/70" icone={<Share2 className="w-4 h-4" />} label="Compart." valor={fmt(tt.compartilhamentosRecentes)} nota={notaRec} />
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import { getHistoricoTikTok, getMetricasSociais } from '@/lib/metricas-sociais/client'
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
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociais(slug),
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
                {formatNumber(Math.abs(variacao))} no período
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
          {serie.length >= 2 && (
            <div className="px-2 pt-3">
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tiktok-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                      contentStyle={{
                        background: '#1a1a1f',
                        border: '1px solid #33333a',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value) => [formatNumber(Number(value)), 'Seguidores']}
                    />
                    <Area
                      type="monotone"
                      dataKey="seguidores"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#tiktok-grad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi icone={<Heart className="w-4 h-4" />} label="Curtidas" valor={fmt(tt.curtidas)} nota="total" />
            <Kpi icone={<Video className="w-4 h-4" />} label="Vídeos" valor={fmt(tt.videos)} nota="total" />
            <Kpi icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(tt.viewsRecentes)} nota={notaRec} />
            <Kpi icone={<ThumbsUp className="w-4 h-4" />} label="Curtidas" valor={fmt(tt.curtidasRecentes)} nota={notaRec} />
            <Kpi icone={<MessageCircle className="w-4 h-4" />} label="Comentários" valor={fmt(tt.comentariosRecentes)} nota={notaRec} />
            <Kpi icone={<Share2 className="w-4 h-4" />} label="Compart." valor={fmt(tt.compartilhamentosRecentes)} nota={notaRec} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  icone,
  label,
  valor,
  nota,
}: {
  icone: ReactNode
  label: string
  valor: string
  nota?: string
}) {
  return (
    <div className="p-4 bg-bg-900">
      <div className="flex items-center gap-1.5 text-ink-500">
        <span className="text-cyan-400/70">{icone}</span>
        <span className="text-[10px] tracking-wider font-semibold uppercase">{label}</span>
      </div>
      <div className="num text-lg font-bold text-ink-100 mt-1">{valor}</div>
      {nota && <div className="text-[10px] text-ink-600 num">{nota}</div>}
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  return n == null ? '—' : formatNumber(n)
}

/** "há Xmin/h/d" simples a partir de um ISO timestamp. */
function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

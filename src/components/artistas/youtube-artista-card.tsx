'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Timer,
  UserMinus,
  UserPlus,
  Video,
} from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { getHistoricoYouTube, getMetricasSociais } from '@/lib/metricas-sociais/client'
import type { HistoricoYouTubeDiaDoc, YouTubeSnapshot } from '@/lib/metricas-sociais/types'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Card "YouTube" do perfil do artista. Camada PÚBLICA (Data API) aparece para
 * qualquer canal mapeado; quando o artista conectou via OAuth, a seção
 * ANALYTICS (privada) é exibida em destaque. Legível por toda a equipe.
 */

type Estado =
  | { st: 'load' }
  | { st: 'vazio' }
  | { st: 'ok'; yt: YouTubeSnapshot; historico: HistoricoYouTubeDiaDoc[] }

export function YouTubeArtistaCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociais(slug),
          getHistoricoYouTube(slug).catch(() => [] as HistoricoYouTubeDiaDoc[]),
        ])
        if (!vivo) return
        if (doc?.youtube) setEstado({ st: 'ok', yt: doc.youtube, historico })
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
        Carregando métricas do YouTube…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 grid place-items-center shrink-0 text-red-400">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="youtube" />
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">YouTube</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            Sem métricas coletadas ainda. Em{' '}
            <span className="text-red-300">Integrações → YouTube</span>, use “Descobrir canais” e
            “Sincronizar” para ver inscritos, views e engajamento. Para os dados de Analytics
            (tempo de exibição, retenção), o artista conecta a conta dele.
          </p>
        </div>
      </div>
    )
  }

  const { yt, historico } = estado
  const serie = historico.filter((h) => h.inscritos != null)
  const primeiro = serie[0]?.inscritos ?? null
  const variacao = primeiro != null && yt.inscritos != null ? yt.inscritos - primeiro : null
  const notaRec = yt.videosConsiderados ? `últimos ${yt.videosConsiderados}` : 'recentes'
  const a = yt.analytics

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
          <div className="w-9 h-9 rounded-lg bg-red-500/15 grid place-items-center shrink-0 text-red-400">
            <span className="w-5 h-5 block">
              <PlataformaIcon tipo="youtube" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">YouTube</span>
              <span className="text-[10px] tracking-wider font-bold text-red-300 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                DADOS REAIS
              </span>
              {a && (
                <span className="text-[10px] tracking-wider font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  + ANALYTICS
                </span>
              )}
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5 num">
              {yt.handle ? `@${yt.handle} · ` : yt.titulo ? `${yt.titulo} · ` : ''}atualizado{' '}
              {formatarQuando(yt.coletadoEm)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
              Inscritos
            </div>
            <div className="num text-2xl font-bold text-ink-100">
              {yt.inscritos == null ? '—' : formatNumber(yt.inscritos)}
            </div>
            {yt.inscritosOcultos ? (
              <div className="text-[10px] text-ink-600">ocultos pelo canal</div>
            ) : (
              variacao != null &&
              variacao !== 0 && (
                <div className={cn('text-[11px] num', variacao > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {variacao > 0 ? '+' : '−'}
                  {formatNumber(Math.abs(variacao))} no período
                </div>
              )
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
                      <linearGradient id="yt-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
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
                      formatter={(value) => [formatNumber(Number(value)), 'Inscritos']}
                    />
                    <Area type="monotone" dataKey="inscritos" stroke="#ef4444" strokeWidth={2} fill="url(#yt-grad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi icone={<Eye className="w-4 h-4" />} label="Views totais" valor={fmt(yt.viewsTotais)} nota="canal" />
            <Kpi icone={<Video className="w-4 h-4" />} label="Vídeos" valor={fmt(yt.videos)} nota="total" />
            <Kpi icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(yt.viewsRecentes)} nota={notaRec} />
            <Kpi icone={<Heart className="w-4 h-4" />} label="Curtidas" valor={fmt(yt.curtidasRecentes)} nota={notaRec} />
            <Kpi icone={<MessageCircle className="w-4 h-4" />} label="Comentários" valor={fmt(yt.comentariosRecentes)} nota={notaRec} />
            <Kpi icone={<Eye className="w-4 h-4" />} label="Inscritos" valor={fmt(yt.inscritos)} nota={yt.inscritosOcultos ? 'ocultos' : 'canal'} />
          </div>

          {a && (
            <div className="border-t border-bg-700/30">
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <span className="text-[10px] tracking-[0.18em] font-bold text-emerald-400">
                  ANALYTICS · PRIVADO
                </span>
                <span className="text-[10px] text-ink-600 num">{a.periodoDias}d</span>
                <span className="flex-1 h-px bg-bg-700/40" />
              </div>
              <div className="grid grid-cols-3 gap-px bg-bg-700/30">
                <Kpi
                  icone={<Clock className="w-4 h-4" />}
                  label="Tempo exib."
                  valor={fmtHoras(a.minutosExibidos)}
                  nota="horas"
                  cor="emerald"
                />
                <Kpi
                  icone={<Timer className="w-4 h-4" />}
                  label="Duração média"
                  valor={fmtDuracao(a.duracaoMediaSeg)}
                  nota="min:seg"
                  cor="emerald"
                />
                <Kpi icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(a.views)} nota={`${a.periodoDias}d`} cor="emerald" />
                <Kpi icone={<UserPlus className="w-4 h-4" />} label="Inscritos +" valor={fmt(a.inscritosGanhos)} nota={`${a.periodoDias}d`} cor="emerald" />
                <Kpi icone={<UserMinus className="w-4 h-4" />} label="Inscritos −" valor={fmt(a.inscritosPerdidos)} nota={`${a.periodoDias}d`} cor="red" />
              </div>
            </div>
          )}
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
  cor = 'red',
}: {
  icone: ReactNode
  label: string
  valor: string
  nota?: string
  cor?: 'red' | 'emerald'
}) {
  return (
    <div className="p-4 bg-bg-900">
      <div className="flex items-center gap-1.5 text-ink-500">
        <span className={cor === 'emerald' ? 'text-emerald-400/70' : 'text-red-400/70'}>{icone}</span>
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

/** Minutos assistidos -> horas (formatado). */
function fmtHoras(min: number | null | undefined): string {
  if (min == null) return '—'
  return formatNumber(Math.round(min / 60))
}

/** Segundos -> "m:ss". */
function fmtDuracao(seg: number | null | undefined): string {
  if (seg == null) return '—'
  const m = Math.floor(seg / 60)
  const s = Math.round(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

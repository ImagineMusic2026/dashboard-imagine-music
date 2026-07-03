'use client'

import { useEffect, useState } from 'react'
import { MiniAreaChart } from '@/components/artistas/mini-area-chart'
import {
  BarChart3,
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
import { Kpi, fmt, formatarQuando, janelaDaSerie } from '@/components/shared/kpi'
import { aoAbrirCardCanal } from '@/lib/artistas/abrir-card'
import { getHistoricoYouTube, getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
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
  // Começa recolhido — expande pelo header ou pelo comparativo "Canais".
  const [aberto, setAberto] = useState(false)

  useEffect(() => aoAbrirCardCanal('youtube', () => setAberto(true)), [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociaisCached(slug),
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
                  {formatNumber(Math.abs(variacao))} {janelaDaSerie(serie) ?? 'no período'}
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
          {aberto && serie.length >= 2 && (
            <MiniAreaChart data={serie} dataKey="inscritos" cor="#ef4444" label="Inscritos" gradId="yt-grad" />
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi corIcone="text-red-400/70" icone={<Eye className="w-4 h-4" />} label="Views totais" valor={fmt(yt.viewsTotais)} nota="canal" />
            <Kpi corIcone="text-red-400/70" icone={<Video className="w-4 h-4" />} label="Vídeos" valor={fmt(yt.videos)} nota="total" />
            <Kpi corIcone="text-red-400/70" icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(yt.viewsRecentes)} nota={notaRec} />
            <Kpi corIcone="text-red-400/70" icone={<Heart className="w-4 h-4" />} label="Curtidas" valor={fmt(yt.curtidasRecentes)} nota={notaRec} />
            <Kpi corIcone="text-red-400/70" icone={<MessageCircle className="w-4 h-4" />} label="Comentários" valor={fmt(yt.comentariosRecentes)} nota={notaRec} />
            <Kpi
              corIcone="text-red-400/70"
              icone={<BarChart3 className="w-4 h-4" />}
              label="Média/vídeo"
              valor={
                yt.viewsRecentes != null && yt.videosConsiderados
                  ? formatNumber(Math.round(yt.viewsRecentes / yt.videosConsiderados))
                  : '—'
              }
              nota="views por vídeo"
            />
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
                  corIcone="text-emerald-400/70"
                  icone={<Clock className="w-4 h-4" />}
                  label="Tempo exib."
                  valor={fmtHoras(a.minutosExibidos)}
                  nota="horas"
                />
                <Kpi
                  corIcone="text-emerald-400/70"
                  icone={<Timer className="w-4 h-4" />}
                  label="Duração média"
                  valor={fmtDuracao(a.duracaoMediaSeg)}
                  nota="min:seg"
                />
                <Kpi corIcone="text-emerald-400/70" icone={<Play className="w-4 h-4" />} label="Views" valor={fmt(a.views)} nota={`${a.periodoDias}d`} />
                <Kpi corIcone="text-emerald-400/70" icone={<UserPlus className="w-4 h-4" />} label="Inscritos +" valor={fmt(a.inscritosGanhos)} nota={`${a.periodoDias}d`} />
                <Kpi corIcone="text-red-400/70" icone={<UserMinus className="w-4 h-4" />} label="Inscritos −" valor={fmt(a.inscritosPerdidos)} nota={`${a.periodoDias}d`} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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

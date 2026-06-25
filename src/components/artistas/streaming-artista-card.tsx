'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Globe, Music2, PlayCircle, SkipForward } from 'lucide-react'
import { MiniAreaChart } from '@/components/artistas/mini-area-chart'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { getHistoricoStreaming, getMetricasSociais } from '@/lib/metricas-sociais/client'
import type { HistoricoStreamingDiaDoc, StreamingSnapshot } from '@/lib/metricas-sociais/types'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Card "Streaming" do perfil do artista — plays/skips REAIS do feed de trends da
 * OneRPM (coleção `metricas-sociais`, campo `streaming`). NÃO é receita (essa fica
 * no ReceitaArtistaCard, admin-only), então fica visível a qualquer membro ativo.
 * Espelha o TikTokArtistaCard: estados carregando / sem dados / com dados.
 */

type Estado =
  | { st: 'load' }
  | { st: 'vazio' }
  | { st: 'ok'; s: StreamingSnapshot; historico: HistoricoStreamingDiaDoc[] }

const COR_TXT: Record<string, string> = {
  emerald: 'text-emerald-400',
  pink: 'text-pink-400',
  red: 'text-red-400',
  violet: 'text-violet-400',
  blue: 'text-blue-400',
  cyan: 'text-cyan-400',
  amber: 'text-amber-400',
  gray: 'text-ink-400',
}

export function StreamingArtistaCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociais(slug),
          getHistoricoStreaming(slug).catch(() => [] as HistoricoStreamingDiaDoc[]),
        ])
        if (!vivo) return
        if (doc?.streaming) setEstado({ st: 'ok', s: doc.streaming, historico })
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
        Carregando streaming…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-amber-400">
          <PlayCircle className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">Streaming</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            Sem dados de streaming ainda. Os plays vêm do feed da OneRPM (via SFTP); rode a
            sincronização para ver streams, skips e países por plataforma aqui.
          </p>
        </div>
      </div>
    )
  }

  const { s, historico } = estado
  const serie = historico.filter((h) => h.streams != null)

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title={aberto ? 'Recolher streaming' : 'Expandir streaming'}
        className={cn(
          'w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-bg-800/30 transition-colors',
          aberto && 'border-b border-bg-700/30',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-amber-400">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">Streaming</span>
              <span className="text-[10px] tracking-wider font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                DADOS REAIS
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              via OneRPM · {s.lojas.length} loja{s.lojas.length === 1 ? '' : 's'} · atualizado{' '}
              {formatarQuando(s.coletadoEm)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
              Streams · 28d
            </div>
            <div className="num text-2xl font-bold text-ink-100">{fmt(s.streams28d ?? s.streams)}</div>
            <div className="text-[11px] num text-ink-500">{fmt(s.streams)} no período</div>
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
            <MiniAreaChart data={serie} dataKey="streams" cor="#f59e0b" label="Streams/dia" gradId="streaming-grad" />
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi icone={<PlayCircle className="w-4 h-4" />} label="Streams" valor={fmt(s.streams)} nota={`${s.periodo.dias}d`} />
            <Kpi icone={<SkipForward className="w-4 h-4" />} label="Skip rate" valor={pct(s.skipRate)} nota={`${fmt(s.skips)} skips`} />
            <Kpi icone={<Music2 className="w-4 h-4" />} label="Faixas" valor={fmt(s.faixas)} nota="ISRCs" />
          </div>

          {s.porPlataforma.length > 0 && (
            <div className="border-t border-bg-700/30 p-4">
              <div className="text-[10px] tracking-wider font-semibold uppercase text-ink-500 mb-2">
                Por plataforma
              </div>
              <div className="space-y-1.5">
                {s.porPlataforma.map((p) => (
                  <div key={p.plataforma} className="flex items-center gap-2.5">
                    <span className={cn('w-4 h-4 block shrink-0', COR_TXT[p.corKey] ?? 'text-ink-400')}>
                      <PlataformaIcon tipo={p.iconeTipo} />
                    </span>
                    <span className="text-[13px] text-ink-200 w-28 shrink-0 truncate">{p.plataforma}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${barra(p.streams, s.porPlataforma[0].streams)}%` }}
                      />
                    </div>
                    <span className="num text-[12px] text-ink-300 w-16 text-right shrink-0">{fmt(p.streams)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s.porPais.length > 0 && (
            <div className="border-t border-bg-700/30 p-4">
              <div className="flex items-center gap-1.5 text-[10px] tracking-wider font-semibold uppercase text-ink-500 mb-2">
                <Globe className="w-3.5 h-3.5" /> Top países
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.porPais.slice(0, 8).map((p) => (
                  <span
                    key={p.pais}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-800 border border-bg-700/50 text-[12px]"
                  >
                    <Bandeira pais={p.pais} />
                    <span className="text-ink-200 font-semibold">{p.pais}</span>
                    <span className="num text-ink-400">{fmt(p.streams)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Bandeira (imagem) a partir do código ISO-2 do país. Emoji de bandeira não
 * renderiza no Windows (vira as letras), então usamos o flagcdn — PNG leve e
 * cacheado, que funciona em qualquer SO.
 */
function Bandeira({ pais }: { pais: string }) {
  const cc = (pais || '').trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(cc)) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/20x15/${cc}.png`}
      srcSet={`https://flagcdn.com/40x30/${cc}.png 2x`}
      width={16}
      height={12}
      alt=""
      loading="lazy"
      className="rounded-[2px] shrink-0"
    />
  )
}

function Kpi({ icone, label, valor, nota }: { icone: ReactNode; label: string; valor: string; nota?: string }) {
  return (
    <div className="p-4 bg-bg-900">
      <div className="flex items-center gap-1.5 text-ink-500">
        <span className="text-amber-400/70">{icone}</span>
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

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${(n * 100).toFixed(1)}%`
}

function barra(v: number, max: number): number {
  if (!max || max <= 0) return 0
  return Math.max(3, Math.round((v / max) * 100))
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

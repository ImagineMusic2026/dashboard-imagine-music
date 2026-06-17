'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Eye, Grid3x3, Heart, TrendingUp, UserPlus, Users } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { MiniAreaChart } from '@/components/artistas/mini-area-chart'
import { getHistoricoInstagram, getMetricasSociais } from '@/lib/metricas-sociais/client'
import type { HistoricoDiaDoc, InstagramSnapshot } from '@/lib/metricas-sociais/types'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Card "Instagram" do perfil do artista — métricas REAIS coletadas via Meta
 * Graph API (coleção `metricas-sociais`, legível por qualquer membro ativo).
 * NÃO vai dentro de <ReceitaGate>: métricas sociais não são sensíveis. Trata os
 * estados carregando / sem dados / com dados, igual ao ReceitaArtistaCard.
 */

type Estado =
  | { st: 'load' }
  | { st: 'vazio' }
  | { st: 'ok'; ig: InstagramSnapshot; historico: HistoricoDiaDoc[] }

export function InstagramArtistaCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  const [aberto, setAberto] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, historico] = await Promise.all([
          getMetricasSociais(slug),
          getHistoricoInstagram(slug).catch(() => [] as HistoricoDiaDoc[]),
        ])
        if (!vivo) return
        if (doc?.instagram) setEstado({ st: 'ok', ig: doc.instagram, historico })
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
        Carregando métricas do Instagram…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 grid place-items-center shrink-0 text-white">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="instagram" />
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">Instagram</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            Sem métricas coletadas ainda. Vincule a conta em{' '}
            <span className="text-violet-300">Integrações → Instagram (Meta)</span> e rode uma
            sincronização para ver seguidores, alcance e engajamento aqui.
          </p>
        </div>
      </div>
    )
  }

  const { ig, historico } = estado
  const serie = historico.filter((h) => h.seguidores != null)
  const primeiro = serie[0]?.seguidores ?? null
  const variacao = primeiro != null && ig.seguidores != null ? ig.seguidores - primeiro : null

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
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 grid place-items-center shrink-0 text-white">
            <span className="w-5 h-5 block">
              <PlataformaIcon tipo="instagram" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">Instagram</span>
              <span className="text-[10px] tracking-wider font-bold text-fuchsia-300 px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30">
                DADOS REAIS
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5 num">
              @{ig.username} · atualizado {formatarQuando(ig.coletadoEm)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
              Seguidores
            </div>
            <div className="num text-2xl font-bold text-ink-100">{fmt(ig.seguidores)}</div>
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
          {aberto && serie.length >= 2 && (
            <MiniAreaChart data={serie} dataKey="seguidores" cor="#e879f9" label="Seguidores" gradId="ig-grad" />
          )}

          <div className="grid grid-cols-3 gap-px bg-bg-700/30 border-t border-bg-700/30">
            <Kpi icone={<Eye className="w-4 h-4" />} label="Alcance" valor={fmt(ig.alcance)} nota={`${ig.janelaDias}d`} />
            <Kpi icone={<TrendingUp className="w-4 h-4" />} label="Visualizações" valor={fmt(ig.visualizacoes)} nota={`${ig.janelaDias}d`} />
            <Kpi icone={<Heart className="w-4 h-4" />} label="Interações" valor={fmt(ig.interacoesTotais)} nota={`${ig.janelaDias}d`} />
            <Kpi icone={<Users className="w-4 h-4" />} label="Contas engajadas" valor={fmt(ig.contasEngajadas)} nota={`${ig.janelaDias}d`} />
            <Kpi icone={<UserPlus className="w-4 h-4" />} label="Visitas ao perfil" valor={fmt(ig.visitasPerfil)} nota={`${ig.janelaDias}d`} />
            <Kpi icone={<Grid3x3 className="w-4 h-4" />} label="Publicações" valor={fmt(ig.publicacoes)} nota="total" />
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
        <span className="text-fuchsia-400/70">{icone}</span>
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

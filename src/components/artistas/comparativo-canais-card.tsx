'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, PlayCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { Sparkline } from '@/components/artistas/sparkline'
import { ChartResponsivo } from '@/components/shared/chart-responsivo'
import { janelaDaSerie } from '@/components/shared/kpi'
import { abrirCardCanal, rolarAteCard } from '@/lib/artistas/abrir-card'
import {
  getHistoricoInstagram,
  getHistoricoStreaming,
  getHistoricoTikTok,
  getHistoricoYouTube,
  getMetricasSociaisCached,
} from '@/lib/metricas-sociais/client'
import { cn, formatNumber } from '@/lib/utils'

/**
 * "Canais" — comparativo lado a lado das plataformas do artista: onde a base
 * está, onde cresce e onde encolhe, com a tendência real (série diária) de
 * cada canal numa linha só. A barra de participação divide a base (IG + TikTok
 * + YouTube); streaming aparece na lista mas fora da barra (consumo ≠ estoque
 * de seguidores). Clique numa linha rola até o card detalhado do canal.
 */

interface Canal {
  key: string
  nome: string
  /** Logo da plataforma; null usa o ícone genérico de play (streaming agrega lojas). */
  icone: PlataformaTipo | null
  corTexto: string
  corSpark: string
  corBarra: string
  /** Valor atual (seguidores/inscritos/streams 28d); null = indisponível. */
  valor: number | null
  unidade: string
  serie: number[]
  /** "em 34d" — janela real da série carregada. */
  janela: string | null
  /** Variação % primeiro→último ponto da série (null sem base). */
  pct: number | null
  /** Entra na barra de participação da base de seguidores. */
  participa: boolean
  anchor: string
}

type Estado = { st: 'load' } | { st: 'vazio' } | { st: 'ok'; canais: Canal[] }

export function ComparativoCanaisCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [doc, hIg, hTt, hYt, hSt] = await Promise.all([
          getMetricasSociaisCached(slug),
          getHistoricoInstagram(slug).catch(() => []),
          getHistoricoTikTok(slug).catch(() => []),
          getHistoricoYouTube(slug).catch(() => []),
          getHistoricoStreaming(slug).catch(() => []),
        ])
        if (!vivo) return
        if (!doc) return setEstado({ st: 'vazio' })

        const canais: Canal[] = []

        if (doc.instagram) {
          const pontos = hIg.filter((h) => h.seguidores != null)
          canais.push(
            canal('instagram', 'Instagram', 'instagram', 'text-fuchsia-400', '#e879f9', 'bg-fuchsia-500/80',
              doc.instagram.seguidores, 'seguidores', pontos, (p) => p.seguidores as number, true),
          )
        }
        if (doc.tiktok) {
          const pontos = hTt.filter((h) => h.seguidores != null)
          canais.push(
            canal('tiktok', 'TikTok', 'tiktok', 'text-cyan-400', '#22d3ee', 'bg-cyan-500/80',
              doc.tiktok.seguidores, 'seguidores', pontos, (p) => p.seguidores as number, true),
          )
        }
        if (doc.youtube) {
          const oculto = doc.youtube.inscritosOcultos === true
          const pontos = hYt.filter((h) => h.inscritos != null)
          canais.push(
            canal('youtube', 'YouTube', 'youtube', 'text-red-400', '#ef4444', 'bg-red-500/80',
              oculto ? null : doc.youtube.inscritos, oculto ? 'inscritos ocultos' : 'inscritos',
              oculto ? [] : pontos, (p) => p.inscritos as number, !oculto),
          )
        }
        if (doc.streaming) {
          const pontos = hSt.filter((h) => h.streams != null)
          const c = canal('streaming', 'Streaming', null, 'text-amber-400', '#f59e0b', 'bg-amber-500/80',
            doc.streaming.streams28d ?? doc.streaming.streams, 'streams · 28d',
            pontos, (p) => p.streams as number, false)
          // Fluxo diário: comparar primeiro→último ponto engana (o último dia do
          // feed SFTP chega incompleto). Usa o momentum semanal do snapshot —
          // última semana vs média das 3 anteriores, mesma régua do card.
          const s28 = doc.streaming.streams28d ?? 0
          const s7 = doc.streaming.streams7d ?? 0
          const prior = (s28 - s7) / 3
          c.pct = s28 > 0 && prior > 0 ? (s7 - prior) / prior : null
          c.janela = c.pct != null ? 'semana vs média' : null
          canais.push(c)
        }

        setEstado(canais.length >= 2 ? { st: 'ok', canais } : { st: 'vazio' })
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
        Comparando canais…
      </div>
    )
  }

  // Com menos de 2 canais não há o que comparar — os cards individuais bastam.
  if (estado.st === 'vazio') return null

  const { canais } = estado
  const base = canais.filter((c) => c.participa && c.valor != null && c.valor > 0)
  const totalBase = base.reduce((soma, c) => soma + (c.valor ?? 0), 0)

  const comTendencia = canais.filter((c) => c.pct != null && c.serie.length >= 7)
  const pior = comTendencia.length
    ? comTendencia.reduce((a, b) => ((a.pct ?? 0) <= (b.pct ?? 0) ? a : b))
    : null
  const melhor = comTendencia.length
    ? comTendencia.reduce((a, b) => ((a.pct ?? 0) >= (b.pct ?? 0) ? a : b))
    : null

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-violet-400" />
          <span className="font-bold text-ink-100">Canais</span>
        </div>
        <span className="text-[11px] text-ink-600 hidden sm:block">clique num canal pra ver o detalhe</span>
      </div>

      {/* Distribuição da base de seguidores (IG + TikTok + YouTube) */}
      {totalBase > 0 && base.length >= 2 && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-[10px] tracking-wider font-semibold uppercase text-ink-500 mb-1.5">
            <span>Distribuição da base</span>
            <span className="num normal-case tracking-normal">{formatNumber(totalBase)} seguidores</span>
          </div>
          <div className="flex h-2 rounded-full bg-bg-800 overflow-hidden">
            {base.map((c) => (
              <div
                key={c.key}
                className={cn('h-full', c.corBarra)}
                style={{ width: `${((c.valor ?? 0) / totalBase) * 100}%` }}
                title={`${c.nome}: ${formatNumber(c.valor ?? 0)} (${(((c.valor ?? 0) / totalBase) * 100).toFixed(0)}%)`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="divide-y divide-bg-700/30 mt-2">
        {canais.map((c) => {
          const share = c.participa && c.valor != null && totalBase > 0 ? (c.valor / totalBase) * 100 : null
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                // Expande o card do canal (eles começam recolhidos) e rola até ele.
                abrirCardCanal(c.key)
                rolarAteCard(c.anchor)
              }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-bg-800/30 text-left transition-colors"
            >
              <span className={cn('w-4 h-4 block shrink-0', c.corTexto)}>
                {c.icone ? <PlataformaIcon tipo={c.icone} /> : <PlayCircle className="w-4 h-4" />}
              </span>
              <span className="text-[13px] text-ink-200 font-semibold w-20 sm:w-24 shrink-0">{c.nome}</span>
              {/* A tendência preenche toda a largura livre da linha (medida pelo
                  ChartResponsivo) — largura fixa parecia gráfico "cortado". */}
              <span className="flex-1 min-w-0 hidden sm:block">
                {c.serie.length >= 2 ? (
                  <ChartResponsivo altura={28}>
                    {(largura) => <Sparkline data={c.serie} color={c.corSpark} width={largura} height={28} />}
                  </ChartResponsivo>
                ) : (
                  <span className="block text-[10px] text-ink-600">sem tendência ainda</span>
                )}
              </span>
              <span className="flex-1 sm:flex-none sm:w-24 min-w-0 shrink-0 text-right">
                <span className="num text-[11px] text-ink-500">
                  {share != null ? `${share.toFixed(0)}% da base` : c.key === 'streaming' ? 'consumo' : ''}
                </span>
              </span>
              <span className="w-28 shrink-0 text-right">
                <span className="num text-sm font-bold text-ink-100 block">
                  {c.valor == null ? '—' : formatNumber(c.valor)}
                </span>
                <span className="text-[10px] text-ink-600 block">{c.unidade}</span>
                {c.pct != null && Math.abs(c.pct) >= 0.0005 && c.janela && (
                  <span
                    className={cn(
                      'num text-[11px] block',
                      c.pct > 0 ? 'text-emerald-400' : c.pct < 0 ? 'text-red-400' : 'text-ink-500',
                    )}
                  >
                    {c.pct > 0 ? '+' : c.pct < 0 ? '−' : ''}
                    {Math.abs(c.pct * 100).toFixed(1)}% {c.janela}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {(melhor?.pct != null && melhor.pct > 0.002) || (pior?.pct != null && pior.pct < -0.002) ? (
        <div className="px-5 py-3 border-t border-bg-700/30 flex flex-wrap gap-2">
          {melhor?.pct != null && melhor.pct > 0.002 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12px] text-emerald-300">
              <TrendingUp className="w-3.5 h-3.5" />
              Melhor momento: {melhor.nome}
              <span className="num">+{((melhor.pct ?? 0) * 100).toFixed(1)}%</span>
            </span>
          )}
          {pior?.pct != null && pior.pct < -0.002 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-300">
              <TrendingDown className="w-3.5 h-3.5" />
              Merece atenção: {pior.nome}
              <span className="num">−{Math.abs((pior.pct ?? 0) * 100).toFixed(1)}%</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

function canal<T extends { dia: string }>(
  key: string,
  nome: string,
  icone: PlataformaTipo | null,
  corTexto: string,
  corSpark: string,
  corBarra: string,
  valor: number | null | undefined,
  unidade: string,
  pontos: T[],
  valorDe: (p: T) => number,
  participa: boolean,
): Canal {
  const serie = pontos.map(valorDe)
  const primeiro = serie[0]
  const ultimo = serie[serie.length - 1]
  const pct = serie.length >= 2 && primeiro > 0 ? (ultimo - primeiro) / primeiro : null
  return {
    key,
    nome,
    icone,
    corTexto,
    corSpark,
    corBarra,
    valor: valor ?? null,
    unidade,
    serie,
    janela: janelaDaSerie(pontos),
    pct,
    participa,
    anchor: `card-${key}`,
  }
}

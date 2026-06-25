'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe, ListMusic } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { getStreamingDetalhe } from '@/lib/metricas-sociais/client'
import type { StreamingDetalheDoc } from '@/lib/metricas-sociais/types'
import { cn, formatNumber } from '@/lib/utils'

/**
 * Card de ANÁLISE de streaming (Fase 1 do analytics): tabela de faixas (ISRC)
 * ordenável por skip rate ou por streams + skip rate por país. Lê o detalhe
 * granular da subcoleção `streaming-detalhe/atual` (separada do snapshot pra não
 * pesar as listas). A faixa aparece por ISRC até o catálogo de títulos da OneRPM.
 */

type Estado = { st: 'load' } | { st: 'vazio' } | { st: 'ok'; d: StreamingDetalheDoc }

type Ordem = 'skip' | 'streams'

/** Streams mínimos pra a faixa entrar no ranking de "mais puladas" (corta ruído). */
const PISO_SKIP = 200

export function StreamingAnaliticoCard({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })
  const [ordem, setOrdem] = useState<Ordem>('skip')
  const [todas, setTodas] = useState(false)
  const [titulos, setTitulos] = useState<Record<string, { titulo: string; link: string }>>({})

  useEffect(() => {
    let vivo = true
    getStreamingDetalhe(slug)
      .then((d) => {
        if (!vivo) return
        setEstado(d && d.porFaixa.length ? { st: 'ok', d } : { st: 'vazio' })
      })
      .catch(() => vivo && setEstado({ st: 'vazio' }))
    return () => {
      vivo = false
    }
  }, [slug])

  const faixas = useMemo(() => {
    if (estado.st !== 'ok') return []
    const base = estado.d.porFaixa.map((f) => ({
      ...f,
      rate: f.streams > 0 ? f.skips / f.streams : 0,
    }))
    if (ordem === 'skip') {
      return base.filter((f) => f.streams >= PISO_SKIP).sort((a, b) => b.rate - a.rate)
    }
    return base.sort((a, b) => b.streams - a.streams)
  }, [estado, ordem])

  const visiveis = useMemo(() => (todas ? faixas : faixas.slice(0, 12)), [faixas, todas])

  // Resolve os títulos (via Deezer, pela rota) das faixas visíveis ainda sem nome.
  useEffect(() => {
    const pendentes = visiveis.map((f) => f.isrc).filter((isrc) => !(isrc in titulos))
    if (!pendentes.length) return
    let vivo = true
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) return
        const res = await fetch('/api/faixas/titulos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isrcs: pendentes }),
        })
        const data = (await res.json().catch(() => null)) as {
          titulos?: Record<string, { titulo: string; link: string }>
        } | null
        if (vivo && data?.titulos) setTitulos((prev) => ({ ...prev, ...data.titulos }))
      } catch {
        /* sem título: mantém o ISRC */
      }
    })()
    return () => {
      vivo = false
    }
    // titulos só filtra os pendentes — fora das deps de propósito (evita loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis])

  if (estado.st === 'load') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-center gap-2 text-sm text-ink-400">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Carregando análise de faixas…
      </div>
    )
  }

  if (estado.st === 'vazio') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-amber-400">
          <ListMusic className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100 text-sm">Análise de faixas</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-xl">
            O detalhe por faixa aparece após a próxima sincronização do streaming.
          </p>
        </div>
      </div>
    )
  }

  const { d } = estado
  const paises = d.porPais
    .map((p) => ({ ...p, rate: p.streams > 0 ? p.skips / p.streams : 0 }))
    .slice(0, 8)

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 grid place-items-center">
            <ListMusic className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="font-bold text-ink-100">Análise de faixas</div>
            <div className="text-[12px] text-ink-500">
              {d.porFaixa.length} faixas · janela de {d.periodo.dias} dias
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 bg-bg-950 border border-bg-700/50 rounded-lg p-0.5">
          <Aba ativa={ordem === 'skip'} onClick={() => { setOrdem('skip'); setTodas(false) }}>
            Mais puladas
          </Aba>
          <Aba ativa={ordem === 'streams'} onClick={() => { setOrdem('streams'); setTodas(false) }}>
            Mais tocadas
          </Aba>
        </div>
      </div>

      <div className="px-2 py-1">
        <div className="grid grid-cols-[1.5rem_1fr_4.5rem_4.5rem_3.5rem] gap-2 px-3 py-2 text-[10px] tracking-wider font-semibold uppercase text-ink-500">
          <span>#</span>
          <span>Faixa</span>
          <span className="text-right">Streams</span>
          <span className="text-right">Skips</span>
          <span className="text-right">Skip</span>
        </div>
        {visiveis.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-ink-500">
            Nenhuma faixa com volume suficiente nesta janela.
          </div>
        ) : (
          visiveis.map((f, i) => {
            const info = titulos[f.isrc]
            return (
              <div
                key={f.isrc}
                className="grid grid-cols-[1.5rem_1fr_4.5rem_4.5rem_3.5rem] gap-2 px-3 py-2 rounded-lg hover:bg-bg-800/30 items-center text-[13px]"
              >
                <span className="text-ink-600 num text-center">{i + 1}</span>
                {info ? (
                  <a
                    href={info.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 hover:underline transition-colors flex items-center gap-1 min-w-0"
                    title={info.titulo}
                  >
                    <span className="truncate">{info.titulo}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-ink-600" />
                  </a>
                ) : (
                  <span className="num text-ink-400 truncate" title={f.isrc}>
                    {f.isrc}
                  </span>
                )}
                <span className="num text-ink-300 text-right">{formatNumber(f.streams)}</span>
                <span className="num text-ink-400 text-right">{formatNumber(f.skips)}</span>
                <span className={cn('num font-semibold text-right', corSkip(f.rate))}>
                  {(f.rate * 100).toFixed(0)}%
                </span>
              </div>
            )
          })
        )}
      </div>

      {faixas.length > 12 && (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          className="w-full px-5 py-2.5 border-t border-bg-700/30 text-[12px] text-violet-400 hover:text-violet-300 transition-colors"
        >
          {todas ? 'Ver menos' : `Ver todas (${faixas.length})`}
        </button>
      )}

      {paises.length > 0 && (
        <div className="border-t border-bg-700/30 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[10px] tracking-wider font-semibold uppercase text-ink-500 mb-2.5">
            <Globe className="w-3.5 h-3.5" /> Por país · streams e skip
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {paises.map((p) => (
              <div key={p.pais} className="bg-bg-950/50 rounded-lg px-3 py-2 border border-bg-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-200">{p.pais}</span>
                  <span className={cn('text-[11px] num font-semibold', corSkip(p.rate))}>
                    {(p.rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-[11px] num text-ink-500 mt-0.5">{formatNumber(p.streams)} streams</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-bg-700/30 px-5 py-2.5 text-[11px] text-ink-500">
        Títulos resolvidos pelo <span className="text-ink-400">Deezer</span> (clique pra abrir a faixa). O
        que não estiver lá aparece por ISRC; o catálogo da OneRPM substitui depois.
      </div>
    </div>
  )
}

function Aba({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-[12px] px-2.5 py-1 rounded-md transition-colors',
        ativa ? 'bg-bg-800 text-ink-100 font-semibold' : 'text-ink-400 hover:text-ink-200',
      )}
    >
      {children}
    </button>
  )
}

function corSkip(rate: number): string {
  if (rate >= 0.5) return 'text-red-400'
  if (rate >= 0.35) return 'text-amber-400'
  return 'text-ink-300'
}

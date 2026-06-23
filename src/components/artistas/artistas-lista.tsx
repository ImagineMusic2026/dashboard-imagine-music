'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, DollarSign, Loader2, Search, UserPlus } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { CriarArtistaDialog } from '@/components/artistas/criar-artista-dialog'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { ReceitaGate } from '@/components/auth/receita-gate'
import {
  corAvatarDe,
  iniciaisDe,
  listarArtistas,
  listarReceitas,
  type ArtistaDoc,
  type ReceitaResumo,
} from '@/lib/artistas/client'
import { getHistoricoHealth, listarMetricasSociais } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import { derivarHealthScores } from '@/lib/health/score'
import { derivarAlertas } from '@/lib/alertas/derivar'
import { Sparkline } from '@/components/artistas/sparkline'
import { cn, formatCurrency, formatNumber, getHealthColor, getHealthGradient } from '@/lib/utils'

const REDES: { tipo: PlataformaTipo; cor: string; get: (a: ArtistaDoc) => boolean }[] = [
  { tipo: 'spotify', cor: 'text-emerald-400', get: (a) => !!a.redes?.spotify?.url },
  { tipo: 'youtube', cor: 'text-red-400', get: (a) => !!a.redes?.youtube?.url },
  { tipo: 'instagram', cor: 'text-fuchsia-400', get: (a) => !!a.redes?.instagram?.url },
  { tipo: 'tiktok', cor: 'text-cyan-400', get: (a) => !!a.redes?.tiktok?.url },
]

const TH = 'text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-4'

const POR_PAGINA = 15

/** Páginas a mostrar no controle (com reticências quando são muitas). */
function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const alvo = new Set([1, total, atual, atual - 1, atual + 1])
  const ordenadas = Array.from(alvo).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let anterior = 0
  for (const p of ordenadas) {
    if (p - anterior > 1) out.push('…')
    out.push(p)
    anterior = p
  }
  return out
}

/** Placeholder honesto pras colunas que ainda dependem de integração. */
function Pendente() {
  return <span className="num text-sm text-ink-600">—</span>
}
function HealthPendente() {
  return <div className="w-16 h-1.5 rounded-full bg-bg-700/50" />
}
function TendenciaPendente() {
  return (
    <svg width="58" height="14" aria-hidden>
      <line x1="2" y1="7" x2="56" y2="7" stroke="#3F3F52" strokeWidth="2" strokeDasharray="3 4" />
    </svg>
  )
}

/** Cor sólida do marcador de Health por faixa de score. */
function corMarcador(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-violet-400'
  if (score >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

/** Health Score como linha fina + marcador (em vez de barra cheia) + número. */
function HealthLinha({ score }: { score: number }) {
  const v = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-24 h-2.5 flex items-center shrink-0">
        <div className="absolute inset-x-0 h-px bg-bg-700 rounded-full" />
        <div
          className={cn('absolute left-0 h-px rounded-full bg-gradient-to-r', getHealthGradient(v))}
          style={{ width: `${v}%` }}
        />
        <div
          className={cn('absolute w-2.5 h-2.5 rounded-full ring-2 ring-bg-900', corMarcador(v))}
          style={{ left: `calc(${v}% - 5px)` }}
        />
      </div>
      <span className={cn('num font-bold text-sm', getHealthColor(v))}>{v}</span>
    </div>
  )
}

export function ArtistasLista() {
  const { role, loading } = useAuth()
  const [artistas, setArtistas] = useState<ArtistaDoc[] | null>(null)
  const [receitas, setReceitas] = useState<Map<string, ReceitaResumo>>(new Map())
  const [metricas, setMetricas] = useState<Map<string, MetricasSociaisDoc>>(new Map())
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [histHealth, setHistHealth] = useState<Map<string, number[]>>(new Map())
  const buscadosRef = useRef<Set<string>>(new Set())

  const ehAdmin = role === 'admin'

  const recarregar = useCallback(async () => {
    try {
      setArtistas(await listarArtistas())
      setErro(false)
    } catch {
      setErro(true)
    }
    try {
      setMetricas(await listarMetricasSociais())
    } catch {
      /* métricas (health/audiência/alertas) são secundárias pro render da lista */
    }
    if (ehAdmin) {
      try {
        setReceitas(await listarReceitas())
      } catch {
        /* receita é secundária */
      }
    }
  }, [ehAdmin])

  useEffect(() => {
    if (loading || !role) return
    void recarregar()
  }, [loading, role, recarregar])

  const filtrados = useMemo(() => {
    if (!artistas) return []
    const q = busca.trim().toLowerCase()
    return q ? artistas.filter((a) => a.nome.toLowerCase().includes(q)) : artistas
  }, [artistas, busca])

  // Health Score + alertas por artista — derivados das métricas (mesma lib da home).
  const { saudePorSlug, alertasPorSlug } = useMemo(() => {
    const nome = new Map((artistas ?? []).map((a) => [a.slug, a.nome]))
    const saude = new Map(derivarHealthScores(metricas, nome).map((s) => [s.slug, s]))
    const alertas = new Map<string, number>()
    for (const al of derivarAlertas(metricas, nome))
      alertas.set(al.artistaSlug, (alertas.get(al.artistaSlug) ?? 0) + 1)
    return { saudePorSlug: saude, alertasPorSlug: alertas }
  }, [artistas, metricas])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * POR_PAGINA
  const paginados = filtrados.slice(inicio, inicio + POR_PAGINA)

  // Série do Health Score (sparkline da Tendência) só dos artistas VISÍVEIS da
  // página — evita ler o histórico dos 74 de uma vez. Cacheado por slug.
  const slugsPagina = paginados.map((a) => a.slug).join(',')
  useEffect(() => {
    const faltam = paginados.filter((a) => !buscadosRef.current.has(a.slug))
    if (!faltam.length) return
    faltam.forEach((a) => buscadosRef.current.add(a.slug))
    let vivo = true
    ;(async () => {
      const entradas = await Promise.all(
        faltam.map(async (a) => {
          try {
            const h = await getHistoricoHealth(a.slug)
            return [a.slug, h.map((d) => d.score)] as const
          } catch {
            return [a.slug, [] as number[]] as const
          }
        }),
      )
      if (!vivo) return
      setHistHealth((m) => {
        const n = new Map(m)
        for (const [slug, scores] of entradas) n.set(slug, scores)
        return n
      })
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugsPagina])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  const colSpan = ehAdmin ? 9 : 8

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Artistas</h1>
          <p className="text-sm text-ink-400 mt-1">
            {artistas === null ? (
              <span className="text-ink-500">carregando…</span>
            ) : (
              <>
                <span className="num text-ink-200">{artistas.length}</span> no cadastro
                {ehAdmin && (
                  <>
                    <span> · </span>
                    <span className="num text-ink-200">{receitas.size}</span> com receita importada
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ehAdmin && (
            <button
              type="button"
              onClick={() => setDialogAberto(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Novo artista
            </button>
          )}
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
              placeholder="Filtrar por nome…"
              className="w-full pl-9 pr-3 py-2 bg-bg-800/50 border border-bg-700/40 rounded-lg text-sm text-ink-200 placeholder:text-ink-500 focus:outline-none focus:border-violet-500/40"
            />
          </div>
        </div>
      </div>

      {erro ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            Não consegui carregar os artistas. Confirme que as regras do Firestore estão deployadas
            (<span className="num">firebase deploy --only firestore:rules</span>).
          </div>
        </div>
      ) : artistas === null ? (
        <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando artistas…
        </div>
      ) : (
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-700/40">
                  <th className={cn(TH, 'text-left')}>Artista</th>
                  <th className={cn(TH, 'text-left')}>Gênero</th>
                  <th className={cn(TH, 'text-left')}>Health</th>
                  <th className={cn(TH, 'text-left')}>Tendência</th>
                  <th className={cn(TH, 'text-right')}>Audiência</th>
                  <th className={cn(TH, 'text-left')}>Redes</th>
                  <ReceitaGate>
                    <th className={cn(TH, 'text-right')}>Receita</th>
                  </ReceitaGate>
                  <th className={cn(TH, 'text-center')}>Alertas</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-700/30">
                {paginados.map((a) => {
                  const r = receitas.get(a.slug)
                  const saude = saudePorSlug.get(a.slug)
                  const nAlertas = alertasPorSlug.get(a.slug) ?? 0
                  return (
                    <tr key={a.slug} className="hover:bg-bg-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/artistas/${a.slug}`} className="flex items-center gap-3 group">
                          <AvatarFallback iniciais={iniciaisDe(a.nome)} gradient={corAvatarDe(a.slug)} size="md" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-ink-100 group-hover:text-violet-300 transition-colors truncate">
                              {a.nome}
                            </div>
                            <div className="text-[11px] text-ink-500 num truncate">
                              {a.redes?.instagram?.handle ? `@${a.redes.instagram.handle}` : a.slug}
                            </div>
                          </div>
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        {a.genero ? (
                          <span className="text-sm text-ink-300">{a.genero}</span>
                        ) : (
                          <Pendente />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {saude ? <HealthLinha score={saude.score} /> : <HealthPendente />}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const h = histHealth.get(a.slug)
                          return h && h.length > 0 ? (
                            <Sparkline data={h} width={58} height={16} />
                          ) : (
                            <TendenciaPendente />
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {saude && saude.seguidoresTotal > 0 ? (
                          <span className="num text-sm text-ink-200">
                            {formatNumber(saude.seguidoresTotal)}
                          </span>
                        ) : (
                          <Pendente />
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {REDES.map(({ tipo, cor, get }) => {
                            const tem = get(a)
                            return (
                              <span
                                key={tipo}
                                title={`${tipo}${tem ? '' : ' (sem link)'}`}
                                className={cn('w-4 h-4 block', tem ? cor : 'text-ink-700')}
                              >
                                <PlataformaIcon tipo={tipo} />
                              </span>
                            )
                          })}
                        </div>
                      </td>

                      <ReceitaGate>
                        <td className="px-4 py-3 text-right">
                          {r ? (
                            <div>
                              <div className="num text-sm font-semibold text-emerald-400">
                                {formatCurrency(r.totalBRL)}
                              </div>
                              <div className="text-[11px] num text-ink-500">{formatNumber(r.streams)} streams</div>
                            </div>
                          ) : (
                            <span className="text-ink-600 num text-sm">—</span>
                          )}
                        </td>
                      </ReceitaGate>

                      <td className="px-4 py-3 text-center">
                        {nAlertas > 0 ? (
                          <span className="num text-[11px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-semibold">
                            {nAlertas}
                          </span>
                        ) : (
                          <span className="num text-sm text-ink-600">0</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/artistas/${a.slug}`}
                          className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
                        >
                          ver →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-ink-500">
                      Nenhum artista encontrado para “{busca}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-bg-700/40">
              <span className="text-[12px] text-ink-500">
                Mostrando{' '}
                <span className="num text-ink-300">
                  {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)}
                </span>{' '}
                de <span className="num text-ink-300">{filtrados.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  aria-label="Página anterior"
                  className="w-8 h-8 grid place-items-center rounded-lg border border-bg-700/50 text-ink-300 hover:bg-bg-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {paginasVisiveis(paginaAtual, totalPaginas).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="w-8 h-8 grid place-items-center text-ink-600 text-sm">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagina(p)}
                      aria-current={p === paginaAtual ? 'page' : undefined}
                      className={cn(
                        'min-w-8 h-8 px-2 grid place-items-center rounded-lg border text-sm num transition-colors',
                        p === paginaAtual
                          ? 'border-violet-500/40 bg-violet-500/15 text-violet-300 font-semibold'
                          : 'border-bg-700/50 text-ink-300 hover:bg-bg-800',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  aria-label="Próxima página"
                  className="w-8 h-8 grid place-items-center rounded-lg border border-bg-700/50 text-ink-300 hover:bg-bg-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 text-[12px] text-ink-500">
        <DollarSign className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-600" />
        <span>
          <b className="text-ink-400">Health, audiência e alertas</b> são reais, derivados das métricas
          de Instagram, YouTube e TikTok. <b className="text-ink-400">Tendência</b> aparece conforme os
          syncs diários acumulam. <b className="text-ink-400">Receita</b> (só pro financeiro) vem da OneRPM
          e <b className="text-ink-400">gênero</b> é cadastro manual.
        </span>
      </div>

      {dialogAberto && (
        <CriarArtistaDialog onClose={() => setDialogAberto(false)} onCreated={() => void recarregar()} />
      )}
    </div>
  )
}

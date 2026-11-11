'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Cake,
  HeartPulse,
  Loader2,
  PlayCircle,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { corAvatarDe, iniciaisDe, listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import { filtrarPorPrefs } from '@/lib/alertas/preferencias'
import { chaveVisto, semVistos } from '@/lib/alertas/vistos'
import { aniversariosProximos } from '@/lib/artistas/aniversario'
import { ehStaff } from '@/lib/permissions'
import { useAlertas } from '@/components/alertas/alertas-provider'
import { useAuth } from '@/components/auth/auth-provider'
import { derivarHealthScores, resumirSaude, type ArtistaSaude } from '@/lib/health/score'
import { KPICard } from '@/components/shared/kpi-card'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { AlertaLinha, tempoRelativo } from '@/components/alertas/alerta-linha'
import { PortfolioSaude } from '@/components/home/portfolio-saude'
import { Saudacao } from '@/components/home/saudacao'
import { cn, formatNumber, getHealthColor } from '@/lib/utils'

type Estado = 'load' | 'erro' | 'ok'

/** Linha de "Em alta no streaming" / "Maiores movimentações". */
interface StreamingResumo {
  slug: string
  nome: string
  streams28d: number
  /** Momentum: última semana vs média das 3 semanas anteriores (null sem base). */
  crescPct: number | null
}

export default function HomePage() {
  const [estado, setEstado] = useState<Estado>('load')
  const [arts, setArts] = useState<ArtistaDoc[]>([])
  const [mapa, setMapa] = useState<Map<string, MetricasSociaisDoc>>(new Map())
  // Os alertas vêm do casco: a MESMA lista que o sino conta, já carregada. A Home
  // montava a própria (só sociais e operacionais) e o número dela não batia com o
  // do sino desde que entraram cadastro e questionário. De quebra, visitar a Home
  // não custa leitura de alerta nenhuma — e deixou de reler as quatro integrações.
  const { carregados, falhou: alertasFalharam, carregando: alertasCarregando, vistos, marcar, renovar } = useAlertas()
  // Quantas vezes a pessoa pediu "Tentar de novo" — entra no aviso para ele mudar a
  // cada tentativa e ser anunciado de novo.
  const [tentativas, setTentativas] = useState(0)
  const equipe = ehStaff(useAuth().role)
  // Sem a lista não há como dizer "nenhum alerta": zero aqui seria mentira.
  const alertasIndisponiveis = equipe && alertasFalharam && carregados === null

  // Só relê se a lista estiver suja (alguém gravou no painel) ou tiver falhado —
  // nunca por idade: a Home é a tela mais visitada, e cada releitura custa caro.
  useEffect(() => {
    renovar()
  }, [renovar])
  const [falhaVisto, setFalhaVisto] = useState(false)
  const [avisoVisto, setAvisoVisto] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [m, a] = await Promise.all([listarMetricasSociais(), listarArtistas()])
        if (!vivo) return
        setMapa(m)
        setArts(a)
        setEstado('ok')
      } catch {
        if (vivo) setEstado('erro')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const dados = useMemo(() => {
    const nome = new Map(arts.map((a) => [a.slug, a.nome]))
    const alertas = semVistos(filtrarPorPrefs(carregados?.alertas ?? []), vistos ?? {})
    const saudes = derivarHealthScores(mapa, nome)
    const resumo = resumirSaude(saudes)

    const counts = { critico: 0, atencao: 0, oportunidade: 0, operacional: 0 }
    for (const al of alertas) counts[al.severidade] += 1

    // Zona de risco: score baixo OU perdendo seguidores, do pior pro menos pior.
    const risco = saudes
      .filter((s) => s.score < 50 || (s.crescimentoSegPct != null && s.crescimentoSegPct < 0))
      .sort((a, b) => a.score - b.score)

    // Streaming do portfólio (OneRPM): total da janela + momentum por artista.
    let streams28dTotal = 0
    let streams7dTotal = 0
    const streamingArtistas: StreamingResumo[] = []
    for (const [slug, doc] of Array.from(mapa)) {
      const st = doc.streaming
      if (!st) continue
      const s28 = st.streams28d ?? 0
      const s7 = st.streams7d ?? 0
      streams28dTotal += s28
      streams7dTotal += s7
      const priorSemana = (s28 - s7) / 3 // média semanal das 3 semanas anteriores
      const crescPct = priorSemana > 0 ? (s7 - priorSemana) / priorSemana : null
      if (s28 > 0) streamingArtistas.push({ slug, nome: nome.get(slug) ?? slug, streams28d: s28, crescPct })
    }
    const priorPort = (streams28dTotal - streams7dTotal) / 3
    const streamingTrendPct = priorPort > 0 ? (streams7dTotal - priorPort) / priorPort : null
    const topStreaming = [...streamingArtistas].sort((a, b) => b.streams28d - a.streams28d).slice(0, 5)
    const streams28dPorSlug = new Map(streamingArtistas.map((p) => [p.slug, p.streams28d]))
    // Maiores movimentações: quem mais acelerou/caiu (filtra ruído de volume baixo).
    const movers = streamingArtistas
      .filter((p) => p.streams28d >= 5000 && p.crescPct != null && Math.abs(p.crescPct) >= 0.01)
      .sort((a, b) => Math.abs(b.crescPct ?? 0) - Math.abs(a.crescPct ?? 0))
      .slice(0, 6)

    return {
      alertas,
      aniversarios: aniversariosProximos(arts),
      counts,
      topSaude: saudes.slice(0, 5),
      risco,
      resumo,
      comMetricas: arts.filter((a) => mapa.has(a.slug)).length,
      streams28dTotal,
      streamingTrendPct,
      topStreaming,
      streamsMax: topStreaming[0]?.streams28d ?? 0,
      movers,
      streams28dPorSlug,
      fotoPorSlug: new Map(arts.map((a) => [a.slug, a.fotoUrl ?? null])),
      atualizadoEm: ultimaColeta(mapa),
    }
  }, [arts, mapa, carregados, vistos])

  // Espera os alertas e os vistos junto: sem eles a contagem abriria com os alertas
  // já vistos e cairia um instante depois. Se os alertas falharem, o resto da Home
  // aparece mesmo assim, sem eles.
  const esperandoAlertas = equipe && !alertasFalharam && (carregados === null || vistos === null)
  if (estado === 'load' || (estado === 'ok' && esperandoAlertas)) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando o painel…
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Não foi possível carregar</h1>
        <p className="text-sm text-ink-400 mt-2">
          Verifique se você é membro ativo e se as regras do Firestore estão deployadas.
        </p>
      </div>
    )
  }

  const {
    alertas,
    aniversarios,
    counts,
    topSaude,
    risco,
    resumo,
    comMetricas,
    streams28dTotal,
    streamingTrendPct,
    topStreaming,
    streamsMax,
    movers,
    streams28dPorSlug,
    fotoPorSlug,
    atualizadoEm,
  } = dados
  const nCriticos = counts.critico + counts.atencao

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Saudacao
          right={
            atualizadoEm > 0 ? (
              <div className="flex items-center gap-2 shrink-0 text-[12px] text-ink-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="whitespace-nowrap">Atualizado {tempoRelativo(atualizadoEm)}</span>
              </div>
            ) : null
          }
        />
        <p className="text-sm sm:text-base text-ink-400 mt-1">
          Aqui está como o portfólio está hoje.{' '}
          {alertasIndisponiveis ? (
            <span className="text-ink-400">Não foi possível carregar os alertas agora.</span>
          ) : alertas.length > 0 ? (
            <>
              <span className="text-amber-400 font-semibold num">
                {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
              </span>{' '}
              {alertas.length === 1 ? 'precisa' : 'precisam'} da sua atenção.
            </>
          ) : (
            <span className="text-emerald-400 font-semibold">Nenhum alerta aberto.</span>
          )}
        </p>
        {/* Aniversários da semana: aparecem aqui mesmo que o alerta já tenha sido
            marcado como visto, ou que haja críticos na frente dele na lista —
            a cliente pediu o aviso também na página inicial. Some sozinho quando
            ninguém faz aniversário nos próximos 7 dias. */}
        {aniversarios.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <Cake className="w-4 h-4" aria-hidden />
              Aniversários
            </span>
            {aniversarios.map((n) => (
              <Link
                key={n.slug}
                href={`/artistas/${n.slug}`}
                className={cn(
                  'px-2 py-0.5 rounded-full border transition-colors',
                  n.dias === 0
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25'
                    : 'bg-bg-900 border-bg-700/50 text-ink-300 hover:text-ink-100',
                )}
              >
                <span className="font-semibold">{n.nome}</span>{' '}
                <span className="text-ink-400">
                  {n.dias === 0
                    ? 'hoje'
                    : n.dias === 1
                      ? 'amanhã'
                      : n.data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  {' · '}
                  <span className="num">{n.idade} anos</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Artistas"
          value={String(arts.length)}
          subtitle={
            <span className="text-ink-500">
              <span className="num text-ink-300">{comMetricas}</span> com métricas
            </span>
          }
          icon={Users}
          accentColor="violet"
        />
        <KPICard
          label="Health Score médio"
          value={
            resumo.avaliados > 0 ? (
              <span className={getHealthColor(resumo.media)}>
                {resumo.media}
                <span className="text-ink-500 text-lg font-medium">/100</span>
              </span>
            ) : (
              <span className="text-ink-600">—</span>
            )
          }
          subtitle={
            <span className="text-ink-500">
              <span className="num text-ink-300">{resumo.avaliados}</span> avaliados
            </span>
          }
          icon={Activity}
          accentColor="emerald"
        />
        <KPICard
          label="Alertas abertos"
          value={alertasIndisponiveis ? '—' : String(alertas.length)}
          subtitle={
            alertasIndisponiveis ? (
              <span className="text-ink-500">indisponível</span>
            ) : nCriticos > 0 ? (
              <span>
                <span className="num text-red-400">{counts.critico} críticos</span>
                <span className="text-ink-500"> · </span>
                <span className="num text-amber-400">{counts.atencao} atenção</span>
              </span>
            ) : (
              <span className="text-ink-500">tudo sob controle</span>
            )
          }
          icon={AlertTriangle}
          accentColor="red"
        />
        <KPICard
          label="Streams · 28 dias"
          value={streams28dTotal > 0 ? formatNumber(streams28dTotal) : '—'}
          subtitle={
            <span>
              {streamingTrendPct != null && Math.abs(streamingTrendPct) >= 0.005 && (
                <>
                  <span
                    className={cn(
                      'num font-medium',
                      streamingTrendPct > 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {streamingTrendPct > 0 ? '↑' : '↓'} {(Math.abs(streamingTrendPct) * 100).toFixed(0)}%
                  </span>
                  <span className="text-ink-500"> · </span>
                </>
              )}
              <span className="text-ink-500">via OneRPM</span>
            </span>
          }
          icon={PlayCircle}
          accentColor="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Em alta no streaming */}
        <div className="lg:col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 grid place-items-center">
                <PlayCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-ink-100">Em alta no streaming</div>
                <div className="text-[12px] text-ink-500">Mais tocados nos últimos 28 dias · via OneRPM</div>
              </div>
            </div>
            <Link
              href="/artistas"
              className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          {topStreaming.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-300 font-medium">Sem dados de streaming ainda</p>
              <p className="text-[13px] text-ink-500 mt-1 max-w-sm mx-auto">
                Conforme o sync da OneRPM roda, os artistas mais tocados aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-bg-700/30">
              {topStreaming.map((s, idx) => (
                <StreamingItem key={s.slug} s={s} idx={idx} max={streamsMax} foto={fotoPorSlug.get(s.slug)} />
              ))}
            </div>
          )}
        </div>

        {/* Maiores movimentações */}
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="font-bold text-ink-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              Maiores movimentações
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">Quem mais acelerou ou caiu (28d)</div>
          </div>
          <div className="px-5 py-3 space-y-2.5 flex-1">
            {movers.length === 0 ? (
              <p className="text-[13px] text-ink-500 py-4">Sem variação relevante ainda.</p>
            ) : (
              movers.map((m) => <MoverItem key={m.slug} m={m} />)
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alertas que pedem ação */}
        <div className="lg:col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 grid place-items-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="font-bold text-ink-100">Alertas que pedem ação</div>
                <div className="text-[12px] text-ink-500">Ordenados por severidade e tempo</div>
              </div>
            </div>
            <Link
              href="/alertas"
              className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          <p className="sr-only" aria-live="polite">
            {avisoVisto}
          </p>
          {falhaVisto && (
            <p role="alert" className="mx-5 mt-4 text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Não foi possível marcar como visto agora. Tente de novo em instantes.
            </p>
          )}
          {alertasIndisponiveis ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-300 font-medium">Não foi possível carregar os alertas</p>
              <button
                type="button"
                disabled={alertasCarregando}
                onClick={() => {
                  setTentativas((n) => n + 1)
                  renovar()
                }}
                className="mt-2 text-[13px] font-semibold text-violet-400 hover:text-violet-300 disabled:text-ink-500 transition-colors"
              >
                {alertasCarregando ? 'Tentando…' : 'Tentar de novo'}
              </button>
              <p className="sr-only" aria-live="polite">
                {alertasCarregando
                  ? 'Tentando carregar os alertas.'
                  : tentativas > 0
                    ? `Ainda não foi possível carregar os alertas (tentativa ${tentativas}).`
                    : ''}
              </p>
            </div>
          ) : alertas.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-300 font-medium">Nenhum alerta aberto</p>
              <p className="text-[13px] text-ink-500 mt-1 max-w-sm mx-auto">
                Conforme as sincronizações rodam, destaques e quedas dos artistas aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-bg-700/30">
              {alertas.slice(0, 5).map((a) => (
                <AlertaLinha
                  key={a.id}
                  a={a}
                  onVisto={async () => {
                    setFalhaVisto(false)
                    // Muda a cada marcação (nome e quantos restam): a mesma frase de novo
                    // não seria anunciada pelo leitor de tela.
                    setAvisoVisto(
                      `Alerta de ${a.artistaNome} marcado como visto. ${alertas.length - 1} ${alertas.length - 1 === 1 ? 'aberto' : 'abertos'}.`,
                    )
                    if (!(await marcar([chaveVisto(a)]))) {
                      setFalhaVisto(true)
                      setAvisoVisto('')
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Health Score */}
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Top Health Score
              </div>
              <span className="text-[10px] tracking-wider text-ink-500 font-semibold">PORTFÓLIO</span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">Maiores scores de saúde agora</div>
          </div>
          <div className="px-5 py-3 space-y-3 flex-1">
            {topSaude.length === 0 ? (
              <p className="text-[13px] text-ink-500 py-4">Sem scores ainda.</p>
            ) : (
              topSaude.map((s, idx) => (
                <RankItem
                  key={s.slug}
                  s={s}
                  idx={idx}
                  streams={streams28dPorSlug.get(s.slug) ?? 0}
                  foto={fotoPorSlug.get(s.slug)}
                />
              ))
            )}
          </div>
          <div className="px-5 py-3 border-t border-bg-700/30 text-center">
            <Link href="/artistas" className="text-ink-400 hover:text-ink-200 text-sm transition-colors">
              Ver todos os artistas
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Em zona de risco */}
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-100">Em zona de risco</div>
              <span className="text-[10px] num bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-semibold">
                {risco.length} {risco.length === 1 ? 'artista' : 'artistas'}
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">Score abaixo de 50 ou perdendo seguidores</div>
          </div>
          {risco.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <HeartPulse className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-ink-300 font-medium">Ninguém em risco</p>
              <p className="text-[12px] text-ink-500 mt-1">Todo o portfólio avaliado está saudável.</p>
            </div>
          ) : (
            <div className="px-5 py-3 space-y-3">
              {risco.slice(0, 6).map((s) => (
                <RiscoItem key={s.slug} s={s} foto={fotoPorSlug.get(s.slug)} />
              ))}
            </div>
          )}
        </div>

        {/* Saúde do portfólio */}
        <div className="lg:col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-start justify-between">
            <div>
              <div className="font-bold text-ink-100">Saúde do portfólio</div>
              <div className="text-[12px] text-ink-500 mt-0.5">
                Distribuição e composição do Health Score dos artistas avaliados
              </div>
            </div>
          </div>
          <PortfolioSaude resumo={resumo} />
        </div>
      </div>
    </div>
  )
}

/* ── linhas dos rankings ─────────────────────────────────────────────────── */

function StreamingItem({ s, idx, max, foto }: { s: StreamingResumo; idx: number; max: number; foto?: string | null }) {
  const pct = max > 0 ? Math.max(3, Math.round((s.streams28d / max) * 100)) : 0
  return (
    <Link
      href={`/artistas/${s.slug}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-bg-800/30 transition-colors group"
    >
      <span className="w-4 text-ink-500 text-sm num text-center shrink-0">{idx + 1}</span>
      <AvatarFallback iniciais={iniciaisDe(s.nome)} gradient={corAvatarDe(s.slug)} size="sm" fotoUrl={foto} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100 truncate group-hover:text-violet-300 transition-colors">
          {s.nome}
        </div>
        <div className="h-1.5 rounded-full bg-bg-800 overflow-hidden mt-1.5 max-w-[200px]">
          <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="num font-bold text-sm text-ink-100">{formatNumber(s.streams28d)}</div>
        <CrescimentoChip pct={s.crescPct} />
      </div>
    </Link>
  )
}

function MoverItem({ m }: { m: StreamingResumo }) {
  const up = (m.crescPct ?? 0) > 0
  return (
    <Link href={`/artistas/${m.slug}`} className="flex items-center justify-between gap-2 group">
      <span className="text-sm text-ink-200 truncate group-hover:text-violet-300 transition-colors">
        {m.nome}
      </span>
      <span
        className={cn('text-[13px] num font-semibold shrink-0', up ? 'text-emerald-400' : 'text-red-400')}
      >
        {up ? '↑' : '↓'} {(Math.abs(m.crescPct ?? 0) * 100).toFixed(0)}%
      </span>
    </Link>
  )
}

function RankItem({ s, idx, streams, foto }: { s: ArtistaSaude; idx: number; streams: number; foto?: string | null }) {
  return (
    <Link href={`/artistas/${s.slug}`} className="flex items-center gap-3 group">
      <span className="w-4 text-ink-500 text-sm num text-center shrink-0">{idx + 1}</span>
      <AvatarFallback iniciais={iniciaisDe(s.nome)} gradient={corAvatarDe(s.slug)} size="sm" fotoUrl={foto} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100 truncate group-hover:text-violet-300 transition-colors">
          {s.nome}
        </div>
        <div className="text-[11px] text-ink-500 truncate num">
          {streams > 0 ? `${formatNumber(streams)} streams · 28d` : 'sem streaming'}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('font-bold text-base num', getHealthColor(s.score))}>{s.score}</div>
        <CrescimentoChip pct={s.crescimentoSegPct} />
      </div>
    </Link>
  )
}

function RiscoItem({ s, foto }: { s: ArtistaSaude; foto?: string | null }) {
  return (
    <Link href={`/artistas/${s.slug}`} className="flex items-center gap-3 group">
      <AvatarFallback iniciais={iniciaisDe(s.nome)} gradient={corAvatarDe(s.slug)} size="sm" fotoUrl={foto} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100 truncate group-hover:text-violet-300 transition-colors">
          {s.nome}
        </div>
        <div className="text-[11px] text-red-400 truncate">{s.motivoRisco ?? 'Precisa de atenção'}</div>
      </div>
      <div className={cn('font-bold text-base num shrink-0', getHealthColor(s.score))}>{s.score}</div>
    </Link>
  )
}

function CrescimentoChip({ pct }: { pct: number | null }) {
  if (pct == null || Math.abs(pct) < 0.0005) return null
  const up = pct > 0
  return (
    <div className={cn('text-[11px] num', up ? 'text-emerald-400' : 'text-red-400')}>
      {up ? '↑' : '↓'} {(Math.abs(pct) * 100).toFixed(1)}%
    </div>
  )
}

/* ── derivados simples do mapa de métricas ───────────────────────────────── */

/** Timestamp (ms) da coleta mais recente em todo o portfólio. */
function ultimaColeta(mapa: Map<string, MetricasSociaisDoc>): number {
  let ultima = 0
  for (const doc of Array.from(mapa.values())) {
    const t = doc.atualizadoEm ? Date.parse(doc.atualizadoEm) : 0
    if (t > ultima) ultima = t
  }
  return ultima
}

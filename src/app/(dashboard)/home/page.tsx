'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  HeartPulse,
  Loader2,
  PlayCircle,
  Trophy,
  Users,
} from 'lucide-react'
import { corAvatarDe, iniciaisDe, listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import { derivarAlertas } from '@/lib/alertas/derivar'
import { filtrarPorPrefs } from '@/lib/alertas/preferencias'
import { derivarHealthScores, resumirSaude, type ArtistaSaude } from '@/lib/health/score'
import { KPICard } from '@/components/shared/kpi-card'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { AlertaLinha, tempoRelativo } from '@/components/alertas/alerta-linha'
import { PortfolioSaude } from '@/components/home/portfolio-saude'
import { Saudacao } from '@/components/home/saudacao'
import { cn, getHealthColor } from '@/lib/utils'

const DIA = 86_400_000

type Estado = 'load' | 'erro' | 'ok'

export default function HomePage() {
  const [estado, setEstado] = useState<Estado>('load')
  const [arts, setArts] = useState<ArtistaDoc[]>([])
  const [mapa, setMapa] = useState<Map<string, MetricasSociaisDoc>>(new Map())

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
    const genero = new Map(arts.map((a) => [a.slug, a.genero ?? '']))
    const alertas = filtrarPorPrefs(derivarAlertas(mapa, nome))
    const saudes = derivarHealthScores(mapa, nome)
    const resumo = resumirSaude(saudes)

    const counts = { critico: 0, atencao: 0, oportunidade: 0, operacional: 0 }
    for (const al of alertas) counts[al.severidade] += 1

    // Zona de risco: score baixo OU perdendo seguidores, do pior pro menos pior.
    const risco = saudes
      .filter((s) => s.score < 50 || (s.crescimentoSegPct != null && s.crescimentoSegPct < 0))
      .sort((a, b) => a.score - b.score)

    return {
      alertas,
      counts,
      topSaude: saudes.slice(0, 5),
      risco,
      resumo,
      genero,
      comMetricas: arts.filter((a) => mapa.has(a.slug)).length,
      conteudos30d: contarConteudos(mapa),
      atualizadoEm: ultimaColeta(mapa),
    }
  }, [arts, mapa])

  if (estado === 'load') {
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

  const { alertas, counts, topSaude, risco, resumo, genero, comMetricas, conteudos30d, atualizadoEm } =
    dados
  const nCriticos = counts.critico + counts.atencao

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Saudacao />
          <p className="text-ink-400 mt-1">
            Aqui está como o portfólio está hoje.{' '}
            {alertas.length > 0 ? (
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
        </div>

        {atualizadoEm > 0 && (
          <div className="flex items-center gap-2 shrink-0 text-[12px] text-ink-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Atualizado {tempoRelativo(atualizadoEm)}
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
          value={String(alertas.length)}
          subtitle={
            nCriticos > 0 ? (
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
          label="Conteúdos · 30 dias"
          value={String(conteudos30d)}
          subtitle={<span className="text-ink-500">YouTube + Instagram</span>}
          icon={PlayCircle}
          accentColor="amber"
        />
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
          {alertas.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-300 font-medium">Nenhum alerta aberto</p>
              <p className="text-[13px] text-ink-500 mt-1 max-w-sm mx-auto">
                Conforme as sincronizações rodam, destaques e quedas dos artistas aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-bg-700/30">
              {alertas.slice(0, 5).map((a) => (
                <AlertaLinha key={a.id} a={a} />
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
                <RankItem key={s.slug} s={s} idx={idx} genero={genero.get(s.slug) ?? ''} />
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
                <RiscoItem key={s.slug} s={s} />
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

function RankItem({ s, idx, genero }: { s: ArtistaSaude; idx: number; genero: string }) {
  return (
    <Link href={`/artistas/${s.slug}`} className="flex items-center gap-3 group">
      <span className="w-4 text-ink-500 text-sm num text-center shrink-0">{idx + 1}</span>
      <AvatarFallback iniciais={iniciaisDe(s.nome)} gradient={corAvatarDe(s.slug)} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100 truncate group-hover:text-violet-300 transition-colors">
          {s.nome}
        </div>
        <div className="text-[11px] text-ink-500 truncate">{genero || 'Sem gênero'}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('font-bold text-base num', getHealthColor(s.score))}>{s.score}</div>
        <CrescimentoChip pct={s.crescimentoSegPct} />
      </div>
    </Link>
  )
}

function RiscoItem({ s }: { s: ArtistaSaude }) {
  return (
    <Link href={`/artistas/${s.slug}`} className="flex items-center gap-3 group">
      <AvatarFallback iniciais={iniciaisDe(s.nome)} gradient={corAvatarDe(s.slug)} size="sm" />
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

/** Conteúdos (posts IG + vídeos YT) publicados nos últimos 30 dias. */
function contarConteudos(mapa: Map<string, MetricasSociaisDoc>): number {
  const agora = Date.now()
  let n = 0
  for (const doc of Array.from(mapa.values())) {
    for (const p of doc.instagram?.postsRecentes ?? [])
      if (p.publicadoEm && agora - Date.parse(p.publicadoEm) <= 30 * DIA) n += 1
    for (const v of doc.youtube?.videosRecentes ?? [])
      if (v.publicadoEm && agora - Date.parse(v.publicadoEm) <= 30 * DIA) n += 1
  }
  return n
}

/** Timestamp (ms) da coleta mais recente em todo o portfólio. */
function ultimaColeta(mapa: Map<string, MetricasSociaisDoc>): number {
  let ultima = 0
  for (const doc of Array.from(mapa.values())) {
    const t = doc.atualizadoEm ? Date.parse(doc.atualizadoEm) : 0
    if (t > ultima) ultima = t
  }
  return ultima
}

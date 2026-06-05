import { notFound } from 'next/navigation'
import {
  Activity,
  Calendar,
  DollarSign,
  Lock,
  Music,
  Pencil,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'
import { getGestorPorId } from '@/lib/mock-data/gestores'
import {
  acoesSugeridas,
  evolucaoHealthScore,
  historicoRecente,
  metricasPlataforma,
  receitaPorPlataforma,
} from '@/lib/mock-data/perfil-detalhado'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { HealthScoreBreakdown } from '@/components/artistas/health-score-breakdown'
import { HealthEvolutionChart } from '@/components/artistas/health-evolution-chart'
import { PlataformaCard } from '@/components/artistas/plataforma-card'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { ReceitaArtistaCard } from '@/components/artistas/receita-artista-card'
import { KPICard } from '@/components/shared/kpi-card'
import { ReceitaGate } from '@/components/auth/receita-gate'
import { slugify } from '@/lib/onerpm/aggregate'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

interface Props {
  params: { id: string }
}

export function generateStaticParams() {
  return artistas.map((a) => ({ id: a.id }))
}

const iconeAcaoMap: Record<string, LucideIcon> = {
  TrendingUp,
  Calendar,
  Music,
}

const corBolinhaMap: Record<string, string> = {
  emerald: 'bg-emerald-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  ink: 'bg-ink-500',
}

const tabs = [
  'Visão geral',
  'Métricas por plataforma',
  'Conteúdo',
  'Agenda & Contratos',
  'Histórico de alertas',
]

export default function PerfilArtistaPage({ params }: Props) {
  const artista = artistas.find((a) => a.id === params.id)
  if (!artista) notFound()

  const gestor = getGestorPorId(artista.gestorId)
  const variacao = artista.healthScore - artista.healthScoreAnterior

  const platMetricas = metricasPlataforma[artista.id] ?? metricasPlataforma.a2
  const receitaItems = receitaPorPlataforma[artista.id] ?? receitaPorPlataforma.a2
  const historico = historicoRecente[artista.id] ?? historicoRecente.a2
  const acoes = acoesSugeridas[artista.id] ?? acoesSugeridas.a2
  const evolucao = evolucaoHealthScore[artista.id] ?? evolucaoHealthScore.a2

  const slug = slugify(artista.nome)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-5 min-w-0">
          <AvatarFallback
            iniciais={artista.iniciais}
            gradient={artista.corAvatar}
            size="xl"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] tracking-wider font-semibold uppercase text-ink-400 mb-1">
              <span>{artista.genero}</span>
              <span className="text-ink-600">·</span>
              <span>BAIANA</span>
              <span className="text-ink-600">·</span>
              <span>Gestora: {gestor?.nome ?? '—'}</span>
              <span className="text-ink-600">·</span>
              <span>Contrato desde mar/2024</span>
            </div>
            <h1 className="text-3xl font-bold text-ink-100">{artista.nome}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-ink-300 num">{artista.handle}</span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Spotify
              </span>
              <span className="text-[11px] text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> YouTube
              </span>
              <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> TikTok
              </span>
            </div>
          </div>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 min-w-[320px] relative">
          <button
            type="button"
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-2">
            Health Score
          </div>
          <div className="flex items-baseline mb-4">
            <span className="num text-5xl font-bold text-ink-100">{artista.healthScore}</span>
            <span className="text-ink-500 text-xl ml-0.5">/100</span>
            {variacao !== 0 && (
              <span
                className={cn(
                  'num text-sm ml-2 font-semibold',
                  variacao > 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {variacao > 0 ? '+' : ''}
                {variacao} pts
              </span>
            )}
          </div>
          <HealthScoreBreakdown breakdown={artista.healthScoreBreakdown} />
        </div>
      </div>

      <div className="flex items-center border-b border-bg-700/40">
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            className={cn(
              'px-4 py-3 text-sm transition-colors',
              idx === 0
                ? 'text-ink-100 border-b-2 border-violet-500 -mb-px font-semibold'
                : 'text-ink-400 hover:text-ink-100'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Audiência total"
          value={formatNumber(artista.audiencia)}
          variation={{ text: '+8.2% 30 dias', positive: true }}
          icon={Users}
          accentColor="violet"
        />
        <KPICard
          label="Ouvintes mensais"
          value={formatNumber(platMetricas.spotify.ouvintesMensais)}
          variation={{
            text: `+${platMetricas.spotify.crescimento30d}% vs. 30d atrás`,
            positive: true,
          }}
          icon={Activity}
          accentColor="emerald"
        />
        <KPICard
          label="Taxa engajamento"
          value="8.4%"
          variation={{
            text: '↑ 1.2pp acima da média do gênero',
            positive: true,
          }}
          icon={TrendingUp}
          accentColor="amber"
        />
        <ReceitaGate
          restrito={
            <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex flex-col items-center justify-center text-center">
              <Lock className="w-5 h-5 text-ink-600 mb-2" />
              <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase">
                Receita 30D
              </div>
              <div className="text-[12px] text-ink-600 mt-1">Restrito ao financeiro</div>
            </div>
          }
        >
        <div className="bg-bg-900 border border-emerald-500/30 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
                Receita 30D
              </span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="num text-3xl font-bold text-ink-100">
              {formatCurrency(artista.receita30d)}
            </div>
            <div className="text-[12px] num mt-1 text-emerald-400">
              ↑ 24% via OneRPM/DDEX
            </div>
          </div>
        </div>
        </ReceitaGate>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-start justify-between gap-3">
            <div>
              <div className="font-bold text-ink-100">Evolução do Health Score</div>
              <div className="text-[12px] text-ink-500 mt-0.5">
                Últimos 90 dias · cálculo diário
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {['7d', '30d', '90d', '1a'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    'px-2 py-1 rounded-md transition-colors',
                    t === '90d'
                      ? 'bg-violet-500/20 text-violet-300 font-semibold'
                      : 'text-ink-400 hover:bg-bg-800'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 pt-2 pb-4 pr-4">
            <HealthEvolutionChart
              data={evolucao}
              releaseMes="abr"
              releaseLabel="Release: 'Madrugada'"
              scoreAtual={artista.healthScore}
            />
          </div>
        </div>

        <div className="bg-bg-900 border border-emerald-500/30 rounded-xl p-5 relative overflow-hidden flex flex-col">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] tracking-wider font-bold text-emerald-400">
                OPORTUNIDADE
              </span>
            </div>
            <div className="font-bold text-ink-100 mt-2">Viralização no TikTok</div>
            <p className="text-[13px] text-ink-300 mt-1">
              Crescimento de seguidores +340% nas últimas 48h. O áudio de
              {' '}<span className="text-ink-100 font-medium">&apos;Madrugada&apos;</span>{' '}
              virou trend em 3 perfis com 1M+ seguidores.
            </p>
            <div className="space-y-2 mt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Seguidores 48h atrás</span>
                <span className="num text-ink-200">42.1k</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Seguidores agora</span>
                <span className="num text-emerald-400 font-semibold">185.4k</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Views do som &apos;Madrugada&apos;</span>
                <span className="num text-ink-200">2.4M</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="relative w-full mt-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-bg-950 font-semibold transition-colors"
          >
            Plano de aproveitamento →
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-base text-ink-100">Por plataforma</div>
          <div className="text-[11px] text-ink-500 num">Atualizado há 14 min</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <PlataformaCard
            nomeDisplay="Instagram"
            cor="from-fuchsia-500 via-pink-500 to-amber-400"
            icone={<PlataformaIcon tipo="instagram" />}
            valorPrincipal={{
              numero: formatNumber(platMetricas.instagram.seguidores),
              label: 'seguidores',
            }}
            statsSecundarios={[
              { valor: `+${platMetricas.instagram.crescimento7d}%`, label: '7d' },
              { valor: `${platMetricas.instagram.engajamento}%`, label: 'eng.' },
              { valor: platMetricas.instagram.cadencia, label: 'cadência' },
            ]}
            variacao={{
              texto: `+${platMetricas.instagram.crescimento7d}% 7d`,
              positivo: true,
            }}
          />
          <PlataformaCard
            nomeDisplay="Spotify"
            cor="from-emerald-500 to-emerald-700"
            icone={<PlataformaIcon tipo="spotify" />}
            valorPrincipal={{
              numero: formatNumber(platMetricas.spotify.ouvintesMensais),
              label: 'ouvintes mensais',
            }}
            statsSecundarios={[
              { valor: `+${platMetricas.spotify.crescimento30d}%`, label: '30d' },
              { valor: String(platMetricas.spotify.faixas), label: 'faixas' },
              { valor: platMetricas.spotify.topRegioes, label: 'top regiões' },
            ]}
            variacao={{
              texto: `+${platMetricas.spotify.crescimento30d}% 30d`,
              positivo: true,
            }}
          />
          <PlataformaCard
            nomeDisplay="YouTube"
            cor="from-red-500 to-red-700"
            icone={<PlataformaIcon tipo="youtube" />}
            valorPrincipal={{
              numero: formatNumber(platMetricas.youtube.inscritos),
              label: 'inscritos',
            }}
            statsSecundarios={[
              { valor: `+${platMetricas.youtube.crescimento7d}%`, label: '7d' },
              { valor: formatNumber(platMetricas.youtube.viewsMes), label: 'views/mês' },
              { valor: platMetricas.youtube.avgWatch, label: 'avg watch' },
            ]}
            variacao={{
              texto: `+${platMetricas.youtube.crescimento7d}% 7d`,
              positivo: true,
            }}
          />
          <PlataformaCard
            nomeDisplay="TikTok"
            cor="from-cyan-400 to-fuchsia-500"
            icone={<PlataformaIcon tipo="tiktok" />}
            valorPrincipal={{
              numero: formatNumber(platMetricas.tiktok.seguidores),
              label: 'seguidores',
            }}
            statsSecundarios={[
              { valor: `+${platMetricas.tiktok.crescimento48h}%`, label: '48h' },
              { valor: `${platMetricas.tiktok.engajamento}%`, label: 'eng.' },
              { valor: formatNumber(platMetricas.tiktok.viewsAudio), label: 'views/áudio' },
            ]}
            variacao={{
              texto: `+${platMetricas.tiktok.crescimento48h}% 48h`,
              positivo: true,
            }}
            viral={platMetricas.tiktok.viral}
          />
        </div>
      </div>

      <ReceitaGate>
        <ReceitaArtistaCard slug={slug} fallbackItems={receitaItems} />
      </ReceitaGate>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
          <div className="font-bold text-ink-100">Histórico recente</div>
          <div className="text-[12px] text-ink-500 mb-4">
            Eventos relevantes nos últimos 30 dias
          </div>
          <div className="space-y-3">
            {historico.map((evento, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    corBolinhaMap[evento.cor] ?? 'bg-ink-500'
                  )}
                />
                <div className="min-w-0">
                  <div className="text-[11px] text-ink-500 num">
                    {evento.data}
                    {evento.hora && ` · ${evento.hora}`}
                  </div>
                  <div className="text-sm text-ink-300">{evento.titulo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
          <div className="font-bold text-ink-100">Próximas ações sugeridas</div>
          <div className="text-[12px] text-ink-500 mb-4">
            Recomendações automáticas com base no contexto
          </div>
          <div className="space-y-3">
            {acoes.map((acao, idx) => {
              const Icon = iconeAcaoMap[acao.icone] ?? TrendingUp
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-bg-800/50 hover:bg-bg-800 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 grid place-items-center shrink-0">
                    <Icon className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-ink-100">{acao.titulo}</div>
                    <div className="text-[12px] text-ink-400 mt-0.5">{acao.descricao}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  PlayCircle,
  Users,
} from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'
import { alertas } from '@/lib/mock-data/alertas'
import { KPICard } from '@/components/shared/kpi-card'
import { AlertaItem } from '@/components/alertas/alerta-item'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { HealthPortfolioChart } from '@/components/home/health-portfolio-chart'
import { Saudacao } from '@/components/home/saudacao'

const topHealth = [...artistas].sort((a, b) => b.healthScore - a.healthScore).slice(0, 5)

const zonaRiscoMock = [
  { id: 'a7', nome: 'João Neto e Caio', iniciais: 'JN', corAvatar: 'from-amber-500 to-orange-500', score: 45, queda: 11 },
  { id: 'fic', nome: 'Samba das Filhas', iniciais: 'SF', corAvatar: 'from-pink-500 to-rose-500', score: 48, queda: 9 },
  { id: 'a8', nome: 'Dudu Veiga', iniciais: 'DV', corAvatar: 'from-orange-500 to-red-500', score: 42, queda: 19 },
  { id: 'a9', nome: 'Rai Almeida', iniciais: 'RA', corAvatar: 'from-pink-500 to-purple-500', score: 38, queda: 18 },
].sort((a, b) => a.score - b.score)

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Saudacao />
          <p className="text-ink-400 mt-1">
            Aqui está como o portfólio está hoje.{' '}
            <span className="text-amber-400 font-semibold">7 alertas</span> precisam da sua atenção.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 border border-bg-700/60 hover:bg-bg-800 text-ink-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Últimos 30 dias
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Artistas ativos"
          value="127"
          variation={{ text: '+4 este mês', positive: true }}
          icon={Users}
          accentColor="violet"
        />
        <KPICard
          label="Health Score médio"
          value={
            <span>
              68
              <span className="text-ink-500 text-lg font-medium">/100</span>
            </span>
          }
          variation={{ text: '↑ 3.2pts vs. mês anterior', positive: true }}
          icon={Activity}
          accentColor="emerald"
        />
        <KPICard
          label="Alertas abertos"
          value="7"
          subtitle={
            <span>
              <span className="num text-red-400">2 críticos</span>
              <span className="text-ink-500"> · </span>
              <span className="num text-amber-400">5 atenção</span>
            </span>
          }
          icon={AlertTriangle}
          accentColor="red"
        />
        <KPICard
          label="Releases · maio"
          value="12"
          variation={{ text: '+50% vs. abril', positive: true }}
          icon={PlayCircle}
          accentColor="amber"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
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
            <a
              href="/alertas"
              className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
            >
              Ver todos →
            </a>
          </div>
          <div className="divide-y divide-bg-700/30">
            {alertas.slice(0, 5).map((alerta) => (
              <AlertaItem key={alerta.id} alerta={alerta} />
            ))}
          </div>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-100">Top Health Score</div>
              <span className="text-[10px] tracking-wider text-ink-500 font-semibold">SEMANA</span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              Quem mais cresceu nos últimos 7 dias
            </div>
          </div>
          <div className="px-5 py-3 space-y-3 flex-1">
            {topHealth.map((artista, idx) => {
              const variacao = artista.healthScore - artista.healthScoreAnterior
              return (
                <div key={artista.id} className="flex items-center gap-3">
                  <span className="w-4 text-ink-500 text-sm num">{idx + 1}</span>
                  <AvatarFallback
                    iniciais={artista.iniciais}
                    gradient={artista.corAvatar}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-ink-100 truncate">
                      {artista.nome}
                    </div>
                    <div className="text-[11px] text-ink-500">{artista.genero}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-bold text-base num ${
                        artista.healthScore >= 80 ? 'text-emerald-400' : 'text-violet-400'
                      }`}
                    >
                      {artista.healthScore}
                    </div>
                    {variacao !== 0 && (
                      <div
                        className={`text-[11px] num ${
                          variacao > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {variacao > 0 ? '↑' : '↓'} {Math.abs(variacao)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-bg-700/30 text-center">
            <a
              href="/artistas"
              className="text-ink-400 hover:text-ink-200 text-sm transition-colors"
            >
              Ver ranking completo
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-100">Em zona de risco</div>
              <span className="text-[10px] num bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-semibold">
                8 artistas
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              Health Score abaixo de 50 ou em queda
            </div>
          </div>
          <div className="px-5 py-3 space-y-3">
            {zonaRiscoMock.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <AvatarFallback
                  iniciais={item.iniciais}
                  gradient={item.corAvatar}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink-100 truncate">{item.nome}</div>
                  <div className="text-[11px] text-red-400 num">↓ {item.queda} pts em 30d</div>
                </div>
                <div className="font-bold text-base num text-red-400 shrink-0">{item.score}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-start justify-between">
            <div>
              <div className="font-bold text-ink-100">Health Score do portfólio</div>
              <div className="text-[12px] text-ink-500 mt-0.5">
                Média de todos os artistas ativos · últimos 90 dias
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] shrink-0">
              <span className="flex items-center gap-1.5 text-violet-400">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                Score médio
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Mediana
              </span>
            </div>
          </div>
          <div className="px-2 pt-2 pb-4 pr-4">
            <HealthPortfolioChart />
          </div>
        </div>
      </div>
    </div>
  )
}

import { Activity, Flame, Music, TrendingUp } from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'
import { topPerformers } from '@/lib/mock-data/conteudo'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { KPICard } from '@/components/shared/kpi-card'
import { cn } from '@/lib/utils'

const plataformaCorMap: Record<string, string> = {
  Instagram: 'text-pink-400',
  TikTok: 'text-cyan-400',
  YouTube: 'text-red-400',
}

export default function ConteudoPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Conteúdo</h1>
        <p className="text-sm text-ink-400 mt-1">
          Posts, releases e conteúdo dos artistas em todas as plataformas
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Posts hoje"
          value="24"
          variation={{ text: '+18% vs. ontem', positive: true }}
          icon={Music}
          accentColor="violet"
        />
        <KPICard
          label="Engajamento médio"
          value="8.2%"
          variation={{ text: '+0.4pp vs. semana', positive: true }}
          icon={Activity}
          accentColor="emerald"
        />
        <KPICard
          label="Virais desta semana"
          value="3"
          variation={{ text: '+2 vs. semana anterior', positive: true }}
          icon={Flame}
          accentColor="amber"
        />
        <KPICard
          label="Cadência média"
          value={
            <span>
              4.1<span className="text-ink-500 text-lg font-medium">×/sem</span>
            </span>
          }
          subtitle={<span className="text-ink-500">estável</span>}
          icon={TrendingUp}
          accentColor="violet"
        />
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="font-bold text-ink-100">Top performers da semana</div>
          <div className="text-[12px] text-ink-500">
            Posts com melhor desempenho de engajamento
          </div>
        </div>

        <div className="divide-y divide-bg-700/30">
          {topPerformers.map((post) => {
            const artista = artistas.find((a) => a.id === post.artistaId)
            return (
              <div
                key={post.id}
                className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors"
              >
                {artista && (
                  <AvatarFallback
                    iniciais={artista.iniciais}
                    gradient={artista.corAvatar}
                    size="md"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">
                    {artista?.nome ?? '—'}
                  </div>
                  <div className="font-semibold text-sm text-ink-100 truncate">{post.titulo}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    <span
                      className={cn(
                        'font-semibold',
                        plataformaCorMap[post.plataforma] ?? 'text-ink-400'
                      )}
                    >
                      {post.plataforma}
                    </span>
                    <span className="text-ink-600"> · </span>
                    <span className="num">{post.ha}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-base font-bold text-ink-100">{post.metrica}</div>
                  <div className="text-[11px] text-ink-500">{post.metricaLabel}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

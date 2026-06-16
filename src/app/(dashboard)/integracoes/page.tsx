import {
  AlertTriangle,
  Edit3,
  Link2,
  Lock,
  Plug,
  Plus,
  RefreshCw,
  Settings,
  Upload,
  Users,
} from 'lucide-react'
import {
  integracoesComplementares,
  integracoesEngajamento,
  oneRpmLogs,
  oneRpmPlataformas,
  oneRpmStats,
} from '@/lib/mock-data/integracoes'
import { IntegracaoCard } from '@/components/integracoes/integracao-card'
import { MetaInstagramCard } from '@/components/integracoes/meta-instagram-card'
import { TikTokCard } from '@/components/integracoes/tiktok-card'
import { YouTubeCard } from '@/components/integracoes/youtube-card'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { KPICard } from '@/components/shared/kpi-card'
import { ReceitaGate } from '@/components/auth/receita-gate'
import { cn, formatCurrency } from '@/lib/utils'

const corIconePorTipo: Record<string, string> = {
  meta: 'bg-blue-600',
  instagram: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500',
  tiktok: 'bg-bg-950 border border-bg-700 text-cyan-400',
  spotify_artists: 'bg-emerald-500',
  youtube: 'bg-red-500',
}

const tipoIconKey: Record<string, 'meta' | 'instagram' | 'tiktok' | 'spotify' | 'youtube'> = {
  meta: 'meta',
  instagram: 'instagram',
  tiktok: 'tiktok',
  spotify_artists: 'spotify',
  youtube: 'youtube',
}

function SecaoLabel({
  texto,
  cor,
}: {
  texto: string
  cor: 'amber' | 'violet' | 'cyan' | 'ink'
}) {
  const corMap = {
    amber: 'text-amber-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    ink: 'text-ink-400',
  } as const
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className={cn('text-[10px] tracking-[0.2em] font-bold', corMap[cor])}
      >
        {texto}
      </span>
      <span className="flex-1 h-px bg-bg-700/40" />
    </div>
  )
}

export default function IntegracoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.2em] text-violet-400 font-semibold mb-1">
            FONTES DE DADOS
          </div>
          <h1 className="text-3xl font-bold text-ink-100">Integrações</h1>
          <p className="text-sm text-ink-400 mt-1">
            Status de cada fonte que alimenta o painel · última verificação{' '}
            <span className="num text-ink-300">há 14min</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bg-700/60 hover:bg-bg-800 text-ink-200 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar tudo
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar fonte
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Fontes ativas"
          value={
            <span>
              6<span className="text-ink-500 text-lg font-medium">/7</span>
            </span>
          }
          variation={{ text: '86% operacional', positive: true }}
          icon={Plug}
          accentColor="emerald"
        />
        <KPICard
          label="Contas conectadas"
          value="406"
          subtitle={<span className="text-ink-500">de 127 artistas</span>}
          icon={Users}
          accentColor="violet"
        />
        <KPICard
          label="Última coleta"
          value="14m"
          subtitle={<span className="text-ink-500">há · OneRPM</span>}
          icon={RefreshCw}
          accentColor="amber"
        />
        <KPICard
          label="Atenção"
          value="3"
          subtitle={
            <span className="text-amber-400">contas precisam reautorizar</span>
          }
          icon={AlertTriangle}
          accentColor="red"
        />
      </div>

      <section>
        <SecaoLabel texto="FONTE OFICIAL · DADOS DE STREAMING E RECEITA" cor="amber" />

        <div className="bg-gradient-to-br from-amber-500/10 to-bg-900 border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="p-8 flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shrink-0 shadow-2xl shadow-amber-500/20 px-3">
              <span className="text-white font-black text-base tracking-wider">1RPM</span>
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-2xl font-bold text-ink-100 leading-tight mb-3">OneRPM</h2>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] tracking-wider font-bold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  CONECTADO
                </span>
                <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                  FONTE PRINCIPAL
                </span>
              </div>

              <p className="text-[13px] text-ink-300 leading-relaxed mb-5">
                Distribuidora oficial · relatórios via padrão DDEX (DSR) · todas as plataformas de streaming musical
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-ink-500 font-semibold tracking-wider uppercase mr-2">
                  COBRE
                </span>
                {oneRpmPlataformas.map((p) => (
                  <span
                    key={p}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-bg-800/80 border border-bg-700/60 text-ink-200 flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {p}
                  </span>
                ))}
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-bg-800/80 border border-bg-700/60 text-ink-400">
                  +8 mais
                </span>
              </div>
            </div>

            <button
              type="button"
              className="shrink-0 px-4 py-2.5 text-sm rounded-lg border border-bg-700/60 hover:bg-bg-800 text-ink-200 flex items-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          </div>

          <div className="grid grid-cols-4 border-t border-amber-500/20">
            <div className="p-4 border-r border-amber-500/20">
              <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
                Última sincronização
              </div>
              <div className="num text-lg font-bold text-emerald-400 mt-1">
                há {oneRpmStats.ultimaSinc}
              </div>
              <div className="text-[10px] num text-ink-500">
                automática a cada {oneRpmStats.frequenciaSinc}
              </div>
            </div>
            <div className="p-4 border-r border-amber-500/20">
              <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
                Faixas mapeadas
              </div>
              <div className="num text-lg font-bold text-ink-100 mt-1">
                {oneRpmStats.faixasMapeadas.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] num text-ink-500">via ISRC</div>
            </div>
            <ReceitaGate
              restrito={
                <div className="p-4 border-r border-amber-500/20">
                  <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
                    Receita 30D
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-500 mt-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-[13px] font-semibold">Restrito</span>
                  </div>
                  <div className="text-[10px] num text-ink-600">somente financeiro</div>
                </div>
              }
            >
            <div className="p-4 border-r border-amber-500/20">
              <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
                Receita 30D
              </div>
              <div className="num text-lg font-bold text-emerald-400 mt-1">
                {formatCurrency(oneRpmStats.receita30d)}
              </div>
              <div className="text-[10px] num text-emerald-400">
                +{oneRpmStats.variacaoReceita}% vs. anterior
              </div>
            </div>
            </ReceitaGate>
            <div className="p-4">
              <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
                Histórico importado
              </div>
              <div className="num text-lg font-bold text-ink-100 mt-1">
                {oneRpmStats.historicoMeses} meses
              </div>
              <div className="text-[10px] num text-ink-500">
                desde {oneRpmStats.desdeData}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-amber-500/20 bg-bg-950/30">
            <div className="text-[10px] tracking-wider text-ink-400 font-semibold uppercase mb-2">
              Atividade recente
            </div>
            <div className="space-y-1.5 font-mono text-[12px]">
              {oneRpmLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-3',
                    idx === 0 ? 'text-ink-300' : 'text-ink-500'
                  )}
                >
                  <span className="text-ink-500 num shrink-0">{log.hora}</span>
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="truncate">{log.mensagem}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SecaoLabel
          texto="APIs DE ENGAJAMENTO SOCIAL · AUDIÊNCIA E INTERAÇÃO"
          cor="violet"
        />
        <div className="grid grid-cols-3 gap-4">
          {/* Instagram (Meta) e TikTok — integrações REAIS (Graph API / Display API) */}
          <MetaInstagramCard />
          <TikTokCard />
          {/* Demais redes desta seção seguem como mock até serem integradas.
              'meta', 'instagram' e 'tiktok' saem do mock pois os cards reais acima os cobrem. */}
          {integracoesEngajamento
            .filter(
              (integ) =>
                integ.tipo !== 'instagram' && integ.tipo !== 'meta' && integ.tipo !== 'tiktok',
            )
            .map((integ) => (
              <IntegracaoCard
                key={integ.id}
                integracao={integ}
                icone={<PlataformaIcon tipo={tipoIconKey[integ.tipo]} />}
                corIcone={corIconePorTipo[integ.tipo]}
              />
            ))}
        </div>
      </section>

      <section>
        <SecaoLabel
          texto="DADOS COMPLEMENTARES · ENRIQUECEM AS FONTES PRINCIPAIS"
          cor="cyan"
        />
        <div className="grid grid-cols-2 gap-4">
          {/* YouTube — integração REAL (Data API + Analytics). */}
          <YouTubeCard />
          {/* Spotify for Artists segue mock até ser integrado. */}
          {integracoesComplementares
            .filter((integ) => integ.tipo !== 'youtube')
            .map((integ) => (
              <IntegracaoCard
                key={integ.id}
                integracao={integ}
                icone={<PlataformaIcon tipo={tipoIconKey[integ.tipo]} />}
                corIcone={corIconePorTipo[integ.tipo]}
              />
            ))}
        </div>
      </section>

      <section>
        <SecaoLabel texto="FONTES MANUAIS · COMPLEMENTARES" cor="ink" />
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 grid place-items-center shrink-0">
                <Upload className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink-100">
                    Importação CSV/XLSX
                  </span>
                  <span className="text-[10px] tracking-wider font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                    ATIVO
                  </span>
                </div>
                <p className="text-[12px] text-ink-400 mt-1">
                  Para métricas que vocês acompanham fora das APIs (rádio, eventos, fanclubes)
                </p>
                <div className="text-[11px] text-ink-500 num mt-2">
                  Última importação: há 2 dias · 47 registros
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 grid place-items-center shrink-0">
                <Edit3 className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink-100">
                    Entrada manual rápida
                  </span>
                  <span className="text-[10px] tracking-wider font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                    ATIVO
                  </span>
                </div>
                <p className="text-[12px] text-ink-400 mt-1">
                  Adicione qualquer métrica de qualquer artista em &lt; 30 segundos
                </p>
                <div className="text-[11px] text-ink-500 num mt-2">
                  Hoje: 12 entradas por{' '}
                  <span className="text-violet-400">Carla Pinheiro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center pt-4">
        <p className="text-[11px] text-ink-500 inline-flex items-center gap-1 flex-wrap justify-center">
          <Link2 className="w-3 h-3" />
          Todas as conexões usam OAuth 2.0 ou API keys criptografadas (AES-256) ·{' '}
          <a
            href="#"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Política de privacidade
          </a>
          {' · '}
          <a
            href="#"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Logs de auditoria
          </a>
        </p>
      </div>
    </div>
  )
}

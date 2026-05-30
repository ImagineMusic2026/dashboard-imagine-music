import { Plus } from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'
import { marcosSemana, proximosEventos, type EventoTipo } from '@/lib/mock-data/agenda'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { cn } from '@/lib/utils'

const tipoMap: Record<EventoTipo, { label: string; bar: string; text: string }> = {
  release: { label: 'RELEASE', bar: 'bg-violet-500', text: 'text-violet-400' },
  show: { label: 'SHOW', bar: 'bg-amber-500', text: 'text-amber-400' },
  contrato: { label: 'CONTRATO', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  reuniao: { label: 'REUNIÃO', bar: 'bg-cyan-500', text: 'text-cyan-400' },
}

const tabs = [
  { label: 'Mês', ativo: true },
  { label: 'Trimestre', ativo: false },
  { label: 'Ano', ativo: false },
]

export default function AgendaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Agenda</h1>
          <p className="text-sm text-ink-400 mt-1">
            Releases, shows, contratos e marcos do portfólio
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-bg-800 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  tab.ativo
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-ink-400 hover:text-ink-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo evento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
            <div>
              <div className="font-bold text-ink-100">Próximos 30 dias</div>
              <div className="text-[12px] text-ink-500">Eventos confirmados</div>
            </div>
            <span className="text-[10px] num bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded font-semibold">
              {proximosEventos.length} eventos
            </span>
          </div>

          <div className="divide-y divide-bg-700/30">
            {proximosEventos.map((evento) => {
              const artista = artistas.find((a) => a.id === evento.artistaId)
              const tipo = tipoMap[evento.tipo]
              return (
                <div
                  key={evento.id}
                  className="flex items-start gap-4 p-4 hover:bg-bg-800/30 transition-colors relative pl-6"
                >
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1', tipo.bar)} />
                  <div className="w-16 text-center shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                      {evento.data.mes}
                    </div>
                    <div className="num text-2xl font-bold text-ink-100">
                      {evento.data.dia}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-[10px] tracking-wider font-bold uppercase',
                        tipo.text
                      )}
                    >
                      {tipo.label}
                    </div>
                    <div className="font-semibold text-sm text-ink-100">{evento.titulo}</div>
                    <div className="text-[12px] text-ink-400">{evento.subtitulo}</div>
                  </div>
                  {artista && (
                    <AvatarFallback
                      iniciais={artista.iniciais}
                      gradient={artista.corAvatar}
                      size="sm"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 h-fit">
          <div className="font-bold text-ink-100">Esta semana</div>
          <div className="text-[12px] text-ink-500 mb-4 num">{marcosSemana.intervalo}</div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-300">Releases programados</span>
              <span className="num font-semibold text-ink-100">
                {marcosSemana.releasesProgramados}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-300">Shows confirmados</span>
              <span className="num font-semibold text-ink-100">
                {marcosSemana.showsConfirmados}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-300">Reuniões</span>
              <span className="num font-semibold text-ink-100">{marcosSemana.reunioes}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-300">Contratos vencendo</span>
              <span className="num font-semibold text-amber-400">
                {marcosSemana.contratosVencendo}
              </span>
            </div>
          </div>

          <div className="my-4 h-px bg-bg-700/40" />

          <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase mb-1">
            Próximo
          </div>
          <div className="text-sm text-ink-200">{marcosSemana.proximoEvento}</div>
        </div>
      </div>
    </div>
  )
}

import { alertas } from '@/lib/mock-data/alertas'
import { gestores } from '@/lib/mock-data/gestores'
import { AlertaItem } from '@/components/alertas/alerta-item'
import { FilterDropdown } from '@/components/shared/filter-dropdown'
import { cn } from '@/lib/utils'

const severidadePills = [
  { key: 'todos', label: 'Todos', count: null, ativo: true },
  { key: 'critico', label: 'Críticos', count: 2, ativo: false },
  { key: 'atencao', label: 'Atenção', count: 5, ativo: false },
  { key: 'oportunidade', label: 'Oportunidades', count: 3, ativo: false },
  { key: 'operacional', label: 'Operacional', count: 1, ativo: false },
  { key: 'resolvidos', label: 'Resolvidos', count: null, ativo: false },
]

const ordenarOptions = [
  { value: 'recentes', label: 'Mais recentes ↓' },
  { value: 'antigos', label: 'Mais antigos ↑' },
  { value: 'severidade', label: 'Por severidade' },
]

export default function AlertasPage() {
  const gestorOptions = gestores.map((g) => ({ value: g.id, label: g.nome }))

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Alertas</h1>
        <p className="text-sm text-ink-400 mt-1">
          <span className="num text-ink-200">7 abertos</span> ·{' '}
          <span className="num text-red-400">2 críticos</span> ·{' '}
          <span className="num text-amber-400">5 atenção</span> ·{' '}
          <span className="num text-emerald-400">3 oportunidades</span> ·{' '}
          <span className="num text-ink-300">12 resolvidos esta semana</span>
        </p>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        {severidadePills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              pill.ativo
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                : 'bg-bg-800 text-ink-400 hover:text-ink-100 border border-transparent'
            )}
          >
            {pill.label}
            {pill.count !== null && (
              <span className="ml-1.5 num text-ink-500">({pill.count})</span>
            )}
          </button>
        ))}

        <div className="w-px h-6 bg-bg-700/40 mx-1" />

        <FilterDropdown label="Gestor" count={gestores.length} options={gestorOptions} />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-ink-500">Ordenar:</span>
          <FilterDropdown label="Mais recentes ↓" options={ordenarOptions} multi={false} />
        </div>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="divide-y divide-bg-700/30">
          {alertas.map((alerta) => (
            <AlertaItem key={alerta.id} alerta={alerta} />
          ))}
        </div>
      </div>
    </div>
  )
}

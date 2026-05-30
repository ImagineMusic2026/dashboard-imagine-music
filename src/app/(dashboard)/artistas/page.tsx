import { ChevronLeft, ChevronRight, Download, Plus, Search, X } from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'
import { gestores } from '@/lib/mock-data/gestores'
import { ArtistaRow } from '@/components/artistas/artista-row'
import { OrdenarDropdown } from '@/components/artistas/ordenar-dropdown'
import { FilterDropdown } from '@/components/shared/filter-dropdown'
import { ReceitaGate } from '@/components/auth/receita-gate'

const generosUnicos = Array.from(new Set(artistas.map((a) => a.genero))).map((g) => ({
  value: g,
  label: g,
}))

const gestorOptions = gestores.map((g) => ({ value: g.id, label: g.nome }))

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'onboarding', label: 'Onboarding' },
]

const atualizadoMap = ['há 2h', 'há 1h', 'há 3h', 'há 1h', 'há 4h', 'há 1d', 'há 12h', 'há 5h', 'há 2h']

export default function ArtistasPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Artistas</h1>
          <p className="text-sm text-ink-400 mt-1">
            <span className="num text-ink-200">127 ativos</span>
            <span> · </span>
            <span className="num text-ink-200">8 em zona de risco</span>
            <span> · </span>
            <span className="num text-ink-200">3 em onboarding</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bg-700/60 hover:bg-bg-800 text-ink-200 text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo artista
          </button>
        </div>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filtrar por nome..."
            className="w-full pl-9 pr-3 py-2 bg-bg-800/50 border border-bg-700/40 rounded-lg text-sm text-ink-200 placeholder:text-ink-500 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        <div className="w-px h-6 bg-bg-700/40" />

        <FilterDropdown label="Gênero" count={generosUnicos.length} options={generosUnicos} />
        <FilterDropdown label="Gestor" count={gestores.length} options={gestorOptions} />
        <FilterDropdown label="Status" options={statusOptions} />

        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 text-sm transition-colors hover:bg-violet-500/15"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Health Score: 0-60
          <X className="w-3 h-3" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-ink-500">Ordenar:</span>
          <OrdenarDropdown />
        </div>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bg-700/40">
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-left">
                  Artista
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-left">
                  Gênero
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-left">
                  Gestor
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-left">
                  Health Score
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-left">
                  Tendência (30d)
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-right">
                  Audiência
                </th>
                <ReceitaGate>
                  <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-right">
                    Receita 30D
                  </th>
                </ReceitaGate>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-center">
                  Alertas
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-3 text-right">
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-700/30">
              {artistas.map((artista, idx) => (
                <ArtistaRow
                  key={artista.id}
                  artista={artista}
                  atualizado={atualizadoMap[idx]}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-bg-700/30 flex items-center justify-between">
          <div className="text-sm text-ink-400">
            Mostrando <span className="num text-ink-200">1-9</span> de{' '}
            <span className="num text-ink-200">127</span> artistas
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Página anterior"
              className="w-8 h-8 grid place-items-center rounded-md bg-bg-800 hover:bg-bg-700 text-ink-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-8 h-8 grid place-items-center rounded-md bg-violet-500/20 text-violet-300 num font-semibold"
            >
              1
            </button>
            <button
              type="button"
              className="w-8 h-8 grid place-items-center rounded-md hover:bg-bg-800 text-ink-400 num transition-colors"
            >
              2
            </button>
            <button
              type="button"
              className="w-8 h-8 grid place-items-center rounded-md hover:bg-bg-800 text-ink-400 num transition-colors"
            >
              3
            </button>
            <span className="text-ink-600 px-1">…</span>
            <button
              type="button"
              className="w-8 h-8 grid place-items-center rounded-md hover:bg-bg-800 text-ink-400 num transition-colors"
            >
              15
            </button>
            <button
              type="button"
              aria-label="Próxima página"
              className="w-8 h-8 grid place-items-center rounded-md bg-bg-800 hover:bg-bg-700 text-ink-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useAuth } from '@/components/auth/auth-provider'
import { FilterDropdown } from '@/components/shared/filter-dropdown'

const todasOpcoes = [
  { value: 'health-desc', label: 'Health Score ↓' },
  { value: 'health-asc', label: 'Health Score ↑' },
  { value: 'receita-desc', label: 'Receita ↓' },
  { value: 'receita-asc', label: 'Receita ↑' },
  { value: 'audiencia-desc', label: 'Audiência ↓' },
  { value: 'audiencia-asc', label: 'Audiência ↑' },
]

/** Dropdown de ordenação — esconde as opções por receita para quem não pode vê-la. */
export function OrdenarDropdown() {
  const { pode } = useAuth()
  const options = pode('verReceita')
    ? todasOpcoes
    : todasOpcoes.filter((o) => !o.value.startsWith('receita'))
  return <FilterDropdown label="Health Score ↓" options={options} multi={false} />
}

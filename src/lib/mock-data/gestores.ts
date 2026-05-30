import type { Gestor } from '@/types'

export const gestores: Gestor[] = [
  {
    id: 'g1',
    nome: 'Neinho Silva',
    email: 'neinho@somosimagine.com.br',
    papel: 'diretor',
    cor: 'from-violet-500 to-purple-600',
  },
  {
    id: 'g2',
    nome: 'Carla Pinheiro',
    email: 'carla@somosimagine.com.br',
    papel: 'gestor',
    cor: 'from-pink-500 to-rose-500',
  },
  {
    id: 'g3',
    nome: 'Roberta Lyra',
    email: 'roberta@somosimagine.com.br',
    papel: 'gestor',
    cor: 'from-emerald-500 to-teal-500',
  },
]

export function getGestorPorId(id: string): Gestor | undefined {
  return gestores.find((g) => g.id === id)
}

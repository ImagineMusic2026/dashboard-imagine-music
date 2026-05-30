'use client'

import { usePathname } from 'next/navigation'
import { Bell, Menu, Search } from 'lucide-react'
import { artistas } from '@/lib/mock-data/artistas'

const routeLabels: Record<string, string> = {
  '/home': 'Home',
  '/artistas': 'Artistas',
  '/alertas': 'Alertas',
  '/conteudo': 'Conteúdo',
  '/agenda': 'Agenda',
  '/importar': 'Importar',
  '/integracoes': 'Integrações',
  '/configuracoes': 'Configurações',
}

function getBreadcrumbTrail(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  const first = '/' + segments[0]
  const trail: string[] = [routeLabels[first] ?? segments[0]]

  if (segments[0] === 'artistas' && segments[1]) {
    const artista = artistas.find((a) => a.id === segments[1])
    trail.push(artista?.nome ?? segments[1])
  }

  return trail
}

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname()
  const trail = getBreadcrumbTrail(pathname)

  return (
    <header className="h-16 sticky top-0 z-10 bg-bg-900/40 backdrop-blur border-b border-bg-700/40 flex items-center px-8 gap-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Mostrar ou ocultar menu"
        className="shrink-0 -ml-2 p-2 rounded-lg text-ink-300 hover:bg-bg-800 hover:text-ink-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 text-sm shrink-0">
        <span className="text-ink-500">Painel</span>
        {trail.map((label, idx) => (
          <span key={idx} className="flex items-center gap-2">
            <span className="text-ink-500">›</span>
            <span
              className={
                idx === trail.length - 1
                  ? 'font-semibold text-ink-100'
                  : 'text-ink-500'
              }
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar artista, alerta, plataforma..."
            className="w-full bg-bg-800 border border-bg-700/40 rounded-lg text-sm pl-9 pr-12 py-2 text-ink-300 placeholder:text-ink-500 focus:outline-none focus:border-violet-500/40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-500 num bg-bg-700/50 px-1.5 py-0.5 rounded">
            ⌘K
          </span>
        </div>
      </div>

      <div className="shrink-0">
        <button
          type="button"
          className="relative bg-bg-800 hover:bg-bg-700 rounded-lg p-2 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-4 h-4 text-ink-300" />
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] num font-bold rounded-full w-4 h-4 flex items-center justify-center">
            7
          </span>
        </button>
      </div>
    </header>
  )
}

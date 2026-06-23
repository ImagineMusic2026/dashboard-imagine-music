'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

const STORAGE_KEY = 'painel:sidebar-colapsada'

/**
 * Casca do dashboard. No DESKTOP a sidebar fica no fluxo e o hambúrguer
 * recolhe/expande (largura, persistido). No MOBILE ela vira um drawer off-canvas
 * (overlay com backdrop) que o hambúrguer abre/fecha — sem roubar largura do
 * conteúdo.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [colapsada, setColapsada] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setColapsada(true)
  }, [])

  function toggle() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setColapsada((v) => {
        const novo = !v
        localStorage.setItem(STORAGE_KEY, String(novo))
        return novo
      })
    } else {
      setDrawer((v) => !v)
    }
  }

  return (
    <div className="flex min-h-screen bg-bg-950">
      <Sidebar colapsada={colapsada} drawer={drawer} onFechar={() => setDrawer(false)} />

      {/* Backdrop do drawer — só mobile, fecha ao tocar. */}
      {drawer && (
        <div
          className="fixed inset-0 z-40 bg-bg-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawer(false)}
          aria-hidden
        />
      )}

      <main className="flex-1 min-w-0">
        <Topbar onToggleSidebar={toggle} />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

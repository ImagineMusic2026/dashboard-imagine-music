'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

const STORAGE_KEY = 'painel:sidebar-colapsada'

/** Casca do dashboard: controla o recolher/expandir da sidebar (com o hamburguer na topbar). */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [colapsada, setColapsada] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setColapsada(true)
  }, [])

  function toggle() {
    setColapsada((v) => {
      const novo = !v
      localStorage.setItem(STORAGE_KEY, String(novo))
      return novo
    })
  }

  return (
    <div className="flex min-h-screen bg-bg-950">
      <Sidebar colapsada={colapsada} />
      <main className="flex-1 min-w-0">
        <Topbar onToggleSidebar={toggle} />
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Menu, Search } from 'lucide-react'
import { getArtista } from '@/lib/artistas/client'
import { useQtdAlertas } from '@/lib/alertas/use-qtd-alertas'
import { BuscaGlobal } from '@/components/layout/busca-global'

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

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname()
  const qtdAlertas = useQtdAlertas()
  const [buscaAberta, setBuscaAberta] = useState(false)

  // Atalho ⌘K / Ctrl+K abre a busca global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscaAberta(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const segments = pathname.split('/').filter(Boolean)
  const slugArtista = segments[0] === 'artistas' && segments[1] ? segments[1] : null

  // Breadcrumb do perfil: nome REAL do artista (antes vinha do mock e nem batia).
  const [nomeArtista, setNomeArtista] = useState<string | null>(null)
  useEffect(() => {
    if (!slugArtista) {
      setNomeArtista(null)
      return
    }
    let vivo = true
    getArtista(slugArtista)
      .then((a) => vivo && setNomeArtista(a?.nome ?? null))
      .catch(() => vivo && setNomeArtista(null))
    return () => {
      vivo = false
    }
  }, [slugArtista])

  const trail: string[] = []
  if (segments.length) {
    trail.push(routeLabels['/' + segments[0]] ?? segments[0])
    if (slugArtista) trail.push(nomeArtista ?? slugArtista)
  }

  return (
    <>
    <header className="h-16 sticky top-0 z-10 bg-bg-900/40 backdrop-blur border-b border-bg-700/40 flex items-center px-4 lg:px-8 gap-2 lg:gap-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Mostrar ou ocultar menu"
        className="shrink-0 -ml-2 p-2 rounded-lg text-ink-300 hover:bg-bg-800 hover:text-ink-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="hidden sm:flex items-center gap-2 text-sm shrink-0">
        <span className="text-ink-500">Painel</span>
        {trail.map((label, idx) => (
          <span key={idx} className="flex items-center gap-2">
            <span className="text-ink-500">›</span>
            <span
              className={
                idx === trail.length - 1 ? 'font-semibold text-ink-100' : 'text-ink-500'
              }
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1 flex justify-center">
        <button
          type="button"
          onClick={() => setBuscaAberta(true)}
          aria-label="Buscar"
          className="relative w-full max-w-md bg-bg-800 border border-bg-700/40 rounded-lg text-sm pl-9 pr-3 sm:pr-12 py-2 text-ink-500 hover:border-violet-500/40 hover:text-ink-300 transition-colors text-left"
        >
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <span className="block truncate">Buscar artista, alerta, conteúdo...</span>
          <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-500 num bg-bg-700/50 px-1.5 py-0.5 rounded">
            ⌘K
          </span>
        </button>
      </div>

      <div className="shrink-0">
        <Link
          href="/alertas"
          className="relative grid place-items-center bg-bg-800 hover:bg-bg-700 rounded-lg p-2 transition-colors"
          aria-label={qtdAlertas ? `Notificações — ${qtdAlertas} alertas` : 'Notificações'}
        >
          <Bell className="w-4 h-4 text-ink-300" />
          {qtdAlertas != null && qtdAlertas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] num font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
              {qtdAlertas > 99 ? '99+' : qtdAlertas}
            </span>
          )}
        </Link>
      </div>
    </header>

      <BuscaGlobal aberto={buscaAberta} onFechar={() => setBuscaAberta(false)} />
    </>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Bell,
  Music,
  Calendar,
  Upload,
  Plug,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { collection, getCountFromServer } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: { text: string; tone: 'neutral' | 'danger' }
}

const navPrincipal: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/artistas', label: 'Artistas', icon: Users },
  { href: '/alertas', label: 'Alertas', icon: Bell, badge: { text: '7', tone: 'danger' } },
  { href: '/conteudo', label: 'Conteúdo', icon: Music },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
]

const navDados: NavItem[] = [
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/integracoes', label: 'Integrações', icon: Plug },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 text-sm transition-colors',
        active
          ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium'
          : 'text-ink-300 hover:bg-bg-800 border border-transparent'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            'text-[10px] num px-1.5 py-0.5 rounded',
            item.badge.tone === 'danger'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-bg-700 text-ink-300'
          )}
        >
          {item.badge.text}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ colapsada }: { colapsada: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, role } = useAuth()
  const [qtdArtistas, setQtdArtistas] = useState<number | null>(null)

  // Contagem real de artistas no cadastro (Firestore). Só admin lê a coleção,
  // então pros demais o badge simplesmente não aparece.
  useEffect(() => {
    if (role !== 'admin') {
      setQtdArtistas(null)
      return
    }
    let vivo = true
    getCountFromServer(collection(db, 'artistas'))
      .then((s) => vivo && setQtdArtistas(s.data().count))
      .catch(() => vivo && setQtdArtistas(null))
    return () => {
      vivo = false
    }
  }, [role])

  const handleLogout = async () => {
    await signOut(auth)
    router.replace('/login')
  }

  const nome = user?.displayName || user?.email?.split('@')[0] || 'Usuário'
  const iniciais = nome.slice(0, 2).toUpperCase()

  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/home'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={cn(
        'shrink-0 sticky top-0 h-screen overflow-hidden transition-[width] duration-300 ease-in-out',
        colapsada ? 'w-0' : 'w-60'
      )}
    >
      <div className="w-60 h-screen bg-bg-900 border-r border-bg-700/50 flex flex-col">
        <div className="p-5 border-b border-bg-700/40 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-amber-400 flex items-center justify-center">
          <span className="text-bg-950 font-bold text-sm">i</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] tracking-[0.18em] text-ink-400 font-semibold uppercase">
            IMAGINE
          </span>
          <span className="text-[13px] font-bold text-ink-100">Painel de Artistas</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="text-[10px] tracking-[0.15em] text-ink-500 px-3 mb-2 font-semibold">
          PRINCIPAL
        </div>
        {navPrincipal.map((item) => {
          const it =
            item.href === '/artistas' && qtdArtistas != null
              ? { ...item, badge: { text: String(qtdArtistas), tone: 'neutral' as const } }
              : item
          return <NavLink key={item.href} item={it} active={isActive(item.href)} />
        })}

        <div className="text-[10px] tracking-[0.15em] text-ink-500 px-3 mb-2 mt-6 font-semibold">
          DADOS
        </div>
        {navDados.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="p-3 border-t border-bg-700/40 space-y-1">
        <div className="flex items-center gap-2.5 p-2 rounded-lg transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-violet-500 flex items-center justify-center shrink-0">
            <span className="text-bg-950 font-bold text-xs">{iniciais}</span>
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[13px] font-semibold text-ink-100 truncate capitalize">
              {nome}
            </span>
            <span className="text-[11px] text-ink-500 truncate">{user?.email ?? ''}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-left text-[11px] text-ink-500 hover:text-ink-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>
      </div>
    </aside>
  )
}

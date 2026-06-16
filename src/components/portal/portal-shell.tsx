'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { BrandLogo } from '@/components/shared/logo'

/**
 * Casca mínima do portal do artista: marca Imagine + nome + sair.
 * Sem sidebar/topbar da equipe — o artista não navega pelo resto do painel.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth()
  const router = useRouter()

  async function sair() {
    await signOut(auth)
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-bg-950">
      <header className="border-b border-bg-700/40 bg-bg-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo className="h-6 shrink-0" />
            <div className="h-7 w-px bg-bg-700/60 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.18em] text-ink-500 font-bold leading-none uppercase">
                Portal do artista
              </div>
              <div className="text-sm font-semibold text-ink-100 truncate mt-1">
                {appUser?.nome ?? 'Meu perfil'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={sair}
            className="flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-100 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-8">{children}</main>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'

/**
 * Protege as rotas do dashboard: se não houver usuário autenticado,
 * redireciona para /login. Enquanto o Firebase resolve o estado de auth,
 * mostra uma tela de carregamento (evita "flash" de conteúdo protegido).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-bg-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-amber-400 grid place-items-center text-bg-950 font-bold text-xl animate-pulse">
            i
          </div>
          <span className="text-sm text-ink-500">Carregando…</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

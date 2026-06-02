'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'

/**
 * Protege as rotas do dashboard:
 * - sem usuário autenticado → manda pro /login;
 * - usuário com acesso desativado (`ativo: false`) → desloga e manda pro /login;
 * - enquanto o Firebase resolve o estado de auth, mostra um loader (evita "flash"
 *   de conteúdo protegido).
 *
 * Obs.: esta é a barreira de UX. A proteção de verdade está no servidor — a
 * credencial é desabilitada no Firebase Auth e as regras do Firestore checam `ativo`.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth()
  const router = useRouter()

  const inativo = appUser?.ativo === false

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (inativo) {
      signOut(auth).finally(() => router.replace('/login?desativado=1'))
    }
  }, [loading, user, inativo, router])

  if (loading || !user || inativo) {
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

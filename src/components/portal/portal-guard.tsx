'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { ehArtista } from '@/lib/permissions'

/**
 * Protege o portal do artista (/meu-perfil):
 * - sem login → /login;
 * - acesso desativado → desloga e manda pro /login;
 * - quem NÃO é artista (admin/marketing) → manda pro /home (painel da equipe).
 *
 * Esta é a barreira de UX. A proteção REAL é o Firestore: as regras só liberam o
 * artista a ler o próprio slug (artistas/{slug} e metricas-sociais/{slug}).
 */
export function PortalGuard({ children }: { children: React.ReactNode }) {
  const { user, appUser, role, loading } = useAuth()
  const router = useRouter()

  const inativo = appUser?.ativo === false
  const artista = ehArtista(role)
  // Perfil carregado e NÃO é artista → é staff tentando entrar no portal.
  const naoArtista = !!appUser && !artista

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (inativo) {
      signOut(auth).finally(() => router.replace('/login?desativado=1'))
      return
    }
    if (naoArtista) router.replace('/home')
  }, [loading, user, inativo, naoArtista, router])

  if (loading || !user || inativo || !artista) {
    return (
      <div className="min-h-screen bg-bg-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 grid place-items-center text-white font-bold text-xl animate-pulse">
            i
          </div>
          <span className="text-sm text-ink-500">Carregando…</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

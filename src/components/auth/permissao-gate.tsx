'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import type { Capacidade } from '@/lib/users'

/**
 * Mostra `children` só para quem tem a capacidade `cap` (override por pessoa ou
 * padrão do papel — ver `@/lib/permissions`). Caso contrário (ou enquanto
 * carrega) mostra `restrito`. É só o gate de UI; a barreira real fica nas rotas
 * de API e nas regras do Firestore.
 */
export function PermissaoGate({
  cap,
  children,
  restrito = null,
}: {
  cap: Capacidade
  children: ReactNode
  restrito?: ReactNode
}) {
  const { pode, loading } = useAuth()
  if (loading) return null
  if (pode(cap)) return <>{children}</>
  return <>{restrito}</>
}

/** Aviso padrão de página sem acesso. */
export function SemAcesso({ titulo }: { titulo: string }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-12 h-12 rounded-xl bg-bg-800 grid place-items-center mx-auto mb-3 text-ink-500">
        <Lock className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-bold text-ink-100">{titulo}</h1>
      <p className="text-sm text-ink-400 mt-2">
        Você não tem acesso a esta área. Fale com um admin se precisar — ele pode liberar em
        Configurações → Permissões.
      </p>
    </div>
  )
}

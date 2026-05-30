'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { podeVerReceita } from '@/lib/permissions'

/**
 * Mostra `children` (conteúdo de receita) só para quem tem permissão (admin).
 * Para os demais — ou enquanto a role carrega — mostra `restrito` (ou nada).
 */
export function ReceitaGate({
  children,
  restrito = null,
}: {
  children: ReactNode
  restrito?: ReactNode
}) {
  const { role, loading } = useAuth()
  if (!loading && podeVerReceita(role)) return <>{children}</>
  return <>{restrito}</>
}

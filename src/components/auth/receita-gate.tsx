'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/components/auth/auth-provider'

/**
 * Mostra `children` (conteúdo de receita) só para quem tem a permissão `verReceita`
 * (padrão: admin; o admin pode conceder a outra pessoa). Para os demais — ou
 * enquanto carrega — mostra `restrito` (ou nada).
 */
export function ReceitaGate({
  children,
  restrito = null,
}: {
  children: ReactNode
  restrito?: ReactNode
}) {
  const { pode, loading } = useAuth()
  if (!loading && pode('verReceita')) return <>{children}</>
  return <>{restrito}</>
}

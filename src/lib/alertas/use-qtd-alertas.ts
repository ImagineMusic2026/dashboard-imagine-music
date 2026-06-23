'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { listarArtistas } from '@/lib/artistas/client'
import { derivarAlertas } from '@/lib/alertas/derivar'

/**
 * Contagem REAL de alertas abertos (derivada das métricas sociais), pro badge do
 * menu e o sino da topbar — uma fonte só, sempre coerentes. Retorna `null`
 * enquanto carrega ou quando o membro não tem acesso.
 */
export function useQtdAlertas(): number | null {
  const { role } = useAuth()
  const [qtd, setQtd] = useState<number | null>(null)

  useEffect(() => {
    if (!role) {
      setQtd(null)
      return
    }
    let vivo = true
    ;(async () => {
      try {
        const [mapa, arts] = await Promise.all([listarMetricasSociais(), listarArtistas()])
        if (!vivo) return
        const nome = new Map(arts.map((a) => [a.slug, a.nome]))
        setQtd(derivarAlertas(mapa, nome).length)
      } catch {
        if (vivo) setQtd(null)
      }
    })()
    return () => {
      vivo = false
    }
  }, [role])

  return qtd
}

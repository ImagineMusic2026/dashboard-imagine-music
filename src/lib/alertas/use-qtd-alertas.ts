'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { listarArtistas } from '@/lib/artistas/client'
import { derivarAlertas, type AlertaDerivado } from '@/lib/alertas/derivar'
import { filtrarPorPrefs, NOTIF_PREFS_EVENT } from '@/lib/alertas/preferencias'

/**
 * Contagem REAL de alertas abertos (derivada das métricas sociais), pro badge do
 * menu e o sino da topbar — uma fonte só, sempre coerentes. Conta só as
 * categorias ativas nas Notificações e reage na hora quando a preferência muda.
 * Retorna `null` enquanto carrega ou quando o membro não tem acesso.
 */
export function useQtdAlertas(): number | null {
  const { role } = useAuth()
  const [todos, setTodos] = useState<AlertaDerivado[] | null>(null)
  const [qtd, setQtd] = useState<number | null>(null)

  useEffect(() => {
    if (!role) {
      setTodos(null)
      setQtd(null)
      return
    }
    let vivo = true
    ;(async () => {
      try {
        const [mapa, arts] = await Promise.all([listarMetricasSociais(), listarArtistas()])
        if (!vivo) return
        const nome = new Map(arts.map((a) => [a.slug, a.nome]))
        setTodos(derivarAlertas(mapa, nome))
      } catch {
        if (vivo) {
          setTodos(null)
          setQtd(null)
        }
      }
    })()
    return () => {
      vivo = false
    }
  }, [role])

  useEffect(() => {
    if (todos == null) {
      setQtd(null)
      return
    }
    const recalc = () => setQtd(filtrarPorPrefs(todos).length)
    recalc()
    window.addEventListener(NOTIF_PREFS_EVENT, recalc)
    return () => window.removeEventListener(NOTIF_PREFS_EVENT, recalc)
  }, [todos])

  return qtd
}

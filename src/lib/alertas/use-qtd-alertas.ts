'use client'

import { useEffect, useState } from 'react'
import { useAlertas } from '@/components/alertas/alertas-provider'
import { filtrarPorPrefs, NOTIF_PREFS_EVENT } from '@/lib/alertas/preferencias'
import { semVistos } from '@/lib/alertas/vistos'

/**
 * Contagem REAL de alertas abertos, pro badge do menu e o sino da topbar. Conta a
 * MESMA lista que a Home e a página de Alertas mostram (ela mora no casco, ver
 * `AlertasProvider`), só com as categorias ativas nas Notificações e sem o que a
 * pessoa marcou como visto — e reage na hora quando qualquer um dos dois muda.
 * Retorna `null` enquanto carrega ou quando o membro não tem acesso.
 */
export function useQtdAlertas(): number | null {
  const { carregados, vistos } = useAlertas()
  const [qtd, setQtd] = useState<number | null>(null)

  useEffect(() => {
    // Sem os vistos, o número ainda não é o certo: melhor nenhum que um que cai.
    if (carregados == null || vistos === null) {
      setQtd(null)
      return
    }
    const recalc = () => setQtd(semVistos(filtrarPorPrefs(carregados.alertas), vistos).length)
    recalc()
    window.addEventListener(NOTIF_PREFS_EVENT, recalc)
    return () => window.removeEventListener(NOTIF_PREFS_EVENT, recalc)
  }, [carregados, vistos])

  return qtd
}

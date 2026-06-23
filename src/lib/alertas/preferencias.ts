/**
 * Preferências de notificação: quais tipos de alerta chegam no sino e no feed.
 * Guardadas no navegador (localStorage), como as demais Preferências — não
 * sincroniza entre dispositivos.
 *
 * Modelo "silenciados": o default é tudo ligado, então alertas de categorias
 * novas passam a notificar sem precisar mexer aqui. Os alertas em si continuam
 * sendo derivados por `derivarAlertas`; isto só esconde as categorias mudas das
 * superfícies de notificação (sino, feed de Alertas e resumo da Home).
 */

export const CATEGORIAS_ALERTA = [
  'viralizacao',
  'destaque',
  'crescimento_seguidores',
  'marco_seguidores',
  'sem_postar',
  'queda_seguidores',
] as const

export type CategoriaAlerta = (typeof CATEGORIAS_ALERTA)[number]

const KEY = 'painel:alertas-silenciados'

/** Disparado ao mudar as preferências — pro badge do sino reagir na hora. */
export const NOTIF_PREFS_EVENT = 'notif-prefs:atualizado'

function ler(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Categorias silenciadas (não notificam). Default: nenhuma. */
export function getSilenciados(): Set<string> {
  return ler()
}

/** Liga/desliga uma categoria e avisa quem ouve (sino). */
export function setCategoriaAtiva(cat: CategoriaAlerta, ativa: boolean): void {
  if (typeof window === 'undefined') return
  const s = ler()
  if (ativa) s.delete(cat)
  else s.add(cat)
  localStorage.setItem(KEY, JSON.stringify(Array.from(s)))
  window.dispatchEvent(new Event(NOTIF_PREFS_EVENT))
}

/** Remove os alertas de categorias silenciadas. */
export function filtrarPorPrefs<T extends { categoria: string }>(alertas: T[]): T[] {
  const sil = ler()
  return sil.size ? alertas.filter((a) => !sil.has(a.categoria)) : alertas
}

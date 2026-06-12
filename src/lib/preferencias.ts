/**
 * Preferências de exibição do painel, salvas no navegador (localStorage).
 * Por enquanto: página inicial padrão (qual tela abre ao entrar no painel).
 *
 * Obs.: é por-navegador (não sincroniza entre dispositivos). Guardar no perfil
 * do usuário exigiria liberar a escrita do próprio doc nas regras — fica p/ depois.
 */

export const PAGINAS_INICIAIS = [
  { value: '/home', label: 'Home' },
  { value: '/artistas', label: 'Artistas' },
  { value: '/agenda', label: 'Agenda' },
  { value: '/integracoes', label: 'Integrações' },
] as const

const HOME_KEY = 'painel:home-padrao'
const HOME_DEFAULT = '/home'

/** Página inicial preferida (rota). Cai no default se não houver/for inválida. */
export function getHomePadrao(): string {
  if (typeof window === 'undefined') return HOME_DEFAULT
  const v = localStorage.getItem(HOME_KEY)
  return PAGINAS_INICIAIS.some((p) => p.value === v) ? (v as string) : HOME_DEFAULT
}

export function setHomePadrao(value: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(HOME_KEY, value)
}

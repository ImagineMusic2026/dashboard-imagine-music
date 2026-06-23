import type { AppUser, Capacidade, Role } from '@/lib/users'

/**
 * Permissões da plataforma. O acesso parte do PAPEL (admin/marketing/artista),
 * mas o admin pode conceder/restringir capacidades POR PESSOA — um override que
 * mora em `users/{uid}.permissoes`. A regra efetiva é:
 *
 *     override do usuário (se definido) → senão o padrão do papel
 *
 * Esta lógica é espelhada nas 3 camadas: gates da UI (via `useAuth().pode`),
 * guardas das rotas de API (`exigirPermissao`) e regras do Firestore (`podeCap`).
 * Capacidades ESTRUTURAIS do papel (acessar o painel, portal do artista, ver o
 * próprio perfil) não são editáveis e seguem como `ehStaff`/`ehArtista`.
 */

/** Padrão de cada capacidade por papel (o que vale sem override). */
const PADRAO: Record<Role, Record<Capacidade, boolean>> = {
  admin: { verReceita: true, agenda: true, integracoes: true, importar: true },
  marketing: { verReceita: false, agenda: true, integracoes: false, importar: false },
  artista: { verReceita: false, agenda: false, integracoes: false, importar: false },
}

/** Registro das capacidades editáveis (rótulo + descrição) — alimenta a matriz. */
export const CAPACIDADES: { cap: Capacidade; label: string; descricao: string }[] = [
  { cap: 'verReceita', label: 'Ver receita / financeiro', descricao: 'Receita e streams dos artistas (OneRPM).' },
  { cap: 'agenda', label: 'Agenda', descricao: 'Criar e editar eventos (releases, shows, contratos).' },
  { cap: 'integracoes', label: 'Integrações', descricao: 'Descobrir contas e sincronizar métricas.' },
  { cap: 'importar', label: 'Importar dados', descricao: 'Subir planilhas de OneRPM e roster.' },
]

/** O padrão do papel para uma capacidade (sem considerar override). */
export function padraoDoPapel(role: Role | null, cap: Capacidade): boolean {
  return role ? PADRAO[role][cap] : false
}

/** Permissão EFETIVA: override do usuário se houver, senão o padrão do papel. */
export function temPermissao(
  user: Pick<AppUser, 'role' | 'permissoes'> | null,
  cap: Capacidade,
): boolean {
  if (!user) return false
  const override = user.permissoes?.[cap]
  // `?? PADRAO[role]?.[cap] ?? false`: papel desconhecido (ex.: artista logado
  // numa rota de staff) nunca passa.
  return override ?? PADRAO[user.role]?.[cap] ?? false
}

/** Equipe Imagine (admin ou marketing) — acesso ao painel (estrutural, não editável). */
export function ehStaff(role: Role | null): boolean {
  return role === 'admin' || role === 'marketing'
}

/** Artista — portal restrito ao próprio perfil (estrutural, não editável). */
export function ehArtista(role: Role | null): boolean {
  return role === 'artista'
}

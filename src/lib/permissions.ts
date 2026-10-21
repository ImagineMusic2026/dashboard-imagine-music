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
 *
 * O colaborador é o caso à parte: não é equipe (`ehStaff` é false), não tem
 * nada por padrão e só recebe as capacidades de `CONCEDIVEIS.colaborador`. Um
 * override fora dessa lista é IGNORADO em `temPermissao` — é isso que impede um
 * switch ligado por engano na matriz de abrir uma rota de API para ele.
 */

/** Padrão de cada capacidade por papel (o que vale sem override). */
const PADRAO: Record<Role, Record<Capacidade, boolean>> = {
  admin: {
    verReceita: true,
    agenda: true,
    atividades: true,
    contratos: true,
    integracoes: true,
    importar: true,
    editarArtistas: true,
    conexoesArtista: true,
    convidarArtistas: true,
  },
  marketing: {
    verReceita: false,
    agenda: true,
    // O quadro de atividades É a rotina do marketing — o fluxo de atendimento
    // que ele toca. Vem ligado; o admin pode tirar de alguém.
    atividades: true,
    // Contrato traz vigência, percentual e o link do documento assinado. Fica
    // FECHADO por padrão pro marketing: quem precisar, o admin libera na matriz.
    contratos: false,
    integracoes: false,
    importar: false,
    // O time de marketing é quem mantém o cadastro (cria, edita e preenche o
    // questionário de estruturação) e cobra a conexão do artista no dia a dia — por
    // isso estas vêm ligadas (o admin pode tirar de alguém). Convidar vale SÓ para
    // logins de artista: convidar admin/marketing segue exclusivo do admin. Excluir
    // artista não é delegável: segue `exigirAdmin`.
    editarArtistas: true,
    conexoesArtista: true,
    convidarArtistas: true,
  },
  // Colaborador nasce sem nada: o convite liga as áreas dele (ver CONCEDIVEIS).
  colaborador: {
    verReceita: false,
    agenda: false,
    atividades: false,
    contratos: false,
    integracoes: false,
    importar: false,
    editarArtistas: false,
    conexoesArtista: false,
    convidarArtistas: false,
  },
  artista: {
    verReceita: false,
    agenda: false,
    atividades: false,
    contratos: false,
    integracoes: false,
    importar: false,
    editarArtistas: false,
    conexoesArtista: false,
    convidarArtistas: false,
  },
}

/** Registro das capacidades editáveis (rótulo + descrição) — alimenta a matriz. */
export const CAPACIDADES: { cap: Capacidade; label: string; descricao: string }[] = [
  { cap: 'verReceita', label: 'Ver receita / financeiro', descricao: 'Receita e streams dos artistas (OneRPM).' },
  { cap: 'agenda', label: 'Agenda', descricao: 'Criar e editar eventos (releases, shows, contratos).' },
  {
    cap: 'atividades',
    label: 'Atividades (kanban)',
    descricao:
      'Ver o quadro de demandas do atendimento, criar cards, mover de etapa e definir o responsável.',
  },
  {
    cap: 'contratos',
    label: 'Contratos do artista',
    descricao:
      'Ver e manter a ficha de contrato no perfil do artista (vigência, percentual e link do documento).',
  },
  { cap: 'integracoes', label: 'Integrações', descricao: 'Descobrir contas e sincronizar métricas.' },
  { cap: 'importar', label: 'Importar dados', descricao: 'Subir planilhas de OneRPM e roster.' },
  {
    cap: 'editarArtistas',
    label: 'Cadastrar / editar artistas',
    descricao:
      'Criar artista novo, alterar o cadastro (nome, gênero, foto, redes e projeto) e preencher o questionário de estruturação pelo painel. Excluir segue só admin.',
  },
  {
    cap: 'conexoesArtista',
    label: 'Conexões do artista',
    descricao: 'Gerar e revogar os links de autorização do YouTube e do TikTok.',
  },
  {
    cap: 'convidarArtistas',
    label: 'Convidar artistas',
    descricao:
      'Criar e cancelar convites de acesso ao portal do artista. Convidar admin/marketing segue só admin.',
  },
]

const TODAS = CAPACIDADES.map((c) => c.cap)

/**
 * Capacidades que cada papel PODE ter, com override ou sem. Fora desta lista a
 * capacidade é negada mesmo com o switch ligado.
 *
 * O colaborador só recebe o que tem fronteira própria nas regras do Firestore
 * (`colaboradorAtividades` em firestore.rules) — por isso, hoje, só Atividades.
 * Abrir outra área para ele é transformar uma leitura que hoje é "de equipe"
 * em capacidade nas regras ANTES de entrar aqui.
 */
export const CONCEDIVEIS: Record<Role, readonly Capacidade[]> = {
  admin: TODAS,
  marketing: TODAS,
  colaborador: ['atividades'],
  artista: [],
}

/**
 * Como cada área aparece para o colaborador (no convite e na lista do time).
 * Texto próprio porque o alcance dele é outro: no quadro, ele só enxerga as
 * demandas em que é o responsável.
 */
export const AREAS_COLABORADOR: Partial<Record<Capacidade, { label: string; descricao: string }>> = {
  atividades: {
    label: 'Atividades',
    descricao: 'Só as demandas em que for o responsável: ver, criar, editar, mover, comentar e excluir.',
  },
}

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
  // Antes do override: o que o papel não pode ter não vira permissão por um
  // switch ligado. Papel desconhecido também para aqui.
  if (!CONCEDIVEIS[user.role]?.includes(cap)) return false
  const override = user.permissoes?.[cap]
  return override ?? PADRAO[user.role]?.[cap] ?? false
}

/**
 * Equipe Imagine (admin ou marketing) — acesso ao painel (estrutural, não editável).
 * NUNCA incluir o colaborador aqui: o painel inteiro, as rotas e as regras do
 * Firestore tratam "equipe" como quem enxerga artistas, métricas e o time.
 */
export function ehStaff(role: Role | null): boolean {
  return role === 'admin' || role === 'marketing'
}

/** Colaborador — entra no painel, mas só nas áreas liberadas para ele. */
export function ehColaborador(role: Role | null): boolean {
  return role === 'colaborador'
}

/** Artista — portal restrito ao próprio perfil (estrutural, não editável). */
export function ehArtista(role: Role | null): boolean {
  return role === 'artista'
}

/** Tela de cada capacidade que o colaborador pode receber. */
const ROTA_POR_CAP: Partial<Record<Capacidade, string>> = {
  atividades: '/atividades',
}

/** Telas do painel que valem para quem tem login, seja qual for a área. */
const ROTAS_DE_TODOS = ['/configuracoes']

function dentroDe(pathname: string, rota: string): boolean {
  return pathname === rota || pathname.startsWith(`${rota}/`)
}

/** Telas que o colaborador alcança: as das áreas liberadas, na ordem do menu. */
function rotasDoColaborador(user: Pick<AppUser, 'role' | 'permissoes'>): string[] {
  return CONCEDIVEIS.colaborador
    .filter((c) => temPermissao(user, c))
    .map((c) => ROTA_POR_CAP[c])
    .filter((r): r is string => !!r)
}

/**
 * A pessoa pode abrir esta tela do painel? Para a equipe é sempre sim — cada
 * página continua com o próprio gate. Para o colaborador, só as áreas dele e
 * as telas de todos (o próprio perfil).
 */
export function rotaPermitida(
  user: Pick<AppUser, 'role' | 'permissoes'> | null,
  pathname: string,
): boolean {
  if (!user) return false
  if (ehStaff(user.role)) return true
  if (!ehColaborador(user.role)) return false
  return [...rotasDoColaborador(user), ...ROTAS_DE_TODOS].some((r) => dentroDe(pathname, r))
}

/**
 * Para onde a pessoa vai ao entrar. `null` = colaborador sem nenhuma área
 * liberada (a guarda mostra o aviso em vez de uma tela vazia).
 */
export function rotaInicial(user: Pick<AppUser, 'role' | 'permissoes'> | null): string | null {
  if (!user) return null
  if (ehStaff(user.role)) return '/home'
  if (ehArtista(user.role)) return '/meu-perfil'
  if (ehColaborador(user.role)) return rotasDoColaborador(user)[0] ?? null
  return null
}

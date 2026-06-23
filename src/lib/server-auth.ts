import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { temPermissao } from '@/lib/permissions'
import type { Capacidade, Role } from '@/lib/users'

/**
 * Guardas de autenticação para Route Handlers (server-only). Mesmo formato já
 * usado nas rotas de importação: Bearer com o ID token do Firebase + checagem
 * de role/ativo em `users/{uid}`.
 */

export interface AdminAuth {
  uid: string
  email: string
}

/** Exige um admin ativo. Retorna NextResponse (erro) ou os dados do admin. */
export async function exigirAdmin(req: Request): Promise<AdminAuth | NextResponse> {
  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let uid: string
  let tokenEmail: string | undefined
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    tokenEmail = decoded.email
  } catch {
    return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 })
  }

  const snap = await adminDb.doc(`users/${uid}`).get()
  const u = snap.data()
  if (!snap.exists || u?.role !== 'admin' || u?.ativo === false) {
    return NextResponse.json({ error: 'Apenas um admin pode executar esta ação.' }, { status: 403 })
  }
  return { uid, email: (u?.email as string | undefined) ?? tokenEmail ?? '' }
}

export interface SessaoAtiva {
  uid: string
  email: string
  /** 'admin' | 'marketing' | 'artista' | ''. */
  role: string
  /** Slug do artista vinculado ao login (só para role 'artista'). */
  artistaSlug: string | null
  /** Exceções de permissão por pessoa (override do padrão do papel). */
  permissoes?: Partial<Record<Capacidade, boolean>>
}

/**
 * Exige um usuário ativo qualquer (admin, marketing ou artista). Diferente de
 * `exigirAdmin`, não restringe por papel — quem chama decide o que cada papel
 * pode fazer (ex.: artista só age sobre o próprio slug). Usado por
 * conectar/desconectar do TikTok, onde o artista autoriza a própria conta.
 */
export async function exigirSessaoAtiva(req: Request): Promise<SessaoAtiva | NextResponse> {
  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let uid: string
  let tokenEmail: string | undefined
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    tokenEmail = decoded.email
  } catch {
    return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 })
  }

  const snap = await adminDb.doc(`users/${uid}`).get()
  const u = snap.data()
  if (!snap.exists || u?.ativo === false) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }
  return {
    uid,
    email: (u?.email as string | undefined) ?? tokenEmail ?? '',
    role: (u?.role as string | undefined) ?? '',
    artistaSlug: (u?.artistaSlug as string | undefined) ?? null,
    permissoes: u?.permissoes as Partial<Record<Capacidade, boolean>> | undefined,
  }
}

export type CronAuth = { cron: true }

/**
 * Autoriza um job automático (Vercel Cron envia `Authorization: Bearer
 * CRON_SECRET`) OU, na ausência do secret correto, cai para `exigirAdmin`
 * (chamada manual pelo painel). O CRON_SECRET não é um JWT válido, então uma
 * tentativa com secret errado simplesmente falha na verificação de admin.
 */
export async function autorizarCronOuAdmin(
  req: Request,
): Promise<AdminAuth | CronAuth | NextResponse> {
  const secret = process.env.CRON_SECRET?.trim()
  const authz = req.headers.get('authorization') ?? ''
  const bearer = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (secret && bearer && bearer === secret) return { cron: true }
  return exigirAdmin(req)
}

/**
 * Exige um usuário ativo COM a capacidade `cap` (override por pessoa ou padrão do
 * papel — ver `@/lib/permissions`). Admin tem todas por padrão; o admin pode
 * conceder uma a um marketing. Retorna NextResponse (erro) ou os dados do usuário.
 */
export async function exigirPermissao(
  req: Request,
  cap: Capacidade,
): Promise<AdminAuth | NextResponse> {
  const sessao = await exigirSessaoAtiva(req)
  if (sessao instanceof NextResponse) return sessao
  if (!temPermissao({ role: sessao.role as Role, permissoes: sessao.permissoes }, cap)) {
    return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 })
  }
  return { uid: sessao.uid, email: sessao.email }
}

/**
 * Como `autorizarCronOuAdmin`, mas o fallback manual exige a capacidade `cap` em
 * vez de admin — pra um membro com a permissão poder disparar a ação pelo painel.
 */
export async function autorizarCronOuPermissao(
  req: Request,
  cap: Capacidade,
): Promise<AdminAuth | CronAuth | NextResponse> {
  const secret = process.env.CRON_SECRET?.trim()
  const authz = req.headers.get('authorization') ?? ''
  const bearer = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (secret && bearer && bearer === secret) return { cron: true }
  return exigirPermissao(req, cap)
}

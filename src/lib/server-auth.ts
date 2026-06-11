import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

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

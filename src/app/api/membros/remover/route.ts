import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

// firebase-admin precisa do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Remove um membro do time de forma DEFINITIVA: apaga a conta no Firebase Auth
 * (o login deixa de existir) e o perfil no Firestore. Só um admin ativo pode chamar.
 *
 * Body: { uid: string }
 */
export async function POST(req: Request) {
  // 1. Autenticação — exige um ID token válido no header.
  const authz = req.headers.get('authorization') ?? ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  let callerUid: string
  try {
    callerUid = (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 })
  }

  // 2. Autorização — só admin ATIVO remove membros.
  const callerSnap = await adminDb.doc(`users/${callerUid}`).get()
  const caller = callerSnap.data()
  if (!callerSnap.exists || caller?.role !== 'admin' || caller?.ativo === false) {
    return NextResponse.json({ error: 'Apenas um admin pode remover membros.' }, { status: 403 })
  }

  // 3. Corpo da requisição.
  let body: { uid?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }
  const { uid } = body
  if (typeof uid !== 'string' || !uid) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // 4. Trava: admin não remove a si mesmo (evita se trancar pra fora).
  if (uid === callerUid) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo do time.' }, { status: 400 })
  }

  // 5. Apaga nas duas pontas: credencial (Auth) + perfil (Firestore).
  try {
    try {
      await adminAuth.deleteUser(uid)
    } catch (e) {
      // Se a conta já não existe no Auth, segue pra apagar o perfil mesmo assim.
      if ((e as { code?: string })?.code !== 'auth/user-not-found') throw e
    }
    await adminDb.doc(`users/${uid}`).delete()
  } catch (e) {
    console.error('[api/membros/remover]', e)
    return NextResponse.json({ error: 'Não foi possível remover o membro.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

// firebase-admin precisa do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ativa/desativa o acesso de um membro do time.
 *
 * Faz a coisa de verdade (não só um flag): desabilita a credencial no Firebase Auth
 * (login bloqueado), revoga as sessões abertas e atualiza o perfil no Firestore.
 * Só um admin ativo pode chamar.
 *
 * Body: { uid: string, ativo: boolean }
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

  // 2. Autorização — só admin ATIVO mexe no acesso dos outros.
  const callerSnap = await adminDb.doc(`users/${callerUid}`).get()
  const caller = callerSnap.data()
  if (!callerSnap.exists || caller?.role !== 'admin' || caller?.ativo === false) {
    return NextResponse.json(
      { error: 'Apenas um admin pode alterar o acesso de membros.' },
      { status: 403 }
    )
  }

  // 3. Corpo da requisição.
  let body: { uid?: unknown; ativo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }
  const { uid, ativo } = body
  if (typeof uid !== 'string' || typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // 4. Trava: admin não desativa o próprio acesso (evita se trancar pra fora).
  if (uid === callerUid && ativo === false) {
    return NextResponse.json(
      { error: 'Você não pode desativar o próprio acesso.' },
      { status: 400 }
    )
  }

  // 5. Aplica nas duas pontas: credencial (Auth) + perfil (Firestore).
  try {
    await adminAuth.updateUser(uid, { disabled: !ativo })
    if (!ativo) {
      // Derruba sessões já abertas imediatamente (invalida os refresh tokens).
      await adminAuth.revokeRefreshTokens(uid)
    }
    await adminDb.doc(`users/${uid}`).update({ ativo })
  } catch (e) {
    console.error('[api/membros/ativo]', e)
    return NextResponse.json({ error: 'Não foi possível alterar o acesso.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

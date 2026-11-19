import { NextResponse } from 'next/server'
import { statusContratoValido, type StatusContrato } from '@/lib/contratos/tipos'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const auth = await exigirPermissao(req, 'contratos')
    if (auth instanceof NextResponse) return auth

    // A consulta lê apenas os documentos de acompanhamento já preenchidos.
    const snap = await adminDb.collectionGroup('acompanhamentoContratual').select('status').get()
    const statusPorSlug = new Map<string, StatusContrato>()

    for (const doc of snap.docs) {
      const partes = doc.ref.path.split('/')
      if (partes.length !== 4 || partes[0] !== 'projetos' || doc.id !== 'status') continue

      const status: unknown = doc.data().status
      if (statusContratoValido(status)) statusPorSlug.set(partes[1], status)
    }

    return NextResponse.json(
      { statusPorSlug: Object.fromEntries(statusPorSlug) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (e) {
    console.error('[contratos/status] GET', e)
    return NextResponse.json({ error: 'Não foi possível carregar os status dos contratos.' }, { status: 500 })
  }
}

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'
import { renderizar, valoresAutomaticos } from '@/lib/contratos/modelo'
import type { Contrato } from '@/lib/contratos/tipos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * A contra-assinatura da Imagine — o segundo lado do contrato gerado.
 *
 * Passa por rota, e não pelo client, pelo mesmo motivo de `api/artistas/dossie`:
 * **a data, o IP e o hash são carimbo do servidor**. Se viessem no corpo do
 * pedido, qualquer um assinaria com a data que quisesse e com o hash de um texto
 * que não é o do documento.
 *
 * O texto é renderizado AQUI, do snapshot gravado no contrato, e não vem do
 * navegador: o que se assina é o que está no banco.
 *
 * Exige a capacidade `contratos` (admin por padrão, marketing fechado) — a mesma
 * fronteira da regra de `projetos/{slug}/contratos`.
 */

const MAX_IMAGEM = 200_000
const MAX_NOME = 200

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'contratos')
  if (auth instanceof NextResponse) return auth

  let corpo: Record<string, unknown>
  try {
    corpo = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const slug = typeof corpo.slug === 'string' ? corpo.slug : ''
  const contratoId = typeof corpo.contratoId === 'string' ? corpo.contratoId : ''
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim().slice(0, MAX_NOME) : ''
  const documento =
    typeof corpo.documento === 'string' ? corpo.documento.trim().slice(0, MAX_NOME) : ''
  const imagem = typeof corpo.imagem === 'string' ? corpo.imagem : ''

  if (!slug || !contratoId) return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  if (!nome) return NextResponse.json({ error: 'Informe quem está assinando.' }, { status: 400 })
  if (!imagem.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 })
  }
  if (imagem.length > MAX_IMAGEM) {
    return NextResponse.json({ error: 'A assinatura ficou grande demais.' }, { status: 400 })
  }

  try {
    const ref = adminDb.doc(`projetos/${slug}/contratos/${contratoId}`)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    const c = { id: snap.id, ...(snap.data() as Omit<Contrato, 'id'>) }

    if (c.origem !== 'gerado') {
      return NextResponse.json(
        { error: 'Este contrato é um anexo — não há texto do painel para assinar.' },
        { status: 400 },
      )
    }
    // A Imagine assina DEPOIS do artista: contra-assinar um contrato que o
    // artista ainda não aceitou registraria um acordo que não houve.
    if (!c.assinaturaArtista) {
      return NextResponse.json({ error: 'O artista ainda não assinou.' }, { status: 409 })
    }
    if (c.assinaturaImagine) {
      return NextResponse.json({ error: 'Este contrato já foi assinado pela Imagine.' }, { status: 409 })
    }

    const artista = await adminDb.doc(`artistas/${slug}`).get()
    const artistaNome =
      typeof artista.data()?.nome === 'string' ? (artista.data()?.nome as string) : slug

    const texto = renderizar(c.textoModelo ?? '', {
      ...valoresAutomaticos({
        artistaNome,
        inicio: c.inicio ?? null,
        fim: c.fim ?? null,
        percentual: c.percentual ?? null,
        dataDocumento: c.emitidoEm ?? null,
      }),
      ...(c.valores ?? {}),
    })

    const em = new Date().toISOString()
    await ref.set(
      {
        assinaturaImagine: {
          nome,
          documento: documento || null,
          imagem,
          em,
          ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
          agente: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
          hash: createHash('sha256').update(texto, 'utf8').digest('hex'),
          // Quem do time assinou — só existe deste lado, porque do outro não há
          // login nenhum.
          porUid: auth.uid,
        },
        atualizadoEm: em,
      },
      { merge: true },
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[contratos/assinar] POST', e)
    return NextResponse.json({ error: 'Falha ao registrar a assinatura.' }, { status: 500 })
  }
}

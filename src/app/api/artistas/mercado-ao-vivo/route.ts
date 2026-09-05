import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'
import { nivelMercadoAoVivo } from '@/lib/iaos/ige'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Declaração de **Mercado ao Vivo** (componente de 10% do IGE, IAOS-DOC-02 v1.2).
 *
 * A equipe escolhe uma das seis descrições padronizadas; o score vem da tabela
 * oficial e NUNCA do cliente — quem declara não digita nota. A metodologia exige
 * guardar nível, score, data e responsável, então gravamos os quatro.
 *
 * Mora em `projetos/{slug}`, não em `artistas/{slug}`, pelo mesmo motivo das
 * anotações da equipe: o artista lê o próprio `artistas/{slug}` no portal, e o
 * nível 0 desta tabela é literalmente "mercado praticamente inativo". Regra de
 * documento não esconde campo — só separar resolve.
 *
 * Exige `editarArtistas`: quem mantém o cadastro do artista declara o mercado dele.
 */

const slugValido = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s.trim())

/** Data da avaliação em 'YYYY-MM-DD'; qualquer outra coisa é descartada. */
const dataValida = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null

/** Observação livre da equipe — o quarto subcampo que a metodologia pede. */
const observacaoLimpa = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : null

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  let body: { slug?: unknown; nivel?: unknown; avaliadoEm?: unknown; observacao?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  if (!slugValido(body.slug)) {
    return NextResponse.json({ error: 'Artista inválido.' }, { status: 400 })
  }
  const slug = body.slug.trim()

  const nivel = Number(body.nivel)
  const tabela = Number.isInteger(nivel) ? nivelMercadoAoVivo(nivel) : null
  if (!tabela) {
    return NextResponse.json({ error: 'Nível de mercado ao vivo inválido.' }, { status: 400 })
  }

  // O artista precisa existir — sem isto um slug errado criaria um projeto órfão.
  const artista = await adminDb.doc(`artistas/${slug}`).get()
  if (!artista.exists) {
    return NextResponse.json({ error: 'Artista não encontrado.' }, { status: 404 })
  }

  await adminDb.doc(`projetos/${slug}`).set(
    {
      slug,
      mercadoAoVivo: {
        nivel: tabela.nivel,
        score: tabela.score,
        // `declaradoEm` é quando o registro foi feito; `avaliadoEm` é quando a
        // equipe de fato avaliou o mercado. Costumam divergir — a avaliação sai
        // de uma reunião e é digitada dias depois —, e a metodologia pede a
        // DATA DA AVALIAÇÃO. Sem o campo próprio, a única data guardada era a
        // do digitador.
        declaradoEm: new Date().toISOString(),
        avaliadoEm: dataValida(body.avaliadoEm) ?? new Date().toISOString().slice(0, 10),
        observacao: observacaoLimpa(body.observacao),
        declaradoPor: auth.uid,
        declaradoPorEmail: auth.email ?? null,
        metodologia: 'IAOS-DOC-02 v1.2',
      },
    },
    { merge: true },
  )

  return NextResponse.json({ ok: true, nivel: tabela.nivel, score: tabela.score })
}

/** Desfaz a declaração (volta a ND). O IGE perde os 10% e a cobertura cai. */
export async function DELETE(req: Request) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  let body: { slug?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }
  if (!slugValido(body.slug)) {
    return NextResponse.json({ error: 'Artista inválido.' }, { status: 400 })
  }
  const alvo = body.slug.trim()

  // Mesma conferência do POST: `set(..., { merge: true })` CRIA o documento
  // quando ele não existe, então desfazer a declaração de um slug inventado
  // deixava para trás um `projetos/{slug}` órfão, de um artista que nunca houve.
  const artista = await adminDb.doc(`artistas/${alvo}`).get()
  if (!artista.exists) {
    return NextResponse.json({ error: 'Artista não encontrado.' }, { status: 404 })
  }

  await adminDb
    .doc(`projetos/${alvo}`)
    .set({ mercadoAoVivo: admin.firestore.FieldValue.delete() }, { merge: true })

  return NextResponse.json({ ok: true })
}

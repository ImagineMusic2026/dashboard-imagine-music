import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'

// firebase-admin precisa do runtime Node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cadastro MANUAL de fonograma — `catalogo-faixas/{isrc}`.
 *
 * Existe porque o catálogo oficial da OneRPM chegou incompleto: das 1.136 faixas
 * conhecidas, boa parte só tem dono porque o relatório de streaming denunciou o
 * ISRC, e o que nunca tocou não aparece em lugar nenhum. Esta rota é como a
 * equipe registra o que falta.
 *
 * Passa por rota (Admin SDK) e não pelo client de propósito: a MESMA coleção é o
 * cache ISRC→título de que a análise de streaming depende. Doc mal formado ali
 * quebra aquela tela, então a gravação é validada e restrita aos campos abaixo —
 * `fonte`, `artista` e `naoEncontrado` (do pipeline da OneRPM/Deezer) não são
 * aceitos do cliente.
 *
 * Exige `editarArtistas`: quem mantém o cadastro do artista mantém a obra dele.
 */

const CAMPO_MAX = 200

const isrcValido = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9]{12}$/.test(s.trim())

/** Texto opcional: apara, corta no limite e vira null quando vazio. */
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, CAMPO_MAX) : null
}

/** Só aceita data 'YYYY-MM-DD' — é assim que o catálogo grava e o card ordena. */
function data(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null
}

function link(v: unknown): string | null {
  const s = texto(v)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}

/**
 * Recarimba `artistas/{slug}.fonogramas`. O contador existe pra tela do catálogo
 * ler a cobertura de todos os artistas sem varrer o catálogo (ver a nota em
 * `ArtistaDoc.fonogramas`); se ele não for atualizado aqui, o número mente
 * assim que alguém cadastra ou remove uma faixa à mão.
 *
 * `count()` é agregação do Firestore — custa uma leitura, não uma por faixa.
 * Falha aqui não derruba a operação: a faixa já foi gravada, e o próximo
 * `atribuir-fonogramas.mjs` reconcilia o número.
 */
async function recontar(slug: string): Promise<void> {
  try {
    const agg = await adminDb
      .collection('catalogo-faixas')
      .where('artistaSlug', '==', slug)
      .count()
      .get()
    await adminDb
      .collection('artistas')
      .doc(slug)
      .set({ fonogramas: agg.data().count }, { merge: true })
  } catch {
    /* contador é conveniência: não vale falhar o cadastro por causa dele */
  }
}

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const isrc = isrcValido(body.isrc) ? (body.isrc as string).trim().toUpperCase() : null
  if (!isrc) {
    return NextResponse.json(
      { error: 'ISRC inválido — são 12 caracteres, como BKU822500012.' },
      { status: 400 },
    )
  }
  const slug = texto(body.slug)
  if (!slug) return NextResponse.json({ error: 'Artista não informado.' }, { status: 400 })

  const titulo = texto(body.titulo)
  if (!titulo) return NextResponse.json({ error: 'Informe o título da faixa.' }, { status: 400 })

  // O artista tem de existir: sem isto um slug digitado errado cria faixa órfã
  // que não aparece em perfil nenhum e ninguém descobre.
  const artista = await adminDb.collection('artistas').doc(slug).get()
  if (!artista.exists) {
    return NextResponse.json({ error: 'Artista não encontrado.' }, { status: 404 })
  }

  const ref = adminDb.collection('catalogo-faixas').doc(isrc)
  const atual = await ref.get()
  const dono = atual.exists ? (atual.data()?.artistaSlug as string | undefined) : undefined
  if (dono && dono !== slug) {
    return NextResponse.json(
      { error: `Este ISRC já está cadastrado para outro artista (${dono}).` },
      { status: 409 },
    )
  }

  await ref.set(
    {
      isrc,
      titulo,
      album: texto(body.album),
      upc: texto(body.upc),
      releaseDate: data(body.releaseDate),
      link: link(body.link),
      artistaSlug: slug,
      artistaSlugs: [slug],
      // Doc que já veio do catálogo/streaming e a equipe corrigiu segue com a
      // procedência original — 'manual' é só para o que a equipe criou do zero.
      atribuicao: atual.exists ? (atual.data()?.atribuicao ?? 'manual') : 'manual',
      naoEncontrado: false,
      atualizadoEm: new Date().toISOString(),
    },
    { merge: true },
  )

  await recontar(slug)
  return NextResponse.json({ ok: true, isrc })
}

export async function DELETE(req: Request) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const isrc = isrcValido(body.isrc) ? (body.isrc as string).trim().toUpperCase() : null
  if (!isrc) return NextResponse.json({ error: 'ISRC inválido.' }, { status: 400 })

  const ref = adminDb.collection('catalogo-faixas').doc(isrc)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ ok: true })

  // Faixa vinda da OneRPM não se apaga: o doc é o cache ISRC→título da análise de
  // streaming, e o próximo sync a recriaria de qualquer forma. Só solta o vínculo
  // com o artista — é isso que "remover do perfil" significa aqui.
  const dono = snap.data()?.artistaSlug as string | undefined

  if (snap.data()?.atribuicao !== 'manual') {
    await ref.set({ artistaSlug: null, artistaSlugs: [] }, { merge: true })
  } else {
    await ref.delete()
  }
  if (dono) await recontar(dono)
  return NextResponse.json({ ok: true })
}

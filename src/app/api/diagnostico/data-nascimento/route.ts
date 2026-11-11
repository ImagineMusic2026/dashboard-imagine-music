import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { PERGUNTA_DATA_NASCIMENTO } from '@/lib/artistas/aniversario'
import { copiarDataNascimentoDoQuestionario } from '@/lib/artistas/data-nascimento-servidor'
import { exigirSessaoAtiva, sessaoPode } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Leva a data de nascimento do questionário Artista, depois de ENVIADO, para o
 * cadastro — onde o alerta de aniversário a lê. O formulário chama esta rota logo
 * após um envio que gravou, no portal e no painel. O link público não passa por
 * aqui: a própria `/api/questionario-link` faz a cópia ao receber o envio.
 *
 * Quem pode, no mesmo desenho de conectar o TikTok:
 *  - Artista (portal): só o próprio slug, que vem da SESSÃO — o corpo é ignorado.
 *  - Equipe com `editarArtistas` (quem preenche o questionário pelo painel):
 *    qualquer artista, pelo `slug` do corpo.
 *
 * A data NUNCA vem do corpo. A rota relê o questionário gravado e copia a resposta
 * de lá: assim o artista não grava no cadastro uma data que não respondeu, e o que
 * vai para o cadastro é exatamente o que a equipe lê no questionário. O que fazer
 * com a data atual (gravar, manter a da equipe) é de `copiarDataNascimentoDoQuestionario`.
 */

const slugValido = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s.trim())

export async function POST(req: Request) {
  const sessao = await exigirSessaoAtiva(req)
  if (sessao instanceof NextResponse) return sessao

  let slug: string
  if (sessao.role === 'artista') {
    if (!slugValido(sessao.artistaSlug)) {
      return NextResponse.json({ error: 'Seu login não está vinculado a um artista.' }, { status: 400 })
    }
    slug = sessao.artistaSlug.trim()
  } else {
    if (!sessaoPode(sessao, 'editarArtistas')) {
      return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 })
    }
    let body: { slug?: unknown } | null
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }
    const doCorpo = body?.slug
    if (!slugValido(doCorpo)) {
      return NextResponse.json({ error: 'Artista inválido.' }, { status: 400 })
    }
    slug = doCorpo.trim()
  }

  try {
    const diag = await adminDb.doc(`diagnosticos/${slug}/questionarios/artista`).get()
    if (!diag.exists) {
      return NextResponse.json({ error: 'Questionário não encontrado.' }, { status: 404 })
    }
    const d = diag.data()
    // Só o questionário ENVIADO vale: rascunho é resposta que o artista ainda pode
    // estar escrevendo, e o cadastro não deve mudar a cada pausa do autosave.
    if (d?.status !== 'enviado') {
      return NextResponse.json({ error: 'O questionário ainda não foi enviado.' }, { status: 409 })
    }
    const respostas = (d?.respostas ?? {}) as Record<string, unknown>
    const resultado = await copiarDataNascimentoDoQuestionario(slug, respostas[PERGUNTA_DATA_NASCIMENTO])
    return NextResponse.json({ resultado })
  } catch (e) {
    console.error('[api/diagnostico/data-nascimento]', e)
    return NextResponse.json({ error: 'Não foi possível levar a data ao cadastro.' }, { status: 500 })
  }
}

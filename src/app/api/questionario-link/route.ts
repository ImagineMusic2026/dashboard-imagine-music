import { NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { PERGUNTA_DATA_NASCIMENTO } from '@/lib/artistas/aniversario'
import { copiarDataNascimentoDoQuestionario } from '@/lib/artistas/data-nascimento-servidor'
import { ehTipoValido, limparRespostas, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Preenchimento do questionário de estruturação por LINK PÚBLICO — sem login.
 * Existe porque a equipe quer colher as respostas do artista (ou do empresário)
 * ANTES de liberar o acesso ao portal: gera o link no perfil do artista e manda
 * por WhatsApp; a pessoa responde e cai no MESMO doc que o painel/portal usam.
 *
 * A "sessão" é o token (UUID em `links-questionario/{token}`, criado pela equipe):
 * quem tem o link edita aquele questionário e nada mais. Revogar = apagar o doc —
 * o GET passa a responder 404 e o autosave da página aberta começa a falhar.
 *
 * É a ÚNICA rota sem guarda de auth que escreve no Firestore, e por isso ela é
 * estreita de propósito: só as chaves conhecidas do questionário (`limparRespostas`
 * descarta o resto), só `origem: 'artista'` (pro card e pro alerta é a pessoa
 * respondendo, não a equipe), e nunca toca `arquivoUrl` (anexo interno da equipe).
 *
 * Fora do questionário ela escreve UMA coisa: no envio do questionário Artista, a
 * data de nascimento vai para o cadastro (`artistas/{slug}`), sempre pela política de
 * `copiarDataNascimentoDoQuestionario` — nunca apaga e não passa por cima da data
 * que a equipe digitou. A resposta do POST é a mesma de qualquer jeito: quem tem o
 * link não fica sabendo o que o cadastro já dizia.
 */

type LinkDoc = { slug: string; tipo: TipoDiagnostico }

async function lerLink(token: string | null): Promise<LinkDoc | null> {
  const t = (token ?? '').trim()
  // Token é sempre um UUID nosso — qualquer outra coisa nem vai ao Firestore.
  if (!/^[0-9a-f-]{36}$/i.test(t)) return null
  const snap = await adminDb.doc(`links-questionario/${t}`).get()
  const x = snap.data()
  if (!snap.exists || typeof x?.slug !== 'string' || !ehTipoValido(String(x?.tipo))) return null
  return { slug: x.slug, tipo: x.tipo as TipoDiagnostico }
}

// Função, não constante: uma NextResponse só pode ser ENVIADA uma vez (o corpo é
// um stream). Compartilhar a mesma instância entre requisições quebra a partir da
// segunda resposta na mesma instância do servidor.
const linkInvalido = () =>
  NextResponse.json(
    { error: 'Este link não está mais ativo. Peça um novo à equipe da Imagine.' },
    { status: 404 }
  )

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  try {
    const link = await lerLink(token)
    if (!link) return linkInvalido()

    const [artista, diag] = await Promise.all([
      adminDb.doc(`artistas/${link.slug}`).get(),
      adminDb.doc(`diagnosticos/${link.slug}/questionarios/${link.tipo}`).get(),
    ])
    const d = diag.data()
    // Só o que a pessoa precisa pra responder — sem slug, sem `arquivoUrl` (anexo
    // interno da equipe), sem nada do resto do painel.
    return NextResponse.json({
      tipo: link.tipo,
      artistaNome: (artista.data()?.nome as string | undefined) ?? link.slug,
      respostas: (d?.respostas as Record<string, string> | undefined) ?? {},
      status: d?.status === 'enviado' ? 'enviado' : 'rascunho',
      origem: d?.origem === 'equipe' ? 'equipe' : 'artista',
    })
  } catch (e) {
    console.error('[api/questionario-link GET]', e)
    return NextResponse.json({ error: 'Não foi possível carregar o questionário.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: { token?: string; respostas?: unknown; enviar?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  try {
    const link = await lerLink(body.token ?? null)
    if (!link) return linkInvalido()

    const brutas =
      body.respostas && typeof body.respostas === 'object' && !Array.isArray(body.respostas)
        ? (body.respostas as Record<string, string>)
        : {}
    const enviar = body.enviar === true
    const agora = admin.firestore.FieldValue.serverTimestamp()
    const respostas = limparRespostas(link.tipo, brutas)

    // Mesmo shape do save do portal (ver `salvarDiagnostico`): merge porque o
    // autosave manda o form inteiro a cada pausa, e `enviadoEm` não pode sumir num
    // rascunho posterior. Quem responde pelo link consta como o artista — é a
    // pessoa do projeto respondendo, não a equipe — e é isso que dispara o alerta
    // de "respondeu o questionário" pra equipe.
    const dados: Record<string, unknown> = {
      slug: link.slug,
      tipo: link.tipo,
      respostas,
      origem: 'artista',
      status: enviar ? 'enviado' : 'rascunho',
      atualizadoEm: agora,
    }
    if (enviar) dados.enviadoEm = agora

    const ref = adminDb.doc(`diagnosticos/${link.slug}/questionarios/${link.tipo}`)
    await ref.set(dados, { merge: true })

    // A data de nascimento vai para o cadastro só no ENVIO (rascunho é resposta que
    // ainda pode mudar) e depois de as respostas estarem gravadas. Copia do que ficou
    // GRAVADO, e não do corpo deste pedido: o merge preserva a data que já estava no
    // questionário quando o formulário desta aba não a trazia (aberto antes de ela ser
    // respondida em outro lugar) — o mesmo que a rota do portal e do painel faz.
    // Melhor esforço: as respostas já estão salvas, e falhar aqui não pode virar erro
    // pra quem respondeu.
    if (enviar && link.tipo === 'artista') {
      try {
        const gravado = (await ref.get()).data()?.respostas as Record<string, unknown> | undefined
        await copiarDataNascimentoDoQuestionario(link.slug, gravado?.[PERGUNTA_DATA_NASCIMENTO])
      } catch (e) {
        console.error('[api/questionario-link POST] data de nascimento → cadastro', e)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/questionario-link POST]', e)
    return NextResponse.json({ error: 'Não foi possível salvar as respostas.' }, { status: 500 })
  }
}

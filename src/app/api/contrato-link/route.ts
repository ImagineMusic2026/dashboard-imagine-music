import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { limparValores, renderizar, valoresAutomaticos, camposDe } from '@/lib/contratos/modelo'
import {
  tipoContratoMeta,
  type CampoContrato,
  type Contrato,
  type TipoContrato,
} from '@/lib/contratos/tipos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Assinatura de contrato por LINK PÚBLICO — sem login.
 *
 * É a segunda rota sem guarda de auth que escreve no Firestore (a primeira é a
 * do questionário), e por isso é estreita pelo mesmo princípio: a "sessão" é o
 * token (`links-contrato/{token}`, criado pela equipe), e o que ela aceita
 * escrever é só o que o modelo DAQUELE contrato declarou como campo do artista.
 * Revogar o link = apagar o doc; o GET passa a responder 404.
 *
 * Um aviso que vale repetir, porque é o que sustenta tudo aqui: **regra do
 * Firestore não roda no Admin SDK**. A validação escrita neste arquivo é a
 * ÚNICA que existe neste caminho.
 *
 * O que o servidor carimba, e o navegador nunca manda:
 *
 * - `em` (data da assinatura), `ip` e `agente`;
 * - o `hash` SHA-256 do texto renderizado AQUI, com os valores que acabaram de
 *   ser gravados. É o que prova depois que o documento não mudou — e é por isso
 *   que o GET manda os `valoresBase` prontos: a página renderiza exatamente o
 *   mesmo texto que vai ser hasheado, sem recalcular data nem fuso.
 *
 * `slug` e `contratoId` vêm do doc do LINK, nunca do corpo do pedido — senão
 * quem tem um link assinaria no contrato alheio.
 */

/** Teto da imagem da assinatura. Um traço de canvas dá uns 10–30 KB em PNG. */
const MAX_IMAGEM = 200_000
const MAX_NOME = 200

type LinkDoc = { slug: string; contratoId: string }

async function lerLink(token: string | null): Promise<LinkDoc | null> {
  const t = (token ?? '').trim()
  // Token é sempre um UUID nosso — qualquer outra coisa nem vai ao Firestore.
  if (!/^[0-9a-f-]{36}$/i.test(t)) return null
  const snap = await adminDb.doc(`links-contrato/${t}`).get()
  const x = snap.data()
  if (!snap.exists || typeof x?.slug !== 'string' || typeof x?.contratoId !== 'string') return null
  return { slug: x.slug, contratoId: x.contratoId }
}

async function lerContrato(link: LinkDoc): Promise<Contrato | null> {
  const snap = await adminDb.doc(`projetos/${link.slug}/contratos/${link.contratoId}`).get()
  if (!snap.exists) return null
  const c = { id: snap.id, ...(snap.data() as Omit<Contrato, 'id'>) }
  // Contrato anexado não tem texto nem campos: não há o que assinar aqui.
  return c.origem === 'gerado' ? c : null
}

async function lerNomeDoArtista(slug: string): Promise<string> {
  const snap = await adminDb.doc(`artistas/${slug}`).get()
  const nome = snap.data()?.nome
  return typeof nome === 'string' && nome.trim() ? nome : slug
}

// Função, não constante: uma NextResponse só pode ser ENVIADA uma vez (o corpo é
// um stream). Compartilhar a mesma instância entre requisições quebra a partir da
// segunda resposta na mesma instância do servidor.
const linkInvalido = () =>
  NextResponse.json(
    { error: 'Este link não está mais ativo. Peça um novo à equipe da Imagine.' },
    { status: 404 },
  )

const recusa = (error: string, status = 400) => NextResponse.json({ error }, { status })

/** Automáticas + o que a equipe preencheu — a base que o artista completa. */
function valoresBaseDe(c: Contrato, artistaNome: string): Record<string, string> {
  return {
    ...valoresAutomaticos({
      artistaNome,
      inicio: c.inicio ?? null,
      fim: c.fim ?? null,
      percentual: c.percentual ?? null,
      dataDocumento: c.emitidoEm ?? null,
    }),
    ...(c.valores ?? {}),
  }
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  try {
    const link = await lerLink(token)
    if (!link) return linkInvalido()

    const [contrato, artistaNome] = await Promise.all([
      lerContrato(link),
      lerNomeDoArtista(link.slug),
    ])
    if (!contrato) return linkInvalido()

    const campos = (contrato.campos ?? []) as CampoContrato[]
    // Projeção estreita: nada de `slug`, `contratoId`, observações internas ou
    // o `arquivoUrl` da equipe. Só o que é preciso pra ler e assinar.
    return NextResponse.json({
      artistaNome,
      modeloNome: contrato.modeloNome ?? 'Contrato',
      tipoLabel: tipoContratoMeta[contrato.tipo as TipoContrato]?.label ?? 'Contrato',
      texto: contrato.textoModelo ?? '',
      valoresBase: valoresBaseDe(contrato, artistaNome),
      campos: camposDe(campos, 'artista'),
      vigencia: { inicio: contrato.inicio, fim: contrato.fim ?? null },
      assinado: !!contrato.assinaturaArtista,
      assinadoEm: contrato.assinaturaArtista?.em ?? null,
      // As assinaturas voltam pra quem tem o link: é o contrato dele, e sem
      // elas não dá pra levar a própria via assinada.
      assinaturas: {
        artista: contrato.assinaturaArtista ?? null,
        imagine: contrato.assinaturaImagine ?? null,
      },
      emitidoEm: contrato.emitidoEm ?? null,
    })
  } catch (e) {
    console.error('[contrato-link] GET', e)
    return NextResponse.json({ error: 'Falha ao carregar o contrato.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let corpo: Record<string, unknown>
  try {
    corpo = (await req.json()) as Record<string, unknown>
  } catch {
    return recusa('Envio inválido.')
  }

  const token = typeof corpo.token === 'string' ? corpo.token : null
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim().slice(0, MAX_NOME) : ''
  const documento =
    typeof corpo.documento === 'string' ? corpo.documento.trim().slice(0, MAX_NOME) : ''
  const imagem = typeof corpo.imagem === 'string' ? corpo.imagem : ''

  try {
    const link = await lerLink(token)
    if (!link) return linkInvalido()

    const contrato = await lerContrato(link)
    if (!contrato) return linkInvalido()

    // O link vale por UMA assinatura. Sem isto, reenviar sobrescreveria a
    // assinatura anterior — com outro traço, outra data e outro hash.
    if (contrato.assinaturaArtista) {
      return recusa('Este contrato já foi assinado.', 409)
    }

    if (corpo.aceite !== true) return recusa('É preciso aceitar os termos para assinar.')
    if (!nome) return recusa('Informe o seu nome completo.')
    if (!imagem.startsWith('data:image/png;base64,')) return recusa('Assinatura inválida.')
    if (imagem.length > MAX_IMAGEM) return recusa('A assinatura ficou grande demais.')

    const campos = (contrato.campos ?? []) as CampoContrato[]
    // Só as chaves que o modelo declarou como do ARTISTA. O resto é descartado
    // em silêncio, como `limparRespostas` faz no questionário.
    const novos = limparValores(campos, corpo.valores, 'artista')
    const faltando = camposDe(campos, 'artista')
      .filter((c) => c.obrigatorio && !novos[c.chave])
      .map((c) => c.rotulo)
    if (faltando.length) return recusa(`Falta preencher: ${faltando.join(', ')}.`)

    const artistaNome = await lerNomeDoArtista(link.slug)
    const valores = { ...(contrato.valores ?? {}), ...novos }
    const texto = renderizar(contrato.textoModelo ?? '', {
      ...valoresBaseDe(contrato, artistaNome),
      ...novos,
    })

    const em = new Date().toISOString()
    await adminDb.doc(`projetos/${link.slug}/contratos/${link.contratoId}`).set(
      {
        valores,
        assinaturaArtista: {
          nome,
          documento: documento || null,
          imagem,
          em,
          // `x-forwarded-for` pode vir com a cadeia inteira; o primeiro é o
          // cliente. É registro de auditoria, não controle de acesso.
          ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
          agente: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
          hash: createHash('sha256').update(texto, 'utf8').digest('hex'),
        },
        atualizadoEm: em,
      },
      { merge: true },
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[contrato-link] POST', e)
    return NextResponse.json({ error: 'Falha ao registrar a assinatura.' }, { status: 500 })
  }
}

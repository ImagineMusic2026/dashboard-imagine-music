import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'
import { consultarArtista } from '@/lib/soundcharts/consultar'
import { SoundchartsConfigError, SoundchartsError, soundchartsConfigurado } from '@/lib/soundcharts/mcp'

// fetch + Buffer: precisa do runtime Node, não do Edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Props {
  params: { slug: string }
}

/**
 * Consulta a Soundcharts para UM artista, sob demanda.
 *
 * É POST porque gasta cota da assinatura da Imagine (10 mil requisições/mês do
 * time) e grava — não é uma leitura idempotente que um prefetch possa disparar
 * sozinho. Cada clique custa ~4 requisições.
 *
 * Exige `editarArtistas`: quem consulta está atualizando o cadastro do artista,
 * e o resultado alimenta o Estágio, que é leitura interna da equipe.
 */
export async function POST(req: Request, { params }: Props) {
  const auth = await exigirPermissao(req, 'editarArtistas')
  if (auth instanceof NextResponse) return auth

  if (!soundchartsConfigurado()) {
    return NextResponse.json(
      {
        error:
          'Soundcharts não configurado no servidor. Defina SOUNDCHARTS_CLIENT_ID, SOUNDCHARTS_CLIENT_SECRET e SOUNDCHARTS_TEAM.',
      },
      { status: 503 },
    )
  }

  const slug = params.slug
  try {
    const [artistaSnap, metricasSnap] = await Promise.all([
      adminDb.doc(`artistas/${slug}`).get(),
      adminDb.doc(`metricas-sociais/${slug}`).get(),
    ])
    if (!artistaSnap.exists) {
      return NextResponse.json({ error: 'Artista não encontrado.' }, { status: 404 })
    }

    const artista = artistaSnap.data() ?? {}
    const metricas = metricasSnap.exists ? (metricasSnap.data() ?? {}) : {}
    const analytics = metricas.youtube?.analytics ?? null

    const snap = await consultarArtista({
      slug,
      nome: artista.nome ?? artista.nomeArtistico ?? slug,
      spotifyId: artista.redes?.spotify?.id ?? null,
      youtubeViews: analytics?.views ?? null,
      youtubeDias: analytics?.periodoDias ?? null,
    })

    // `projetos/{slug}`, não `metricas-sociais/{slug}`: o segundo é legível pelo
    // próprio artista no portal, e isto carrega o estágio de carreira que a
    // Soundcharts atribui. Julgamento de porte é leitura da equipe.
    // `merge` para não derrubar mercado ao vivo, dossiê e cadastro comercial.
    await adminDb.doc(`projetos/${slug}`).set({ slug, soundcharts: snap }, { merge: true })
    return NextResponse.json({ ok: true, soundcharts: snap })
  } catch (e) {
    // Mensagem real na resposta: um "falhou" genérico aqui esconderia a diferença
    // entre credencial ausente, artista não encontrado e a Soundcharts fora do ar.
    if (e instanceof SoundchartsConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    const msg =
      e instanceof SoundchartsError
        ? e.message
        : e instanceof Error && e.message
          ? `Falha ao consultar a Soundcharts: ${e.message}`
          : 'Falha ao consultar a Soundcharts.'
    console.error('[api/artistas/[slug]/soundcharts]', e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

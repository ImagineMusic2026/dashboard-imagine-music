import { NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/server-auth'
import { youtubeDataConfigurado, YouTubeConfigError } from '@/lib/youtube/config'
import { YouTubeApiException } from '@/lib/youtube/client'
import { resolverChannelId } from '@/lib/youtube/channel'
import {
  gravarStatusYouTube,
  listarArtistasYouTube,
  salvarVinculoYouTube,
} from '@/lib/metricas-sociais/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Descoberta (camada pública): resolve a URL/@handle do YouTube cadastrada em
 * cada artista para um channelId (Data API) e grava em
 * `artistas/{slug}.redes.youtube.id`. Artistas já mapeados são pulados (poupa
 * quota — `search` custa caro). Só admin.
 */
export async function POST(req: Request) {
  const auth = await exigirAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (!youtubeDataConfigurado()) {
    return NextResponse.json(
      { error: 'Camada pública do YouTube não configurada. Defina YOUTUBE_API_KEY no ambiente.' },
      { status: 503 },
    )
  }

  try {
    const artistas = await listarArtistasYouTube()
    const jaMapeados = artistas.filter((a) => a.channelId)
    const aResolver = artistas.filter((a) => !a.channelId && a.handle)

    const resolvidos = await emLotes(aResolver, 3, async (a) => {
      try {
        const channelId = await resolverChannelId(a.handle)
        if (channelId) {
          await salvarVinculoYouTube(a.slug, channelId)
          return { slug: a.slug, channelId }
        }
        return null
      } catch {
        return null
      }
    })

    const novos = resolvidos.filter((r): r is { slug: string; channelId: string } => r !== null)
    const mapeadosTotal = jaMapeados.length + novos.length
    const semCanal = artistas.filter((a) => !a.channelId && !novos.find((n) => n.slug === a.slug))

    await gravarStatusYouTube({
      status: 'conectado',
      canaisMapeados: mapeadosTotal,
      totalArtistas: artistas.length,
      ultimaDescoberta: new Date().toISOString(),
      erro: null,
    })

    return NextResponse.json({
      ok: true,
      totalArtistas: artistas.length,
      mapeados: mapeadosTotal,
      novos: novos.map((n) => n.slug),
      jaMapeados: jaMapeados.length,
      semCanal: semCanal.map((a) => a.slug),
    })
  } catch (e) {
    const msg =
      e instanceof YouTubeApiException || e instanceof YouTubeConfigError
        ? e.message
        : 'Falha ao descobrir canais no YouTube.'
    console.error('[api/integracoes/youtube/descobrir]', e)
    await gravarStatusYouTube({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

async function emLotes<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += limite) {
    out.push(...(await Promise.all(items.slice(i, i + limite).map(fn))))
  }
  return out
}

import { NextResponse } from 'next/server'
import { autorizarCronOuAdmin } from '@/lib/server-auth'
import { youtubeDataConfigurado, YouTubeConfigError } from '@/lib/youtube/config'
import { renovarToken, YouTubeApiException } from '@/lib/youtube/client'
import { buscarMetricasCanal, resolverChannelId } from '@/lib/youtube/channel'
import { buscarAnalytics } from '@/lib/youtube/analytics'
import {
  gravarStatusYouTube,
  listarArtistasYouTube,
  listarTokensYouTube,
  salvarSnapshotYouTube,
  salvarTokenYouTube,
  salvarVinculoYouTube,
} from '@/lib/metricas-sociais/firestore'
import type { YouTubeTokenDoc } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sincroniza o YouTube em 2 camadas: para cada artista com channelId mapeado,
 * coleta as métricas PÚBLICAS (Data API); se o artista também conectou via OAuth
 * (token guardado), anexa a camada ANALYTICS (privada). Grava snapshot +
 * histórico + status. CRON_SECRET (cron, GET) ou admin (POST). `?slug=` limita.
 */
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  const auth = await autorizarCronOuAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (!youtubeDataConfigurado()) {
    return NextResponse.json(
      { error: 'Camada pública do YouTube não configurada (YOUTUBE_API_KEY).' },
      { status: 503 },
    )
  }

  const slugFiltro = new URL(req.url).searchParams.get('slug')

  try {
    const todos = await listarArtistasYouTube()

    // Auto-descoberta: resolve quem tem handle mas ainda não tem channelId (ex.:
    // link recém-trocado pelo "Editar"), pra um sync já pegar o canal certo sem
    // precisar rodar "Descobrir canais" antes.
    const aResolver = todos.filter(
      (a) => !a.channelId && a.handle && (!slugFiltro || a.slug === slugFiltro),
    )
    if (aResolver.length) {
      await emLotes(aResolver, 3, async (a) => {
        try {
          const channelId = await resolverChannelId(a.handle)
          if (channelId) {
            await salvarVinculoYouTube(a.slug, channelId)
            a.channelId = channelId // reflete na lista em memória
          }
        } catch {
          /* segue sem esse canal — o sync apenas o ignora */
        }
      })
    }

    const mapeados = todos.filter((a) => a.channelId)
    const alvos = slugFiltro ? mapeados.filter((a) => a.slug === slugFiltro) : mapeados
    const tokens = await listarTokensYouTube()
    const tokenPorSlug = new Map(tokens.map((t) => [t.slug, t]))
    const dia = new Date().toISOString().slice(0, 10)

    const resultados = await emLotes(alvos, 3, async (a) => {
      try {
        const snap = await buscarMetricasCanal(a.channelId as string)

        const tk = tokenPorSlug.get(a.slug)
        if (tk) {
          try {
            const accessToken = await garantirAccessToken(tk)
            snap.analytics = await buscarAnalytics(accessToken)
            if (!tk.channelId) {
              await salvarTokenYouTube({ ...tk, channelId: a.channelId, atualizadoEm: new Date().toISOString() })
            }
          } catch (e) {
            snap.avisos = [...(snap.avisos ?? []), `analytics: ${mensagem(e)}`]
          }
        } else {
          // Sem token (nunca conectou ou desconectou) -> zera o Analytics, senão um
          // snapshot antigo (de outra conta/canal) fica preso pelo merge.
          snap.analytics = null
        }

        await salvarSnapshotYouTube(a.slug, snap, dia)
        return { slug: a.slug, ok: true as const, comAnalytics: Boolean(snap.analytics) }
      } catch (e) {
        console.error(`[youtube/sincronizar] ${a.slug}:`, e)
        return { slug: a.slug, ok: false as const, erro: mensagem(e) }
      }
    })

    const sincronizados = resultados.filter((r) => r.ok).length
    const erros = resultados.filter((r) => !r.ok) as { slug: string; ok: false; erro: string }[]

    await gravarStatusYouTube({
      status: 'conectado',
      canaisMapeados: mapeados.length,
      contasConectadas: tokens.length,
      totalArtistas: todos.length,
      contasSincronizadas: sincronizados,
      ultimaSincronizacao: new Date().toISOString(),
      erro: erros.length ? `${erros.length} canal(is) falharam na coleta.` : null,
    })

    return NextResponse.json({
      ok: true,
      sincronizados,
      comAnalytics: resultados.filter((r) => r.ok && r.comAnalytics).length,
      falhas: erros.length,
      erros: erros.map((e) => ({ slug: e.slug, erro: e.erro })),
    })
  } catch (e) {
    const msg =
      e instanceof YouTubeApiException || e instanceof YouTubeConfigError
        ? e.message
        : 'Falha ao sincronizar métricas do YouTube.'
    console.error('[api/integracoes/youtube/sincronizar]', e)
    await gravarStatusYouTube({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/** Garante um access token válido (Google expira em ~1h); renova se preciso. */
async function garantirAccessToken(tk: YouTubeTokenDoc): Promise<string> {
  const agora = Date.now()
  const exp = new Date(tk.accessExpiraEm).getTime()
  if (Number.isFinite(exp) && exp - agora > 120_000) return tk.accessToken

  const novo = await renovarToken(tk.refreshToken)
  const ag = Date.now()
  const atualizado: YouTubeTokenDoc = {
    ...tk,
    accessToken: novo.access_token,
    refreshToken: novo.refresh_token || tk.refreshToken,
    accessExpiraEm: new Date(ag + novo.expires_in * 1000).toISOString(),
    scope: novo.scope || tk.scope,
    atualizadoEm: new Date(ag).toISOString(),
  }
  await salvarTokenYouTube(atualizado)
  return atualizado.accessToken
}

async function emLotes<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += limite) {
    out.push(...(await Promise.all(items.slice(i, i + limite).map(fn))))
  }
  return out
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

import { NextResponse } from 'next/server'
import { autorizarCronOuAdmin } from '@/lib/server-auth'
import { tiktokConfigurado, TikTokConfigError } from '@/lib/tiktok/config'
import { renovarToken, TikTokApiException } from '@/lib/tiktok/client'
import { buscarMetricas } from '@/lib/tiktok/insights'
import {
  gravarStatusTikTok,
  listarArtistasTikTok,
  listarTokensTikTok,
  salvarSnapshotTikTok,
  salvarTokenTikTok,
  salvarVinculoTikTok,
} from '@/lib/metricas-sociais/firestore'
import type { TikTokTokenDoc } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sincroniza as métricas do TikTok: para cada artista com token guardado,
 * renova o access token se necessário, coleta as métricas e grava snapshot +
 * ponto de histórico do dia, atualizando `integracoes/tiktok`. Autorizada por
 * CRON_SECRET (Vercel Cron, via GET) OU por um admin (botão, via POST).
 * `?slug=` limita a um artista.
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

  if (!tiktokConfigurado()) {
    return NextResponse.json(
      { error: 'Integração TikTok não configurada (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET).' },
      { status: 503 },
    )
  }

  const slugFiltro = new URL(req.url).searchParams.get('slug')

  try {
    const tokens = await listarTokensTikTok()
    const alvos = slugFiltro ? tokens.filter((t) => t.slug === slugFiltro) : tokens
    const dia = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

    const resultados = await emLotes(alvos, 4, async (t) => {
      try {
        const accessToken = await garantirAccessToken(t)
        const m = await buscarMetricas(accessToken)
        await salvarSnapshotTikTok(t.slug, m, dia)
        if (m.username) await salvarVinculoTikTok(t.slug, m.contaId || t.openId, m.username)
        return { slug: t.slug, ok: true as const }
      } catch (e) {
        return { slug: t.slug, ok: false as const, erro: mensagem(e) }
      }
    })

    const sincronizados = resultados.filter((r) => r.ok).length
    const erros = resultados.filter((r) => !r.ok) as { slug: string; ok: false; erro: string }[]
    const artistas = await listarArtistasTikTok()

    await gravarStatusTikTok({
      status: 'conectado',
      contasConectadas: tokens.length,
      totalArtistas: artistas.length,
      contasSincronizadas: sincronizados,
      ultimaSincronizacao: new Date().toISOString(),
      erro: erros.length ? `${erros.length} conta(s) falharam na coleta.` : null,
    })

    return NextResponse.json({
      ok: true,
      sincronizados,
      falhas: erros.length,
      erros: erros.map((e) => ({ slug: e.slug, erro: e.erro })),
    })
  } catch (e) {
    const msg =
      e instanceof TikTokApiException || e instanceof TikTokConfigError
        ? e.message
        : 'Falha ao sincronizar métricas do TikTok.'
    console.error('[api/integracoes/tiktok/sincronizar]', e)
    await gravarStatusTikTok({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/**
 * Garante um access token válido: usa o atual se ainda tem folga (>2min); senão
 * renova pelo refresh token (que rotaciona) e regrava. Lança se o refresh já
 * expirou — aí o artista precisa reconectar.
 */
async function garantirAccessToken(t: TikTokTokenDoc): Promise<string> {
  const agora = Date.now()
  const accessExpira = new Date(t.accessExpiraEm).getTime()
  if (Number.isFinite(accessExpira) && accessExpira - agora > 120_000) return t.accessToken

  const refreshExpira = new Date(t.refreshExpiraEm).getTime()
  if (Number.isFinite(refreshExpira) && refreshExpira <= agora) {
    throw new Error('Autorização expirada — o artista precisa reconectar o TikTok.')
  }

  const novo = await renovarToken(t.refreshToken)
  const ag = Date.now()
  const atualizado: TikTokTokenDoc = {
    ...t,
    openId: novo.open_id || t.openId,
    accessToken: novo.access_token,
    refreshToken: novo.refresh_token || t.refreshToken,
    accessExpiraEm: new Date(ag + novo.expires_in * 1000).toISOString(),
    refreshExpiraEm: new Date(ag + novo.refresh_expires_in * 1000).toISOString(),
    scope: novo.scope || t.scope,
    atualizadoEm: new Date(ag).toISOString(),
  }
  await salvarTokenTikTok(atualizado)
  return atualizado.accessToken
}

/** Executa `fn` sobre os itens com concorrência limitada (lotes de `limite`). */
async function emLotes<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += limite) {
    const chunk = items.slice(i, i + limite)
    out.push(...(await Promise.all(chunk.map(fn))))
  }
  return out
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

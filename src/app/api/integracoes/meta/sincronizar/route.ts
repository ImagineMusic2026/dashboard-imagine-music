import { NextResponse } from 'next/server'
import { autorizarCronOuAdmin } from '@/lib/server-auth'
import { getMetaConfig, MetaConfigError, metaConfigurado } from '@/lib/meta/config'
import { MetaApiException } from '@/lib/meta/client'
import { buscarMetricas, buscarMidias } from '@/lib/meta/insights'
import {
  gravarStatusMeta,
  listarArtistasInstagram,
  salvarSnapshotInstagram,
} from '@/lib/metricas-sociais/firestore'
import type { InstagramSnapshot } from '@/lib/metricas-sociais/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sincronização das métricas: para cada artista com IG User ID vinculado,
 * coleta as métricas e grava snapshot + ponto de histórico do dia, atualizando
 * o status em `integracoes/meta`. Autorizada por CRON_SECRET (Vercel Cron) OU
 * por um admin (botão "Sincronizar agora"). `?slug=` limita a um artista.
 *
 * O Vercel Cron dispara via GET; o painel usa POST. Ambos passam pela mesma
 * autorização e executam a mesma coleta.
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

  if (!metaConfigurado()) {
    return NextResponse.json(
      { error: 'Integração Meta não configurada (META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN).' },
      { status: 503 },
    )
  }

  const slugFiltro = new URL(req.url).searchParams.get('slug')

  try {
    const mapeados = (await listarArtistasInstagram()).filter((a) => a.igUserId)
    const alvos = slugFiltro ? mapeados.filter((a) => a.slug === slugFiltro) : mapeados
    const dia = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

    const resultados = await emLotes(alvos, 4, async (a) => {
      try {
        const [m, postsRecentes] = await Promise.all([
          buscarMetricas(a.igUserId as string, a.handle ?? a.slug),
          buscarMidias(a.igUserId as string, 12),
        ])
        const snapshot: InstagramSnapshot = {
          contaId: m.contaId,
          username: m.username,
          seguidores: m.seguidores,
          segue: m.segue,
          publicacoes: m.publicacoes,
          alcance: m.alcance,
          visualizacoes: m.visualizacoes,
          visitasPerfil: m.visitasPerfil,
          contasEngajadas: m.contasEngajadas,
          interacoesTotais: m.interacoesTotais,
          janelaDias: m.janelaDias,
          coletadoEm: m.coletadoEm,
          postsRecentes,
        }
        await salvarSnapshotInstagram(a.slug, snapshot, dia)
        return { slug: a.slug, ok: true as const }
      } catch (e) {
        return { slug: a.slug, ok: false as const, erro: mensagem(e) }
      }
    })

    const sincronizados = resultados.filter((r) => r.ok).length
    const erros = resultados.filter((r) => !r.ok) as { slug: string; ok: false; erro: string }[]

    await gravarStatusMeta({
      status: 'conectado',
      contasMapeadas: mapeados.length,
      contasSincronizadas: sincronizados,
      ultimaSincronizacao: new Date().toISOString(),
      erro: erros.length ? `${erros.length} conta(s) falharam na coleta.` : null,
      graphVersion: getMetaConfig().graphVersion,
    })

    return NextResponse.json({
      ok: true,
      sincronizados,
      falhas: erros.length,
      erros: erros.map((e) => ({ slug: e.slug, erro: e.erro })),
    })
  } catch (e) {
    const msg =
      e instanceof MetaApiException || e instanceof MetaConfigError
        ? e.message
        : 'Falha ao sincronizar métricas do Meta.'
    console.error('[api/integracoes/meta/sincronizar]', e)
    await gravarStatusMeta({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
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

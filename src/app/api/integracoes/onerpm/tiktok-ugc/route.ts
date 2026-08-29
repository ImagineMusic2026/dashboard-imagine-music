import { NextResponse } from 'next/server'
import { autorizarCronOuPermissao } from '@/lib/server-auth'
import { gravarStatusTikTokUgc } from '@/lib/metricas-sociais/firestore'
import {
  TikTokUgcConfigError,
  sincronizarTikTokUgc,
  tiktokUgcConfigurado,
} from '@/lib/onerpm/tiktok-ugc-sync'

// ssh2 + firebase-admin precisam do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sincroniza a tração de vídeo do TikTok por faixa (feed `Reports/stats/tiktok`
 * da OneRPM) e grava por artista em `metricas-sociais/{slug}/streaming-detalhe/
 * tiktok-ugc`.
 *
 * Rota SEPARADA do sync de streaming por escolha, não por acaso: o feed novo do
 * TikTok já derrubou o de streaming uma vez (2026-08-29). Falhar aqui não pode
 * levar junto o dado principal.
 *
 * Autorizada por CRON_SECRET (Vercel Cron, GET) OU por quem tem `integracoes`
 * (botão, POST). `?dias=` ajusta quantos arquivos entram na janela.
 */
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  const auth = await autorizarCronOuPermissao(req, 'integracoes')
  if (auth instanceof NextResponse) return auth

  if (!tiktokUgcConfigurado()) {
    return NextResponse.json(
      { error: 'Integração OneRPM não configurada (defina ONERPM_SFTP_KEY e ONERPM_PASSPHRASE).' },
      { status: 503 },
    )
  }

  const param = new URL(req.url).searchParams.get('dias')
  const dias = Number(param || process.env.ONERPM_SYNC_DIAS || 35)

  try {
    const r = await sincronizarTikTokUgc({ dias: Number.isFinite(dias) ? dias : 35 })

    await gravarStatusTikTokUgc({
      status: 'conectado',
      artistasSincronizados: r.gravados,
      arquivos: r.arquivos,
      viewsJanela: r.views,
      janelaDias: Number.isFinite(dias) ? dias : 35,
      ultimaSincronizacao: new Date().toISOString(),
      ultimoDia: r.periodo.ate || null,
      erro: null,
    })

    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    // Mensagem real no status — o erro genérico do sync de streaming foi o que
    // escondeu por 10 dias a causa do apagão de agosto.
    const msg =
      e instanceof TikTokUgcConfigError
        ? e.message
        : e instanceof Error && e.message
          ? `Falha ao sincronizar o TikTok da OneRPM: ${e.message}`
          : 'Falha ao sincronizar o TikTok da OneRPM.'
    console.error('[api/integracoes/onerpm/tiktok-ugc]', e)
    await gravarStatusTikTokUgc({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

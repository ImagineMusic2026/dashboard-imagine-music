import { NextResponse } from 'next/server'
import { autorizarCronOuPermissao } from '@/lib/server-auth'
import { gravarStatusOneRpm } from '@/lib/metricas-sociais/firestore'
import { OneRpmSftpConfigError, onerpmSftpConfigurado, sincronizarTrends } from '@/lib/onerpm/trends-sync'

// ssh2 + firebase-admin precisam do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sincroniza o STREAMING (trends) da OneRPM: baixa os últimos dias do SFTP,
 * agrega por artista e grava snapshot + histórico em `metricas-sociais`, com os
 * aliases de atribuição aplicados. Autorizada por CRON_SECRET (Vercel Cron, GET)
 * OU por um admin/marketing com a permissão `integracoes` (botão, POST).
 * `?dias=` ajusta a janela (default ONERPM_SYNC_DIAS ou 35).
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

  if (!onerpmSftpConfigurado()) {
    return NextResponse.json(
      { error: 'Integração OneRPM não configurada (defina ONERPM_SFTP_KEY e ONERPM_PASSPHRASE).' },
      { status: 503 },
    )
  }

  const param = new URL(req.url).searchParams.get('dias')
  const dias = Number(param || process.env.ONERPM_SYNC_DIAS || 35)

  try {
    const r = await sincronizarTrends({ dias: Number.isFinite(dias) ? dias : 35 })

    await gravarStatusOneRpm({
      status: 'conectado',
      artistasSincronizados: r.gravados,
      arquivos: r.arquivos,
      streamsJanela: r.streams,
      janelaDias: Number.isFinite(dias) ? dias : 35,
      ultimaSincronizacao: new Date().toISOString(),
      ultimoDia: r.periodo.ate || null,
      erro: null,
    })

    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    const msg =
      e instanceof OneRpmSftpConfigError ? e.message : 'Falha ao sincronizar o streaming da OneRPM.'
    console.error('[api/integracoes/onerpm/sincronizar]', e)
    await gravarStatusOneRpm({ status: 'erro', erro: msg }).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

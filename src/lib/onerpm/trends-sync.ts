import SftpClient from 'ssh2-sftp-client'
import { salvarStreamingArtista } from '@/lib/metricas-sociais/firestore'
import type { HistoricoStreamingDiaDoc } from '@/lib/metricas-sociais/types'
import { lerLinhasTrends } from './trends-parse'
import { acumular, finalizar, novoAcumulador } from './trends-aggregate'
import { resolverSlugArtista } from './trends-aliases'
import { montarSnapshot } from './trends-snapshot'

/**
 * Sync server-side do streaming (trends) da OneRPM — usado pelo cron diário
 * (`/api/integracoes/onerpm/sincronizar`). Igual ao script de backfill, mas:
 *  - lê a chave + passphrase do AMBIENTE (serverless não tem arquivo no disco);
 *  - usa janela curta (default 35 dias) — incremento, não a carga histórica.
 *
 * O snapshot é uma janela RECENTE (rolling). O histórico diário acumula em
 * `historico-streaming/{dia}` (idempotente por dia), então a curva longa do
 * card é preservada mesmo a janela do snapshot sendo curta.
 */

const HOST = 'trends-data.onerpm.com'
const BASE = 'Reports/stats'

export class OneRpmSftpConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneRpmSftpConfigError'
  }
}

/** True se as credenciais do SFTP estão no ambiente. */
export function onerpmSftpConfigurado(): boolean {
  return Boolean(process.env.ONERPM_SFTP_KEY && process.env.ONERPM_PASSPHRASE)
}

/** Lê a chave privada do ambiente: aceita base64 (recomendado) ou o PEM cru. */
function lerChave(): Buffer {
  const raw = process.env.ONERPM_SFTP_KEY
  if (!raw) throw new OneRpmSftpConfigError('ONERPM_SFTP_KEY ausente no ambiente.')
  const txt = raw.trim()
  if (txt.includes('PRIVATE KEY')) return Buffer.from(txt, 'utf8')
  return Buffer.from(txt, 'base64')
}

export interface TrendsSyncResult {
  arquivos: number
  streams: number
  artistas: number
  isrcs: number
  gravados: number
  periodo: { de: string; ate: string }
}

export async function sincronizarTrends(opts?: { dias?: number }): Promise<TrendsSyncResult> {
  const dias = Math.max(1, opts?.dias ?? 35)
  const passphrase = process.env.ONERPM_PASSPHRASE
  if (!passphrase) throw new OneRpmSftpConfigError('ONERPM_PASSPHRASE ausente no ambiente.')

  const sftp = new SftpClient()
  try {
    await sftp.connect({
      host: HOST,
      port: 22,
      username: 'ImagineMusic',
      privateKey: lerChave(),
      passphrase,
      readyTimeout: 20000,
    })

    const lojas = (await sftp.list(BASE))
      .filter((e) => e.type === 'd')
      .map((e) => e.name)
      .sort()

    const acc = novoAcumulador()
    let arquivos = 0
    for (const loja of lojas) {
      const files = (await sftp.list(`${BASE}/${loja}`))
        .filter((e) => e.type !== 'd' && e.name.toLowerCase().endsWith('.csv'))
        .map((e) => e.name)
        .sort()
      for (const arq of files.slice(-dias)) {
        const buf = (await sftp.get(`${BASE}/${loja}/${arq}`)) as Buffer
        acumular(acc, lerLinhasTrends(buf))
        arquivos++
      }
    }

    const agg = finalizar(acc)
    const coletadoEm = new Date().toISOString()
    const artistas = agg.porArtista.filter((a) => a.artistaSlug !== 'imagine-music-co' && a.streams > 0)

    let gravados = 0
    for (let i = 0; i < artistas.length; i += 8) {
      await Promise.all(
        artistas.slice(i, i + 8).map((a) => {
          const snapshot = montarSnapshot(a, coletadoEm)
          const historico: HistoricoStreamingDiaDoc[] = a.porDia.map((d) => ({
            dia: d.dia,
            streams: d.streams,
            skips: d.skips,
            coletadoEm,
          }))
          return salvarStreamingArtista(resolverSlugArtista(a.artistaSlug), snapshot, historico)
        }),
      )
      gravados += Math.min(8, artistas.length - i)
    }

    return {
      arquivos,
      streams: agg.totais.streams,
      artistas: agg.totais.artistas,
      isrcs: agg.totais.isrcs,
      gravados,
      periodo: { de: agg.periodo.de, ate: agg.periodo.ate },
    }
  } finally {
    await sftp.end().catch(() => {})
  }
}

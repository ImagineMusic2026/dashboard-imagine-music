import SftpClient from 'ssh2-sftp-client'
import { mapaNomesArtistas, salvarStreamingArtista, salvarStreamingDetalhe } from '@/lib/metricas-sociais/firestore'
import type { HistoricoStreamingDiaDoc, OneRpmArtistaResumo } from '@/lib/metricas-sociais/types'
import { lerLinhasTrends } from './trends-parse'
import { acumular, finalizar, novoAcumulador } from './trends-aggregate'
import { resolverSlugArtista } from './trends-aliases'
import { montarDetalhe, montarSnapshot } from './trends-snapshot'

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
  /** Artistas (slug do roster) com streaming na janela, deduplicados e ordenados por streams desc. */
  porArtista: OneRpmArtistaResumo[]
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

    // Monta a lista de arquivos (últimos `dias` por loja).
    const caminhos: string[] = []
    for (const loja of lojas) {
      const files = (await sftp.list(`${BASE}/${loja}`))
        // `e.size > 0` pula arquivos vazios (ex.: pandora/uma vêm sem dados) — não
        // têm streams, então baixá-los só gasta round-trip.
        .filter((e) => e.type !== 'd' && e.size > 0 && e.name.toLowerCase().endsWith('.csv'))
        .map((e) => e.name)
        .sort()
      for (const arq of files.slice(-dias)) caminhos.push(`${BASE}/${loja}/${arq}`)
    }

    // Baixa em PARALELO (lotes) e agrega. Sequencial é lento demais para o limite
    // do serverless (maxDuration); o SFTP multiplexa vários gets numa conexão só.
    const acc = novoAcumulador()
    // Concorrência do download. Acima de ~16 a vazão satura (a conexão é o gargalo).
    // Se um dia o cron apertar o limite do serverless, baixe `ONERPM_SYNC_DIAS`.
    const CONCORRENCIA = 16
    for (let i = 0; i < caminhos.length; i += CONCORRENCIA) {
      const bufs = await Promise.all(
        caminhos.slice(i, i + CONCORRENCIA).map((p) => sftp.get(p) as Promise<Buffer>),
      )
      for (const buf of bufs) acumular(acc, lerLinhasTrends(buf))
    }
    const arquivos = caminhos.length

    const agg = finalizar(acc)
    const coletadoEm = new Date().toISOString()
    const artistas = agg.porArtista.filter((a) => a.artistaSlug !== 'imagine-music-co' && a.streams > 0)

    let gravados = 0
    for (let i = 0; i < artistas.length; i += 8) {
      await Promise.all(
        artistas.slice(i, i + 8).map((a) => {
          const slug = resolverSlugArtista(a.artistaSlug)
          const snapshot = montarSnapshot(a, coletadoEm)
          const historico: HistoricoStreamingDiaDoc[] = a.porDia.map((d) => ({
            dia: d.dia,
            streams: d.streams,
            skips: d.skips,
            coletadoEm,
          }))
          return Promise.all([
            salvarStreamingArtista(slug, snapshot, historico),
            salvarStreamingDetalhe(slug, montarDetalhe(a, coletadoEm)),
          ])
        }),
      )
      gravados += Math.min(8, artistas.length - i)
    }

    // Lista compacta p/ o card: agrega os streams por slug do roster (aliases
    // podem juntar várias origens num artista só) e resolve o nome do cadastro.
    const nomes = await mapaNomesArtistas()
    const streamsPorSlug = new Map<string, number>()
    for (const a of artistas) {
      const slug = resolverSlugArtista(a.artistaSlug)
      streamsPorSlug.set(slug, (streamsPorSlug.get(slug) ?? 0) + a.streams)
    }
    const porArtista: OneRpmArtistaResumo[] = []
    streamsPorSlug.forEach((streams, slug) => {
      porArtista.push({ slug, nome: nomes.get(slug) ?? slug, streams })
    })
    porArtista.sort((x, y) => y.streams - x.streams)

    return {
      arquivos,
      streams: agg.totais.streams,
      artistas: agg.totais.artistas,
      isrcs: agg.totais.isrcs,
      gravados,
      periodo: { de: agg.periodo.de, ate: agg.periodo.ate },
      porArtista,
    }
  } finally {
    await sftp.end().catch(() => {})
  }
}

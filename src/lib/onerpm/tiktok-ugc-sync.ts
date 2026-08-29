import SftpClient from 'ssh2-sftp-client'
import { salvarTikTokUgc } from '@/lib/metricas-sociais/firestore'
import {
  acumularUgc,
  finalizarUgc,
  lerLinhasTikTokUgc,
  novoAcumuladorUgc,
  TikTokUgcParseError,
} from './tiktok-ugc-parse'

/**
 * Sync do feed de TIKTOK da OneRPM (`Reports/stats/tiktok`) → Firestore.
 *
 * Roda em ROTA E CRON PRÓPRIOS, separado do sync de streaming, de propósito: em
 * 2026-08-29 descobrimos que esta pasta nova derrubava o sync de streaming
 * inteiro por ter outro formato, e o streaming ficou 10 dias parado. Compartilhar
 * execução é compartilhar destino — aqui, se o TikTok quebrar, o streaming
 * (que é o dado principal) não sente.
 *
 * Grava `metricas-sociais/{slug}/streaming-detalhe/tiktok-ugc` por artista.
 */

const HOST = 'trends-data.onerpm.com'
const BASE = 'Reports/stats/tiktok'

export class TikTokUgcConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokUgcConfigError'
  }
}

export function tiktokUgcConfigurado(): boolean {
  return Boolean(process.env.ONERPM_SFTP_KEY && process.env.ONERPM_PASSPHRASE)
}

/** Mesma chave do feed de streaming: base64 (recomendado) ou PEM cru. */
function lerChave(): Buffer {
  const raw = process.env.ONERPM_SFTP_KEY
  if (!raw) throw new TikTokUgcConfigError('ONERPM_SFTP_KEY ausente no ambiente.')
  const txt = raw.trim()
  return txt.includes('PRIVATE KEY') ? Buffer.from(txt, 'utf8') : Buffer.from(txt, 'base64')
}

export interface TikTokUgcSyncResult {
  arquivos: number
  views: number
  criacoes: number
  artistas: number
  gravados: number
  periodo: { de: string; ate: string }
  /** Arquivos que o parser não entendeu (formato mudou) — reportado, não fatal. */
  ignorados: number
}

export async function sincronizarTikTokUgc(opts?: { dias?: number }): Promise<TikTokUgcSyncResult> {
  const dias = Math.max(1, opts?.dias ?? 35)
  const passphrase = process.env.ONERPM_PASSPHRASE
  if (!passphrase) throw new TikTokUgcConfigError('ONERPM_PASSPHRASE ausente no ambiente.')

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

    // A pasta pode simplesmente não existir (a OneRPM criou em 2026-08-07 e pode
    // remover). Sem pasta não é erro: é "ainda/não mais publicam isso".
    if (!(await sftp.exists(BASE))) {
      return {
        arquivos: 0,
        views: 0,
        criacoes: 0,
        artistas: 0,
        gravados: 0,
        periodo: { de: '', ate: '' },
        ignorados: 0,
      }
    }

    const nomes = (await sftp.list(BASE))
      .filter((e) => e.type !== 'd' && e.size > 0 && e.name.toLowerCase().endsWith('.csv'))
      .map((e) => e.name)
      .sort()
      // O feed PULA dias (não houve 10, 17 nem 20/08) — por isso a janela é
      // "os N arquivos mais recentes", não "os N últimos dias do calendário".
      .slice(-dias)

    const acc = novoAcumuladorUgc()
    let ignorados = 0
    // Estes arquivos são grandes (~12 mil linhas/dia). 8 por vez segura o pico de
    // memória do serverless sem perder muito da vazão do SFTP.
    const CONCORRENCIA = 8
    for (let i = 0; i < nomes.length; i += CONCORRENCIA) {
      const bufs = await Promise.all(
        nomes.slice(i, i + CONCORRENCIA).map((n) => sftp.get(`${BASE}/${n}`) as Promise<Buffer>),
      )
      for (const buf of bufs) {
        try {
          acumularUgc(acc, lerLinhasTikTokUgc(buf))
        } catch (e) {
          if (!(e instanceof TikTokUgcParseError)) throw e
          ignorados++
        }
      }
    }

    const artistas = finalizarUgc(acc)
    const coletadoEm = new Date().toISOString()

    let gravados = 0
    for (let i = 0; i < artistas.length; i += 8) {
      await Promise.all(
        artistas.slice(i, i + 8).map((a) =>
          salvarTikTokUgc(a.slug, {
            periodo: a.periodo,
            totais: a.totais,
            porFaixa: a.porFaixa,
            coletadoEm,
          }),
        ),
      )
      gravados += Math.min(8, artistas.length - i)
    }

    const de = artistas.reduce((m, a) => (!m || a.periodo.de < m ? a.periodo.de : m), '')
    const ate = artistas.reduce((m, a) => (a.periodo.ate > m ? a.periodo.ate : m), '')

    return {
      arquivos: nomes.length - ignorados,
      views: artistas.reduce((s, a) => s + a.totais.views, 0),
      criacoes: artistas.reduce((s, a) => s + a.totais.criacoes, 0),
      artistas: artistas.length,
      gravados,
      periodo: { de, ate },
      ignorados,
    }
  } finally {
    await sftp.end().catch(() => {})
  }
}

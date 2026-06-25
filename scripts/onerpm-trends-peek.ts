/**
 * Baixa UM CSV de trends do SFTP e roda o parser nele (prova de ponta a ponta).
 * É o núcleo do futuro sync: download -> parseTrends -> resumo.
 *
 *   npx tsx scripts/onerpm-trends-peek.ts Reports/stats/spotify/2026-06-20.csv
 */
import SftpClient from 'ssh2-sftp-client'
import { readFileSync } from 'node:fs'
import { parseTrends } from '../src/lib/onerpm/trends-parse'

const remote = process.argv[2] || 'Reports/stats/spotify/2026-06-20.csv'
const keyPath = process.env.ONERPM_KEY_PATH || 'C:\\Users\\User\\AppData\\Local\\Temp\\ImagineMusic'
const passphrase = process.env.ONERPM_PASSPHRASE
const TOP = Number(process.env.TOP || 10)

if (!passphrase) {
  console.error('✗ Defina a env ONERPM_PASSPHRASE.')
  process.exit(1)
}

const int = (n: number) => n.toLocaleString('pt-BR')
const pct = (n: number) => (n * 100).toFixed(1) + '%'

async function main() {
  const sftp = new SftpClient()
  try {
    await sftp.connect({
      host: 'trends-data.onerpm.com',
      port: 22,
      username: 'ImagineMusic',
      privateKey: readFileSync(keyPath),
      passphrase,
      readyTimeout: 20000,
    })
    const buf = (await sftp.get(remote)) as Buffer
    await sftp.end()

    const agg = parseTrends(buf)
  console.log(`============ ${remote} (${int(buf.length)} bytes) ============`)
  console.log('Período :', agg.periodo.de, '->', agg.periodo.ate, `(${agg.periodo.dias} dia)`)
  console.log('Lojas   :', agg.stores.join(', '))
  console.log(
    'Totais  :',
    int(agg.totais.streams),
    'streams |',
    int(agg.totais.skips),
    'skips |',
    pct(agg.totais.skipRate),
    'skip |',
    agg.totais.artistas,
    'artistas |',
    agg.totais.isrcs,
    'ISRCs'
  )
  console.log(`\n--- TOP ${TOP} ARTISTAS (por streams) ---`)
  for (const a of agg.porArtista.slice(0, TOP)) {
    const paises = a.porPais.slice(0, 4).map((p) => `${p.pais} ${int(p.streams)}`).join(' ')
    console.log(
      `  ${a.artistaNome.slice(0, 28).padEnd(30)} ${int(a.streams).padStart(8)} str  ${pct(a.skipRate).padStart(6)} skip  | ${paises}`
    )
  }
  console.log('\n--- AVISOS ---')
  console.log(agg.avisos.length ? agg.avisos.map((a) => ' • ' + a).join('\n') : '  (nenhum)')
  } catch (e) {
    console.error('✗ Falha:', (e as Error).message)
    process.exitCode = 1
    await sftp.end().catch(() => {})
  }
}

main()

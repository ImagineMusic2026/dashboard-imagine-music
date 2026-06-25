/**
 * Inventário do backfill de trends no SFTP da ONErpm.
 *
 * Conecta uma vez e, pra cada loja em `Reports/stats/<loja>/`, mostra
 * quantos CSVs diários existem, o intervalo de datas e o tamanho total.
 * Responde o "consegue visualizar todo o histórico disponível?" do contato.
 *
 * Uso (PowerShell):
 *   $env:ONERPM_PASSPHRASE = '...'; $env:ONERPM_KEY_PATH = 'C:\...\ImagineMusic'
 *   node scripts/onerpm-trends-inventory.mjs
 *   node scripts/onerpm-trends-inventory.mjs Reports/stats   # base alternativa
 */

import SftpClient from 'ssh2-sftp-client'
import { readFileSync } from 'node:fs'

const host = 'trends-data.onerpm.com'
const port = 22
const username = 'ImagineMusic'
const keyPath =
  process.env.ONERPM_KEY_PATH || 'C:\\Users\\User\\AppData\\Local\\Temp\\ImagineMusic'
const passphrase = process.env.ONERPM_PASSPHRASE
const base = process.argv[2] || 'Reports/stats'

if (!passphrase) {
  console.error('✗ Defina a env ONERPM_PASSPHRASE.')
  process.exit(1)
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

const sftp = new SftpClient()
try {
  await sftp.connect({
    host,
    port,
    username,
    privateKey: readFileSync(keyPath),
    passphrase,
    readyTimeout: 20000,
  })

  const lojas = (await sftp.list(base))
    .filter((e) => e.type === 'd')
    .sort((a, b) => a.name.localeCompare(b.name))

  console.log(`Backfill em "${base}" — ${lojas.length} loja(s)\n`)
  console.log('LOJA            ARQS  INTERVALO (1º -> último)        TAMANHO')
  console.log('─'.repeat(64))

  let totArqs = 0
  let totBytes = 0
  for (const loja of lojas) {
    const entradas = await sftp.list(`${base}/${loja.name}`)
    const arquivos = entradas.filter((e) => e.type !== 'd')
    const csvs = arquivos
      .filter((f) => f.name.toLowerCase().endsWith('.csv'))
      .map((f) => f.name)
      .sort()
    const bytes = arquivos.reduce((a, f) => a + (f.size || 0), 0)
    totArqs += csvs.length
    totBytes += bytes
    const ini = csvs[0]?.replace('.csv', '') ?? '—'
    const fim = csvs[csvs.length - 1]?.replace('.csv', '') ?? '—'
    console.log(
      `${loja.name.padEnd(14)} ${String(csvs.length).padStart(4)}  ${`${ini} -> ${fim}`.padEnd(28)}  ${mb(bytes).padStart(8)}`
    )
  }

  console.log('─'.repeat(64))
  console.log(`TOTAL          ${String(totArqs).padStart(5)}  ${''.padEnd(28)}  ${mb(totBytes).padStart(8)}`)
} catch (e) {
  console.error('✗ Falha:', e.message)
  process.exitCode = 1
} finally {
  await sftp.end()
}

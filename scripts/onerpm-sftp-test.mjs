/**
 * Teste de acesso ao SFTP de "trends" da ONErpm.
 *
 * Confirma que a chave + passphrase autenticam e lista o conteúdo da raiz
 * (é o "podem confirmar se conseguem acessar?" que o contato pediu).
 *
 * Uso (PowerShell):
 *   $env:ONERPM_PASSPHRASE = '...'; node scripts/onerpm-sftp-test.mjs
 *
 * Opcionais:
 *   $env:ONERPM_KEY_PATH = 'C:\caminho\para\ImagineMusic'   # padrao: a chave no %TEMP%
 *   node scripts/onerpm-sftp-test.mjs --path /algum/dir      # lista outro diretorio
 */

import SftpClient from 'ssh2-sftp-client'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
function arg(nome, def) {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}

const host = 'trends-data.onerpm.com'
const port = 22
const username = 'ImagineMusic'
const keyPath =
  process.env.ONERPM_KEY_PATH ||
  'C:\\Users\\User\\AppData\\Local\\Temp\\ImagineMusic'
const passphrase = process.env.ONERPM_PASSPHRASE
const remoteDir = arg('path', '.')

if (!passphrase) {
  console.error('✗ Defina a env ONERPM_PASSPHRASE (a senha do link de acesso unico).')
  process.exit(1)
}

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
  console.log(`✓ Autenticado como "${username}" em ${host}:${port}\n`)

  const itens = await sftp.list(remoteDir)
  if (itens.length === 0) {
    console.log(`(diretorio "${remoteDir}" esta vazio)`)
  } else {
    console.log(`Conteudo de "${remoteDir}" (${itens.length} item(s)):`)
    for (const e of itens.sort((a, b) => a.name.localeCompare(b.name))) {
      const tipo = e.type === 'd' ? 'DIR ' : 'FILE'
      const data = new Date(e.modifyTime).toISOString().slice(0, 16).replace('T', ' ')
      const tam = e.type === 'd' ? '' : `${e.size} bytes`
      console.log(`  ${tipo}  ${data}  ${e.name}  ${tam}`)
    }
  }
} catch (e) {
  console.error('✗ Falha na conexao/autenticacao:', e.message)
  process.exitCode = 1
} finally {
  await sftp.end()
}

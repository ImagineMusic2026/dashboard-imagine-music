/**
 * Valida o parser do roster contra o arquivo real.
 *   npx tsx scripts/verify-roster.ts "C:/caminho/ARTISTAS SELO IMAGINE MUSIC.xlsx"
 */
import fs from 'node:fs'
import { lerRoster } from '../src/lib/roster/parse'

const path = process.argv[2] ?? 'C:/Users/User/Downloads/ARTISTAS SELO IMAGINE MUSIC.xlsx'
const buf = fs.readFileSync(path)
const res = lerRoster(buf)

console.log('=== TOTAIS ===')
console.log(res.totais)

console.log('\n=== ROCK SALLES ===')
const rs = res.artistas.find((a) => a.slug === 'rock-salles')
console.log(JSON.stringify(rs, null, 2))

console.log('\n=== AMOSTRA (8) ===')
for (const a of res.artistas.slice(0, 8)) {
  console.log(
    `${a.nome.padEnd(22)} spotify=${a.spotify?.id ?? '—'}  ig=@${a.instagram?.handle ?? '—'}  tk=@${a.tiktok?.handle ?? '—'}`
  )
}

console.log('\n=== AVISOS ===')
console.log(res.avisos.length ? res.avisos.map((a) => ' • ' + a).join('\n') : '(nenhum)')

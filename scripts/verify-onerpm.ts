/**
 * Validação do parser da OneRPM contra um arquivo real.
 *   npx tsx scripts/verify-onerpm.ts "C:/caminho/arquivo.xlsx"
 */
import fs from 'node:fs'
import { parseOneRpm } from '../src/lib/onerpm/parse'
import { receitaPorPlataformaDisplay, totalReceitaBRL } from '../src/lib/onerpm/display'
import { slugify } from '../src/lib/onerpm/aggregate'

const path =
  process.argv[2] ??
  'C:/Users/User/Downloads/rock-salles-mar-abr-mai-2026-2026-06-03-185627-72664.xlsx'

const buf = fs.readFileSync(path)
const agg = parseOneRpm(buf)

const f = (n: number) => n.toFixed(4)
const money = (m: Record<string, number>) =>
  Object.entries(m)
    .map(([k, v]) => `${k} ${f(v)}`)
    .join('  ')

console.log('============ AGREGADO ONERPM ============')
console.log('Artista :', agg.artistaNome, `(slug: ${agg.artistaSlug})`)
console.log('Label   :', agg.label)
console.log('Meses   :', agg.periodo.transactionMonths.join(', '))
console.log('Lançado :', agg.periodo.accountedFrom, '->', agg.periodo.accountedTo)
console.log('Moedas  :', agg.moedas.join(', '))
console.log('Linhas  :', agg.totais.linhas, '| Streams:', agg.totais.streams.toLocaleString('pt-BR'))
console.log('Net     :', money(agg.totais.netPorMoeda))
console.log('Gross   :', money(agg.totais.grossPorMoeda))

console.log('\n--- POR PLATAFORMA (net por moeda) ---')
for (const p of agg.porPlataforma) {
  console.log(' ', p.plataforma.padEnd(15), 'streams', String(p.streams).padStart(8), '|', money(p.netPorMoeda))
}

console.log('\n--- TOP 5 FAIXAS (net por moeda) ---')
for (const t of agg.porFaixa.slice(0, 5)) {
  console.log(' ', t.titulo.slice(0, 28).padEnd(30), 'streams', String(t.streams).padStart(8), '|', money(t.netPorMoeda))
}

console.log('\n--- TOP 5 PAÍSES (net por moeda) ---')
for (const t of agg.porTerritorio.slice(0, 5)) {
  console.log(' ', t.territorio.padEnd(4), 'streams', String(t.streams).padStart(8), '|', money(t.netPorMoeda))
}

console.log('\n--- DISPLAY: ReceitaPlataforma[] (BRL, base=net, câmbio placeholder) ---')
for (const r of receitaPorPlataformaDisplay(agg)) {
  console.log(' ', r.plataforma.padEnd(15), 'R$', f(r.receita).padStart(10), `${r.percentualTotal}%`.padStart(5), '|', r.streams, 'streams')
}
console.log('TOTAL display:', 'R$', f(totalReceitaBRL(agg)))

console.log('\n--- AVISOS ---')
console.log(agg.avisos.length ? agg.avisos.map((a) => ' • ' + a).join('\n') : '  (nenhum)')

console.log('\n--- SANITY: slugify com acento ---')
console.log('  "Forró do Pão" ->', slugify('Forró do Pão'))

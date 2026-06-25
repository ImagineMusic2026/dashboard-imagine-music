/**
 * Validação do parser de TRENDS (streaming) da OneRPM contra um CSV real.
 *   npx tsx scripts/verify-onerpm-trends.ts "C:/Users/User/Downloads/2025-06-20 (1).csv"
 */
import fs from 'node:fs'
import { parseTrends } from '../src/lib/onerpm/trends-parse'

const path = process.argv[2] ?? 'C:/Users/User/Downloads/2025-06-20 (1).csv'

const buf = fs.readFileSync(path)
const agg = parseTrends(buf)

const int = (n: number) => n.toLocaleString('pt-BR')
const pct = (n: number) => (n * 100).toFixed(1) + '%'

console.log('============ TRENDS ONERPM (streaming) ============')
console.log('Arquivo :', path)
console.log('Período :', agg.periodo.de, '->', agg.periodo.ate, `(${agg.periodo.dias} dia(s))`)
console.log('Lojas   :', agg.stores.join(', '))
console.log(
  'Totais  :',
  int(agg.totais.streams),
  'streams |',
  int(agg.totais.skips),
  'skips |',
  pct(agg.totais.skipRate),
  'skip rate'
)
console.log(
  '        :',
  agg.totais.artistas,
  'artista(s) |',
  agg.totais.isrcs,
  'ISRC(s) |',
  agg.totais.linhas,
  'linha(s)'
)

for (const a of agg.porArtista) {
  console.log(`\n— ${a.artistaNome}  (slug: ${a.artistaSlug})`)
  console.log(
    '   streams',
    int(a.streams),
    '| skips',
    int(a.skips),
    '|',
    pct(a.skipRate),
    'skip rate |',
    a.periodo.dias,
    'dia(s)'
  )
  console.log('   países :', a.porPais.map((p) => `${p.pais} ${int(p.streams)}`).join('  '))
  console.log('   lojas  :', a.porLoja.map((l) => `${l.plataforma} ${int(l.streams)}`).join('  '))
  console.log('   faixas :', a.porFaixa.map((f) => `${f.isrc} ${int(f.streams)}`).join('  '))
}

console.log('\n--- AVISOS ---')
console.log(agg.avisos.length ? agg.avisos.map((a) => ' • ' + a).join('\n') : '  (nenhum)')

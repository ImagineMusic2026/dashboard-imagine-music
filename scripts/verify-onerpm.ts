/**
 * Validação do parser da OneRPM contra um arquivo real.
 *   npx tsx scripts/verify-onerpm.ts "C:/caminho/arquivo.xlsx"
 *
 * Confere o fatiamento por artista, a conservação da receita (a soma dos artistas
 * + a sobra tem de bater com o total do arquivo) e o tamanho do payload/docs.
 */
import fs from 'node:fs'
import { parseOneRpm } from '../src/lib/onerpm/parse'
import { paraBRL, receitaPorPlataformaDisplay, repasseAoSeloBRL, totalReceitaBRL } from '../src/lib/onerpm/display'
import { enxugarLote, slugify } from '../src/lib/onerpm/aggregate'

const path =
  process.argv[2] ??
  'C:/Users/User/Downloads/rock-salles-mar-abr-mai-2026-2026-06-03-185627-72664.xlsx'

const t0 = Date.now()
const buf = fs.readFileSync(path)
const lote = parseOneRpm(buf)
const msParse = Date.now() - t0

const f = (n: number) => n.toFixed(4)
const int = (n: number) => n.toLocaleString('pt-BR')
const money = (m: Record<string, number>) =>
  Object.entries(m)
    .map(([k, v]) => `${k} ${f(v)}`)
    .join('  ')
const soma = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0)

console.log('============ LOTE ONERPM ============')
console.log('Arquivo :', path.split(/[\\/]/).pop(), `(${(buf.length / 1048576).toFixed(2)}MB, parse ${msParse}ms)`)
console.log('Label   :', lote.label)
console.log('Meses   :', lote.periodo.transactionMonths.join(', '))
console.log('Lançado :', lote.periodo.accountedFrom, '->', lote.periodo.accountedTo)
console.log('Moedas  :', lote.moedas.join(', '))
console.log('Linhas  :', int(lote.totais.linhas), '| Streams:', int(lote.totais.streams))
console.log('Net     :', money(lote.totais.netPorMoeda))
console.log('Artistas:', lote.artistas.length)

console.log('\n--- CONSERVAÇÃO (soma dos artistas + sobra == total do arquivo?) ---')
const netArtistas = lote.artistas.reduce((a, x) => a + soma(x.totais.netPorMoeda), 0)
const netSobra = lote.naoAtribuido ? soma(lote.naoAtribuido.totais.netPorMoeda) : 0
const netTotal = soma(lote.totais.netPorMoeda)
const strArtistas = lote.artistas.reduce((a, x) => a + x.totais.streams, 0)
const strSobra = lote.naoAtribuido?.totais.streams ?? 0
const linhasArtistas = lote.artistas.reduce((a, x) => a + x.totais.linhas, 0)
const linhasSobra = lote.naoAtribuido?.totais.linhas ?? 0
const okNet = Math.abs(netArtistas + netSobra - netTotal) < 0.01
const okStr = strArtistas + strSobra === lote.totais.streams
const okLinhas = linhasArtistas + linhasSobra === lote.totais.linhas
console.log(`  net    : ${f(netArtistas)} + ${f(netSobra)} = ${f(netArtistas + netSobra)} vs ${f(netTotal)}  ${okNet ? '✅' : '❌'}`)
console.log(`  streams: ${int(strArtistas)} + ${int(strSobra)} vs ${int(lote.totais.streams)}  ${okStr ? '✅' : '❌'}`)
console.log(`  linhas : ${int(linhasArtistas)} + ${int(linhasSobra)} vs ${int(lote.totais.linhas)}  ${okLinhas ? '✅' : '❌'}`)

console.log('\n--- SLUGS DUPLICADOS? (dois artistas gravariam no mesmo doc) ---')
const vistos = new Map<string, string>()
let dup = 0
for (const a of lote.artistas) {
  const anterior = vistos.get(a.artistaSlug)
  if (anterior) {
    console.log(`  ❌ ${a.artistaSlug}: "${anterior}" e "${a.artistaNome}"`)
    dup++
  }
  vistos.set(a.artistaSlug, a.artistaNome)
}
console.log(dup ? `  ${dup} colisões` : '  ✅ nenhum')

console.log('\n--- TOP 12 ARTISTAS (R$ display, base=net, câmbio placeholder) ---')
for (const a of lote.artistas.slice(0, 12)) {
  const o = a.origens
  const via = [o.conta && `conta:${o.conta}`, o.performer && `performer:${o.performer}`, o.canal && `canal:${o.canal}`]
    .filter(Boolean)
    .join(' ')
  console.log(
    ' ',
    a.artistaNome.slice(0, 24).padEnd(26),
    'R$',
    f(totalReceitaBRL(a)).padStart(12),
    int(a.totais.streams).padStart(12),
    'str  |',
    via
  )
}

console.log('\n--- NÃO ATRIBUÍDO ---')
if (lote.naoAtribuido) {
  const n = lote.naoAtribuido
  console.log(`  ${int(n.totais.linhas)} linhas · ${int(n.totais.streams)} streams · R$ ${f(totalReceitaBRL(n))}`)
  console.log('  amostra:', n.porFaixa.slice(0, 3).map((x) => x.titulo.slice(0, 40)).join(' | '))
} else {
  console.log('  ✅ nada sobrou')
}

console.log('\n--- REPASSES (aba "Shares In & Out") ---')
const comRepasse = lote.artistas.filter((a) => soma(a.repassePorMoeda) > 0)
console.log(`  artistas com repasse ao selo: ${comRepasse.length}`)
for (const a of comRepasse.slice(0, 8)) {
  const rep = soma(a.repassePorMoeda)
  const gerado = soma(a.totais.netPorMoeda)
  const pct = gerado > 0 ? (100 * rep / gerado).toFixed(1) : '—'
  console.log(
    ' ',
    a.artistaNome.slice(0, 24).padEnd(26),
    'gerou', f(gerado).padStart(11),
    '| repassa', f(rep).padStart(10),
    `(${pct}%)`.padStart(8),
    '| R$', f(repasseAoSeloBRL(a.repassePorMoeda)).padStart(11)
  )
}
console.log('  pago pelo selo a terceiros:', money(lote.pagoTerceirosPorMoeda), `→ R$ ${f(paraBRL(lote.pagoTerceirosPorMoeda))}`)

console.log('\n--- REPASSE NÃO PODE INFLAR A RECEITA ---')
const repasseTotal = lote.artistas.reduce((a, x) => a + soma(x.repassePorMoeda), 0)
const okNaoSoma = Math.abs(netArtistas + netSobra - netTotal) < 0.01
console.log(`  repasse total: ${f(repasseTotal)} (fatia do selo, já dentro dos ${f(netTotal)} de receita)`)
console.log(`  receita do arquivo continua ${f(netTotal)}  ${okNaoSoma ? '✅' : '❌'}`)

console.log('\n--- MAIOR ARTISTA: display ---')
const top = lote.artistas[0]
for (const r of receitaPorPlataformaDisplay(top)) {
  console.log(' ', r.plataforma.padEnd(15), 'R$', f(r.receita).padStart(10), `${r.percentualTotal}%`.padStart(5), '|', int(r.streams), 'streams')
}
console.log('TOTAL lote:', 'R$', f(totalReceitaBRL(lote)))

console.log('\n--- TAMANHOS (payload da API e docs do Firestore) ---')
const kb = (n: number) => (n / 1024).toFixed(0) + 'KB'
const enxuto = enxugarLote(lote)
console.log('  payload cru    :', kb(Buffer.byteLength(JSON.stringify(lote))))
console.log('  payload enxuto :', kb(Buffer.byteLength(JSON.stringify(enxuto))), '(limite Vercel: 4.500KB)')
const maiorDoc = Math.max(...enxuto.artistas.map((a) => Buffer.byteLength(JSON.stringify(a))))
console.log('  maior receitas/{slug}:', kb(maiorDoc), '(limite Firestore: 1.024KB)')

console.log('\n--- AVISOS ---')
console.log(lote.avisos.length ? lote.avisos.map((a) => ' • ' + a).join('\n') : '  (nenhum)')

console.log('\n--- SANITY: slugify com acento ---')
console.log('  "Forró do Pão" ->', slugify('Forró do Pão'))

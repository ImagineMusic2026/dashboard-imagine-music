/**
 * Diagnóstico do consumo de LEITURAS do Firestore (plano Spark: 50 mil/dia).
 *
 * Conta o tamanho das séries diárias e estima o custo de cada tela. Usa consultas
 * de CONTAGEM (`count()`), que custam ~1 leitura por subcoleção em vez de ler os
 * documentos — o próprio diagnóstico não pode ser o que estoura a cota.
 *
 * Uso:
 *   node scripts/check-consumo-leituras.mjs           # amostra de 10 artistas
 *   node scripts/check-consumo-leituras.mjs --todos   # roster inteiro (~1 leitura por artista/série)
 */
import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

const chave = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(chave) })
const db = admin.firestore()

/** Espelha `DIAS_SERIE` em src/lib/metricas-sociais/client.ts. */
const LIMITE = 90
/** Espelha POR_PAGINA da lista de artistas. */
const POR_PAGINA = 15

const SERIES = ['historico', 'historico-tiktok', 'historico-youtube', 'historico-health', 'historico-streaming']

const todos = process.argv.includes('--todos')

async function contar(caminho) {
  try {
    const s = await db.collection(caminho).count().get()
    return s.data().count
  } catch {
    return 0
  }
}

const artistas = (await db.collection('artistas').select().get()).docs.map((d) => d.id)
const amostra = todos ? artistas : artistas.slice(0, 10)
console.log(`roster: ${artistas.length} artistas · medindo ${amostra.length}\n`)

const totalPorSerie = Object.fromEntries(SERIES.map((s) => [s, []]))
for (const slug of amostra) {
  const contagens = await Promise.all(SERIES.map((s) => contar(`metricas-sociais/${slug}/${s}`)))
  SERIES.forEach((s, i) => totalPorSerie[s].push(contagens[i]))
}

const media = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
const maior = (arr) => (arr.length ? Math.max(...arr) : 0)

console.log('série                  média   maior   lido hoje (limite ' + LIMITE + ')')
let porPerfilSemLimite = 0
let porPerfilComLimite = 0
for (const s of SERIES) {
  const m = media(totalPorSerie[s])
  const M = maior(totalPorSerie[s])
  const lido = Math.min(M, LIMITE)
  console.log(`${s.padEnd(22)} ${String(m).padStart(5)}  ${String(M).padStart(6)}  ${String(lido).padStart(6)}`)
  // O perfil lê 4 séries em dobro (comparativo + card da plataforma) + health.
  const vezes = s === 'historico-health' ? 1 : 2
  porPerfilSemLimite += M * vezes
  porPerfilComLimite += lido // com cache, cada série é lida UMA vez
}

console.log('\n--- custo estimado por tela (pior caso, cache frio) ---')
console.log(`perfil do artista   ANTES ~${porPerfilSemLimite} leituras  →  DEPOIS ~${porPerfilComLimite}`)
const listaAntes = artistas.length * 2 + POR_PAGINA * maior(totalPorSerie['historico-health'])
const listaDepois = artistas.length * 2 + POR_PAGINA * Math.min(maior(totalPorSerie['historico-health']), LIMITE)
console.log(`lista de artistas   ANTES ~${listaAntes} leituras  →  DEPOIS ~${listaDepois}`)
console.log('\n(o ganho maior não aparece aqui: com o cache de 5 min, reabrir a mesma tela custa ZERO)')
process.exit(0)

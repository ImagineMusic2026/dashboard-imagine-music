/**
 * Lista artistas que TÊM streaming gravado mas NÃO existem no roster (`artistas`).
 * Pra cada um, sugere o slug mais próximo do roster (distância de edição) — ajuda
 * a decidir entre "cadastrar novo" e "corrigir grafia".
 *   node scripts/streaming-sem-cadastro.mjs
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

function lev(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[m][n]
}

const [metr, art] = await Promise.all([
  db.collection('metricas-sociais').get(),
  db.collection('artistas').get(),
])
const rosterSlugs = art.docs.map((d) => d.id)
const roster = new Set(rosterSlugs)
const nomePorSlug = new Map(art.docs.map((d) => [d.id, d.data().nome ?? d.id]))

const semCadastro = []
metr.forEach((d) => {
  const s = d.data().streaming
  if (s && !roster.has(d.id)) {
    semCadastro.push({ slug: d.id, nome: s.artistaNome || d.id, streams: s.streams || 0, ultimo: s.ultimoDia })
  }
})
semCadastro.sort((a, b) => b.streams - a.streams)

const int = (n) => Number(n).toLocaleString('pt-BR')
console.log(`${semCadastro.length} artista(s) com streaming mas SEM cadastro no roster:\n`)
for (const x of semCadastro) {
  let melhor = null
  let dist = Infinity
  for (const r of rosterSlugs) {
    const d = lev(x.slug, r)
    if (d < dist) {
      dist = d
      melhor = r
    }
  }
  const sugestao = dist <= 4 ? `  ~ parecido com "${nomePorSlug.get(melhor)}" (${melhor}, dist ${dist})` : '  (sem similar no roster — provável cadastro novo)'
  console.log(`  ${x.nome.padEnd(26)} ${int(x.streams).padStart(12)} streams  [${x.slug}]`)
  console.log(`  ${' '.repeat(26)}${sugestao}`)
}
process.exit(0)

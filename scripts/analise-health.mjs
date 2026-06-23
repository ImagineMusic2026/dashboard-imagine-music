// Throwaway: lê `metricas-sociais` e imprime a distribuição dos SINAIS BRUTOS
// (pré-saturação) do Health Score, pra calibrar os pontos de saturação do
// score.ts a partir do roster real. Não escreve nada. Rode: node scripts/analise-health.mjs
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const db = admin.firestore()

const DIA = 86_400_000
const agora = Date.now()

function mediana(arr) {
  const a = [...arr].sort((x, y) => x - y)
  const n = a.length
  if (!n) return 0
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}
function pct(arr, p) {
  if (!arr.length) return null
  const a = [...arr].sort((x, y) => x - y)
  const idx = Math.min(a.length - 1, Math.max(0, Math.round((p / 100) * (a.length - 1))))
  return a[idx]
}

const audiencia = []
const crescimentoPct = []
const igRate = []
const ytRate = []
const diasUltimo = []
const posts30dArr = []

const snap = await db.collection('metricas-sociais').get()
snap.forEach((d) => {
  const doc = d.data()
  const ig = doc.instagram
  const yt = doc.youtube
  const tt = doc.tiktok

  const igSeg = ig?.seguidores ?? 0
  const ytSeg = yt && !yt.inscritosOcultos ? (yt.inscritos ?? 0) : 0
  const ttSeg = tt?.seguidores ?? 0
  const total = igSeg + ytSeg + ttSeg
  if (total > 0) audiencia.push(total)

  let segAtual = 0
  let segAntes = 0
  let temAntes = false
  if (ig?.seguidores != null && ig.seguidoresAntes != null && ig.seguidoresAntes > 0) {
    segAtual += ig.seguidores
    segAntes += ig.seguidoresAntes
    temAntes = true
  }
  if (yt?.inscritos != null && yt.inscritosAntes != null && yt.inscritosAntes > 0 && !yt.inscritosOcultos) {
    segAtual += yt.inscritos
    segAntes += yt.inscritosAntes
    temAntes = true
  }
  if (temAntes && segAntes > 0) crescimentoPct.push((segAtual - segAntes) / segAntes)

  if (ig?.seguidores && ig.seguidores > 0 && ig.postsRecentes?.length) {
    const vals = ig.postsRecentes.map((p) => (p.curtidas ?? 0) + (p.comentarios ?? 0)).filter((v) => v > 0)
    if (vals.length) igRate.push(mediana(vals) / ig.seguidores)
  }
  if (yt?.inscritos && yt.inscritos > 0 && yt.videosRecentes?.length) {
    const vals = yt.videosRecentes.map((v) => v.views ?? 0).filter((v) => v > 0)
    if (vals.length) ytRate.push(mediana(vals) / yt.inscritos)
  }

  const datas = []
  for (const p of ig?.postsRecentes ?? []) if (p.publicadoEm) datas.push(Date.parse(p.publicadoEm))
  for (const v of yt?.videosRecentes ?? []) if (v.publicadoEm) datas.push(Date.parse(v.publicadoEm))
  if (datas.length) {
    diasUltimo.push(Math.max(0, (agora - Math.max(...datas)) / DIA))
    posts30dArr.push(datas.filter((t) => agora - t <= 30 * DIA).length)
  }
})

const fmtPctTxt = (x) => (x == null ? '—' : `${(x * 100).toFixed(2)}%`)
const fmtNum = (x) => (x == null ? '—' : Math.round(x).toLocaleString('pt-BR'))
const fmtDay = (x) => (x == null ? '—' : x.toFixed(1))

function linha(nome, arr, fmt) {
  console.log(
    `${nome.padEnd(22)} n=${String(arr.length).padStart(3)}  ` +
      `p25=${String(fmt(pct(arr, 25))).padStart(10)}  ` +
      `mediana=${String(fmt(pct(arr, 50))).padStart(10)}  ` +
      `p75=${String(fmt(pct(arr, 75))).padStart(10)}  ` +
      `p90=${String(fmt(pct(arr, 90))).padStart(10)}`,
  )
}

console.log(`\nDocs em metricas-sociais: ${snap.size}\n`)
console.log('SINAL                  amostra   p25         mediana     p75         p90')
console.log('─'.repeat(86))
linha('Audiência (seguidores)', audiencia, fmtNum)
linha('Crescimento %/coleta', crescimentoPct, fmtPctTxt)
linha('Engajamento IG (taxa)', igRate, fmtPctTxt)
linha('Engajamento YT (v/insc)', ytRate, fmtPctTxt)
linha('Dias desde últim. post', diasUltimo, fmtDay)
linha('Posts nos últimos 30d', posts30dArr, fmtNum)
console.log('')
process.exit(0)

/**
 * Sync do feed de STREAMING (trends) da OneRPM -> Firestore.
 *
 * Baixa os CSVs diários do SFTP (Reports/stats/<loja>/YYYY-MM-DD.csv), agrega por
 * artista (dia/país/plataforma/ISRC) e grava o snapshot + histórico diário em
 * `metricas-sociais/{slug}` (campo `streaming`) — o mesmo doc das redes sociais,
 * lido pelo StreamingArtistaCard. Idempotente: reprocessar sobrescreve por dia.
 *
 * Uso (PowerShell):
 *   $env:ONERPM_PASSPHRASE='...'; $env:ONERPM_KEY_PATH='C:\...\ImagineMusic'
 *   npx tsx scripts/sync-onerpm-trends.ts
 *
 * Variáveis:
 *   DIAS=120     janela de dias por loja (padrão 120; use "all" pro backfill inteiro)
 *   DRY=1        só calcula e imprime, NÃO grava no Firestore
 *   STORE=spotify limita a uma loja (debug)
 */
import SftpClient from 'ssh2-sftp-client'
import { readFileSync } from 'node:fs'
import { adminDb } from '../src/lib/firebase-admin'
import { lerLinhasTrends } from '../src/lib/onerpm/trends-parse'
import { acumular, finalizar, novoAcumulador } from '../src/lib/onerpm/trends-aggregate'
import { resolverSlugArtista } from '../src/lib/onerpm/trends-aliases'
import type {
  HistoricoStreamingDiaDoc,
  StreamingDetalheDoc,
  StreamingSnapshot,
} from '../src/lib/metricas-sociais/types'
import { montarDetalhe, montarSnapshot } from '../src/lib/onerpm/trends-snapshot'

const keyPath = process.env.ONERPM_KEY_PATH || 'C:\\Users\\User\\AppData\\Local\\Temp\\ImagineMusic'
const passphrase = process.env.ONERPM_PASSPHRASE
const BASE = 'Reports/stats'
const DIAS = process.env.DIAS === 'all' ? Infinity : Number(process.env.DIAS || 120)
const DRY = process.env.DRY === '1'
const STORE_FILTRO = process.env.STORE || null
const HIST_MAX = 180 // quantos dias de histórico gravar por artista

const int = (n: number) => n.toLocaleString('pt-BR')
const nowIso = () => new Date().toISOString()

async function gravarArtista(
  slug: string,
  snapshot: StreamingSnapshot,
  historico: HistoricoStreamingDiaDoc[],
  detalhe: StreamingDetalheDoc,
): Promise<void> {
  const ref = adminDb.doc(`metricas-sociais/${slug}`)
  await ref.set({ slug, streaming: snapshot, atualizadoEm: snapshot.coletadoEm }, { merge: true })
  await ref.collection('streaming-detalhe').doc('atual').set(detalhe)
  for (let i = 0; i < historico.length; i += 400) {
    const batch = adminDb.batch()
    for (const h of historico.slice(i, i + 400)) {
      batch.set(ref.collection('historico-streaming').doc(h.dia), h, { merge: true })
    }
    await batch.commit()
  }
}

async function main() {
  if (!passphrase) {
    console.error('✗ Defina a env ONERPM_PASSPHRASE.')
    process.exit(1)
  }

  const sftp = new SftpClient()
  await sftp.connect({
    host: 'trends-data.onerpm.com',
    port: 22,
    username: 'ImagineMusic',
    privateKey: readFileSync(keyPath),
    passphrase,
    readyTimeout: 20000,
  })
  console.log(`✓ Conectado. Janela: ${DIAS === Infinity ? 'tudo' : `${DIAS} dias/loja`}${DRY ? ' · DRY-RUN' : ''}\n`)

  const lojas = (await sftp.list(BASE))
    .filter((e) => e.type === 'd' && (!STORE_FILTRO || e.name === STORE_FILTRO))
    .map((e) => e.name)
    .sort()

  const acc = novoAcumulador()
  let baixados = 0
  for (const loja of lojas) {
    const arquivos = (await sftp.list(`${BASE}/${loja}`))
      .filter((e) => e.type !== 'd' && e.name.toLowerCase().endsWith('.csv'))
      .map((e) => e.name)
      .sort()
    const janela = DIAS === Infinity ? arquivos : arquivos.slice(-DIAS)
    process.stdout.write(`  ${loja.padEnd(12)} ${janela.length} arquivo(s) `)
    let n = 0
    for (const arq of janela) {
      const buf = (await sftp.get(`${BASE}/${loja}/${arq}`)) as Buffer
      acumular(acc, lerLinhasTrends(buf))
      baixados++
      if (++n % 40 === 0) process.stdout.write('.')
    }
    process.stdout.write(' ok\n')
  }
  await sftp.end()

  const agg = finalizar(acc)
  console.log(
    `\n${baixados} arquivos · ${int(agg.totais.streams)} streams · ${agg.totais.artistas} artistas · ` +
      `${agg.totais.isrcs} ISRCs · período ${agg.periodo.de} → ${agg.periodo.ate}\n`,
  )

  // roster pra estatística de casamento (atribuição por slug do nome)
  const rosterSnap = await adminDb.collection('artistas').get()
  const rosterSlugs = new Set(rosterSnap.docs.map((d) => d.id))

  const coletadoEm = nowIso()
  const artistas = agg.porArtista.filter((a) => a.artistaSlug !== 'imagine-music-co' && a.streams > 0)

  let casados = 0
  let gravados = 0
  console.log('TOP 15 ARTISTAS:')
  for (let i = 0; i < artistas.length; i++) {
    const a = artistas[i]
    const slugRoster = resolverSlugArtista(a.artistaSlug)
    const noRoster = rosterSlugs.has(slugRoster)
    if (noRoster) casados++
    if (i < 15) {
      const alias = slugRoster !== a.artistaSlug ? ` → ${slugRoster}` : ''
      console.log(
        `  ${(noRoster ? '✓' : '·')} ${a.artistaNome.slice(0, 26).padEnd(28)} ${int(a.streams).padStart(10)} str  ` +
          `${(a.skipRate * 100).toFixed(0)}% skip  (${a.artistaSlug}${alias})`,
      )
    }
  }

  if (!DRY) {
    console.log('\nGravando no Firestore…')
    for (let i = 0; i < artistas.length; i += 8) {
      await Promise.all(
        artistas.slice(i, i + 8).map((a) => {
          const snapshot = montarSnapshot(a, coletadoEm)
          const historico: HistoricoStreamingDiaDoc[] = a.porDia
            .slice(-HIST_MAX)
            .map((d) => ({ dia: d.dia, streams: d.streams, skips: d.skips, coletadoEm }))
          const detalhe = montarDetalhe(a, coletadoEm)
          return gravarArtista(resolverSlugArtista(a.artistaSlug), snapshot, historico, detalhe)
        }),
      )
      gravados += Math.min(8, artistas.length - i)
      process.stdout.write(`\r  ${gravados}/${artistas.length}`)
    }
    console.log('')
  }

  console.log(
    `\n✓ ${DRY ? '(dry) ' : ''}${artistas.length} artistas processados · ${casados} casam com o roster · ` +
      `${artistas.length - casados} ainda sem cadastro.`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error('✗ Falha:', e?.message || e)
  process.exit(1)
})

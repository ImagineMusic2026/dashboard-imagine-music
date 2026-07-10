/**
 * Prévia SOMENTE LEITURA da importação: o que o relatório da OneRPM faria com o
 * roster que já está no Firestore. Não escreve nada.
 *
 *   npx tsx scripts/verify-onerpm-roster.ts "C:/caminho/relatorio.xlsx"
 *
 * Existe porque o slug da OneRPM nem sempre é o slug do roster (o roster tem
 * "Netto Brito" como `neto-brito`). Gravar no slug errado criaria um artista
 * duplicado e esconderia a receita do perfil dele.
 */
import fs from 'node:fs'
import admin from 'firebase-admin'
import { parseOneRpm } from '../src/lib/onerpm/parse'
import { reconciliarArtistas, type ArtistaRoster } from '../src/lib/onerpm/aggregate'
import { formatarMoedas } from '../src/lib/onerpm/display'

const caminho = process.argv[2]
if (!caminho) {
  console.error('Uso: npx tsx scripts/verify-onerpm-roster.ts "<arquivo.xlsx>"')
  process.exit(1)
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))),
  })
  const db = admin.firestore()

  const lote = parseOneRpm(fs.readFileSync(caminho))
  const snap = await db.collection('artistas').select('nome').get()
  const roster: ArtistaRoster[] = snap.docs.map((d) => ({ slug: d.id, nome: String(d.data().nome ?? '') }))

  const rec = reconciliarArtistas(lote.artistas, roster)

  const criados = lote.artistas.filter((a) => rec.get(a.artistaSlug)!.criado)
  const casados = lote.artistas.filter((a) => {
    const r = rec.get(a.artistaSlug)!
    return !r.criado && r.slug !== a.artistaSlug
  })
  const duvidosos = lote.artistas.filter((a) => rec.get(a.artistaSlug)!.possivelDuplicata)

  console.log('=== PRÉVIA (nada foi gravado) ===')
  console.log('roster hoje      :', roster.length, 'artistas')
  console.log('no relatório     :', lote.artistas.length, 'artistas')
  console.log('já existiam      :', lote.artistas.length - criados.length)
  console.log('serão criados    :', criados.length)

  if (casados.length) {
    console.log(`\n--- SLUG RECONCILIADO (a receita vai pro cadastro existente) ---`)
    for (const a of casados) {
      console.log(`  ${a.artistaNome.padEnd(26)} onerpm=${a.artistaSlug.padEnd(20)} → roster=${rec.get(a.artistaSlug)!.slug}`)
    }
  }

  if (criados.length) {
    console.log(`\n--- SERÃO CRIADOS (nascem pendentes de configuração) ---`)
    for (const a of criados) {
      const r = rec.get(a.artistaSlug)!
      const alerta = r.possivelDuplicata ? `  ⚠️  parece "${r.possivelDuplicata}"` : ''
      console.log(`  ${a.artistaNome.padEnd(26)} ${formatarMoedas(a.totais.netPorMoeda).padEnd(30)}${alerta}`)
    }
  }

  if (duvidosos.length) {
    console.log(`\n⚠️  ${duvidosos.length} possíveis duplicatas acima — confira antes de importar.`)
  } else {
    console.log('\n✅ nenhuma duplicata suspeita')
  }

  // Onde a receita seria gravada vs onde o perfil a lê.
  const receitasSnap = await db.collection('receitas').get()
  const receitasHoje = new Set(receitasSnap.docs.map((d) => d.id))
  const orfas = Array.from(receitasHoje).filter((s) => !roster.some((r) => r.slug === s))
  if (orfas.length) {
    console.log(`\n⚠️  receitas/{slug} sem artista correspondente (invisíveis no painel): ${orfas.join(', ')}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

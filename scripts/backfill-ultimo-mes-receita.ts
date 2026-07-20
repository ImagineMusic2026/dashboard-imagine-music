/**
 * Preenche `receitas/{slug}.ultimoMes` (receita do mês de LANÇAMENTO mais recente)
 * nos docs que já existem. A lista de artistas passou a mostrar o mês, não o total —
 * sem este campo, ela cai no total.
 *
 * SEGURO por construção:
 *  - só faz `set(..., { merge: true })` do campo `ultimoMes`. NÃO reprocessa o
 *    consolidado, NÃO apaga nada.
 *  - artistas SEM histórico em `receitas-importadas` (importação anterior ao
 *    versionamento) são PULADOS — a lista cai no total pra eles, sem prejuízo.
 *
 *   npx tsx scripts/backfill-ultimo-mes-receita.ts            # todos os artistas
 *   npx tsx scripts/backfill-ultimo-mes-receita.ts neto-brito # só um (pra conferir antes)
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

void (async () => {
  const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(svc) })
  const db = admin.firestore()
  db.settings({ ignoreUndefinedProperties: true })

  // Slug opcional: se passado, roda só nesse artista (preview antes de aplicar geral).
  const soSlug = process.argv[2]?.trim() || null
  let alvos: admin.firestore.DocumentSnapshot[]
  if (soSlug) {
    const one = await db.collection('receitas').doc(soSlug).get()
    if (!one.exists) {
      console.error(`receitas/${soSlug} não existe — confira o slug.`)
      process.exit(1)
    }
    alvos = [one]
  } else {
    alvos = (await db.collection('receitas').get()).docs
  }
  console.log(`alvo: ${soSlug ? soSlug : `todos (${alvos.length} artistas)`}\n`)

  let atualizados = 0
  let pulados = 0

  for (const doc of alvos) {
    const slug = doc.id
    const imp = await db.collection('receitas-importadas').where('slug', '==', slug).get()
    if (imp.empty) {
      pulados++
      continue
    }

    // Dedup por mês (re-envio do mesmo período): fica a versão IMPORTADA mais recente.
    const porPeriodo = new Map<string, admin.firestore.DocumentData>()
    const ordenadas = imp.docs
      .map((d) => d.data())
      .sort((a, b) => Number(b.criadoEmMs ?? 0) - Number(a.criadoEmMs ?? 0))
    for (const v of ordenadas) {
      const key = String(v.periodoKey ?? v.importacaoId ?? '')
      if (!porPeriodo.has(key)) porPeriodo.set(key, v)
    }

    // Mês de LANÇAMENTO mais recente (maior periodoKey), não o subido por último.
    const doMes = Array.from(porPeriodo.values()).sort((a, b) =>
      String(b.periodoKey ?? '').localeCompare(String(a.periodoKey ?? '')),
    )[0]
    const rec = doMes?.receita as admin.firestore.DocumentData | undefined
    if (!rec?.totais) {
      pulados++
      continue
    }

    const ultimoMes = {
      periodoKey: String(doMes.periodoKey ?? ''),
      periodo: rec.periodo ?? null,
      netPorMoeda: rec.totais.netPorMoeda ?? {},
      streams: Number(rec.totais.streams ?? 0),
    }

    await doc.ref.set({ ultimoMes }, { merge: true })
    atualizados++
    console.log(`  ${slug}: ${ultimoMes.periodoKey}`)
  }

  console.log(`\nFeito — atualizados: ${atualizados}, pulados (sem histórico): ${pulados}`)
  process.exit(0)
})()

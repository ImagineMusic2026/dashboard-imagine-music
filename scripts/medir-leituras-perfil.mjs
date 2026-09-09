/**
 * Conta as leituras do Firestore que UMA abertura de perfil de artista custa.
 *
 *   node scripts/medir-leituras-perfil.mjs [slug ...]
 *
 * Existe porque a conta está no plano gratuito (50 mil leituras/dia) e já caiu
 * uma vez por cota, em agosto de 2026. Quando alguém propuser um card novo no
 * perfil, ou desconfiar que a tela ficou cara, rode isto antes de discutir.
 *
 * Replica o que os cards pedem, com as mesmas janelas, respeitando o que o cache
 * compartilha (`metricas-sociais` é lido uma vez para os 8 cards que o usam;
 * séries com a mesma janela também). O agrupamento por "aba" é a proposta de
 * separar o perfil em seções — serve para dimensionar a economia antes de
 * construir.
 *
 * Medição de 2026-09-09: Netto Brito custa **740 leituras** por abertura, das
 * quais 309 são o card de Fonogramas (consulta que traz todas as faixas do
 * artista) e ~420 são as cinco séries diárias de 90 dias. A 740 por perfil, 68
 * aberturas esgotam a cota do dia.
 *
 * ⚠️ ESTE SCRIPT LÊ DE VERDADE PARA CONTAR — ele mesmo gasta a cota que está
 * medindo, e o perfil de um artista grande custa ~700 leituras por rodada.
 *
 * Em 09/09/2026 eu o rodei cinco vezes seguidas enquanto ajustava a saída e,
 * somado ao trabalho do dia (importação do catálogo, duas rodadas de atribuição
 * de fonogramas, levantamento dos 97 artistas na Soundcharts), estourei a cota
 * diária. O painel ficou sem dados até a virada — o mesmo sintoma do apagão de
 * agosto, e pela mesma causa.
 *
 * Então: rode UMA vez, num artista só, e guarde a saída. Ele serve para
 * dimensionar uma decisão, não para reexecutar a cada ajuste. Se precisar
 * comparar antes/depois, compare com o número anotado no topo deste arquivo em
 * vez de medir de novo.
 *
 * A cota zera à meia-noite do horário do Pacífico, que é como o Firebase conta
 * o dia — não é meia-noite de Brasília.
 */
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))) })
const db = admin.firestore()

const DIAS_SERIE = 90
const MAX_FONOGRAMAS = 500

async function medir(slug) {
  const linhas = []
  const sobDemanda = []
  const conta = (aba, o_que, n) => linhas.push({ aba, o_que, n })

  // ── compartilhados (cache) ────────────────────────────────────────────────
  conta('Visão geral', 'metricas-sociais/{slug} (8 cards dividem)', 1)
  conta('Visão geral', 'artistas/{slug}', 1)
  conta('Visão geral', 'projetos/{slug} (3 cards dividem)', 1)

  // ── séries diárias (limite 90, chave de cache = sub|slug|limite) ──────────
  for (const [sub, aba] of [
    ['historico-health', 'Visão geral'],
    ['historico', 'Canais'],
    ['historico-tiktok', 'Canais'],
    ['historico-youtube', 'Canais'],
    ['historico-streaming', 'Streaming'],
  ]) {
    const s = await db.collection(`metricas-sociais/${slug}/${sub}`).select().get()
    conta(aba, `${sub} (últimos ${DIAS_SERIE})`, Math.min(s.size, DIAS_SERIE))
  }

  // ── detalhes ──────────────────────────────────────────────────────────────
  const det = await db.doc(`metricas-sociais/${slug}/streaming-detalhe/atual`).get()
  conta('Streaming', 'streaming-detalhe/atual', det.exists ? 1 : 1)
  const ugc = await db.doc(`metricas-sociais/${slug}/streaming-detalhe/tiktok-ugc`).get()
  conta('Streaming', 'streaming-detalhe/tiktok-ugc', ugc.exists ? 1 : 1)

  // ── consultas que devolvem N documentos ───────────────────────────────────
  // Desde 09/09/2026 o card de Fonogramas NÃO carrega a lista na abertura: o
  // contador vem do campo desnormalizado em `artistas/{slug}` e as faixas só são
  // buscadas quando alguém clica em "Ver as N faixas". Fica aqui como sob demanda
  // para o custo continuar visível.
  const fon = await db.collection('catalogo-faixas').where('artistaSlug', '==', slug).limit(MAX_FONOGRAMAS).select().get()
  sobDemanda.push({ o_que: 'catalogo-faixas do artista (botão "Ver as N faixas")', n: Math.max(1, fon.size) })

  const con = await db.collection(`projetos/${slug}/contratos`).select().get()
  conta('Receita', 'projetos/{slug}/contratos', Math.max(1, con.size))

  conta('Receita', 'projetos/{slug}/patrimonio/inventario', 1)
  conta('Receita', 'receitas/{slug} (via rota, servidor)', 1)

  conta('Cadastro', 'diagnosticos/{slug}/questionarios/projeto', 1)
  conta('Cadastro', 'diagnosticos/{slug}/questionarios/artista', 1)

  return { linhas, sobDemanda }
}

for (const slug of process.argv.slice(2).length ? process.argv.slice(2) : ['neto-brito', 'donas-do-bar']) {
  const { linhas, sobDemanda } = await medir(slug)
  const total = linhas.reduce((t, l) => t + l.n, 0)
  console.log(`\n================ ${slug} ================`)
  for (const l of linhas) console.log(`  ${String(l.n).padStart(4)}  ${l.aba.padEnd(12)} ${l.o_que}`)
  console.log(`  ${'-'.repeat(60)}`)
  console.log(`  ${String(total).padStart(4)}  se TODAS as abas fossem carregadas juntas (era assim ate 09/09)`)
  if (sobDemanda.length) {
    console.log('\n  só se alguém clicar (não entra no total acima):')
    for (const l of sobDemanda) console.log(`    ${String(l.n).padStart(4)}  ${l.o_que}`)
  }

  const porAba = {}
  for (const l of linhas) porAba[l.aba] = (porAba[l.aba] ?? 0) + l.n
  console.log('\n  se virar abas, a PRIMEIRA carrega:')
  console.log(`    Visão geral: ${porAba['Visão geral']} leituras  <-- SO ISTO`)
  console.log('  e cada aba abaixo só se alguem clicar nela:')
  for (const [aba, n] of Object.entries(porAba)) {
    if (aba !== 'Visão geral') console.log(`    ${aba}: ${n}`)
  }
  const economia = total - porAba['Visão geral']
  console.log(`\n  economia por abertura que não navega: ${economia} (${Math.round((economia / total) * 100)}%)`)
}
process.exit(0)

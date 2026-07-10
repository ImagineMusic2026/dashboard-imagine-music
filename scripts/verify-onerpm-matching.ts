/**
 * Casos-limite dos dois matchers da importação da OneRPM:
 *   1. canal do YouTube → artista (aba "Sales")
 *   2. artista do relatório → cadastro já existente no roster
 *
 *   npx tsx scripts/verify-onerpm-matching.ts
 *
 * Ambos decidem PRA ONDE VAI DINHEIRO. Aqui travamos o comportamento esperado,
 * sobretudo os casos em que eles DEVEM se recusar a escolher.
 */
import { agregarPorArtista, reconciliarArtistas, type ArtistaRoster } from '../src/lib/onerpm/aggregate'
import type { OneRpmRawRow } from '../src/lib/onerpm/types'

const SELO = 'Imagine Music co'

const base: OneRpmRawRow = {
  sourceAccount: '', title: 'x', albumChannel: '', artists: '', label: SELO, productType: 'Track',
  parentId: '', trackId: '', salesType: 'Stream', transactionMonth: '2026-01', accountedDate: '2026-02-01',
  quantity: 1, territory: 'BR', store: 'Spotify', currency: 'USD', gross: 1, net: 1,
}

/** Linha com sub-conta: é o que "cadastra" o artista. */
const conta = (nome: string): OneRpmRawRow => ({ ...base, sourceAccount: `${SELO}: ${nome}` })
/** Linha de vídeo do YouTube: sem sub-conta, sem performers — só o canal. */
const canal = (nomeCanal: string): OneRpmRawRow => ({
  ...base, sourceAccount: SELO, albumChannel: nomeCanal, productType: 'Youtube Video', store: 'YouTube',
})

const ARTISTAS = ['Vitinho Forró', 'Vitinho Santos', 'Vitinho Cachorro', 'Rock Salles', 'Belito', 'Mc Juniinho']

interface Caso {
  canal: string
  esperado: string | null // slug, ou null = deve ficar sem atribuição
  porque: string
}

const CASOS: Caso[] = [
  { canal: 'RockSallesOCamelo', esperado: 'rock-salles', porque: 'prefixo: nome + sufixo grudado' },
  { canal: 'Rock Salle - O Camelô', esperado: 'rock-salles', porque: 'aproximado: falta um "s" em Salles' },
  { canal: 'McJuniinho', esperado: 'mc-juniinho', porque: 'exato a menos de espaço/caixa' },
  { canal: 'Belito', esperado: 'belito', porque: 'exato, nome de uma palavra' },
  { canal: 'VitinhoForroOficial', esperado: 'vitinho-forro', porque: 'prefixo mais longo vence' },
  { canal: 'Vitinho Sanhos', esperado: 'vitinho-santos', porque: 'aproximado: 1 typo na 2ª palavra' },
  { canal: 'Vitinho', esperado: null, porque: 'ambíguo entre 3 Vitinhos — não pode escolher' },
  { canal: 'Vitinho Oficial', esperado: null, porque: '"oficial" não é sobrenome de ninguém' },
  { canal: 'Gustavo Lima', esperado: null, porque: 'artista de fora do selo' },
  { canal: 'Belitu', esperado: null, porque: 'typo em nome curto: risco alto, recusa' },
  { canal: '', esperado: null, porque: 'canal vazio' },
]

const rows: OneRpmRawRow[] = [
  ...ARTISTAS.map(conta),
  ...CASOS.map((c) => canal(c.canal)),
]

const lote = agregarPorArtista(rows)

// Um canal por vez: assim o artista com `origens.canal > 0` é, sem ambiguidade,
// o dono daquela linha.
let falhas = 0
for (const c of CASOS) {
  const l = agregarPorArtista([...ARTISTAS.map(conta), canal(c.canal)])
  const obtido = l.artistas.find((a) => a.origens.canal > 0)?.artistaSlug ?? null
  const ok = obtido === c.esperado
  if (!ok) falhas++
  console.log(
    `${ok ? '✅' : '❌'} "${c.canal || '(vazio)'}"`.padEnd(34),
    `→ ${String(obtido).padEnd(18)}`,
    `esperado ${String(c.esperado).padEnd(18)}`,
    `· ${c.porque}`
  )
}

// A sobra tem de conter exatamente os canais que não podiam ser atribuídos.
const semAtribuicao = CASOS.filter((c) => c.esperado === null).length
console.log(`\nCanais sem atribuição esperados: ${semAtribuicao}`)
console.log(`Linhas em "não atribuído" no lote completo: ${lote.naoAtribuido?.totais.linhas ?? 0}`)
const okSobra = (lote.naoAtribuido?.totais.linhas ?? 0) === semAtribuicao
console.log(okSobra ? '✅ sobra bate' : '❌ sobra não bate')

// ---------------------------------------------------------------------------
// 2. Reconciliação com o roster.
// ---------------------------------------------------------------------------
console.log('\n=== RECONCILIAÇÃO COM O ROSTER ===')

/** Um recorte do roster real, com as grafias divergentes que existem de verdade. */
const ROSTER: ArtistaRoster[] = [
  { slug: 'neto-brito', nome: 'Netto Brito' }, // slug com 1 "t", nome com 2
  { slug: 'filipe-aladim', nome: 'Filipe Aladim' }, // alias: fillipe-aladin
  { slug: 'daniel-vieira', nome: 'Daniel Vieira' }, // alias: danniel-vieira
  { slug: 'rock-salles', nome: 'Rock Salles' },
  { slug: 'o-caca', nome: 'O caça' },
  { slug: 'allan-fernandes', nome: 'allan fernandes' }, // nome minúsculo no roster
]

interface CasoRec {
  nome: string
  slug: string
  esperaSlug: string
  esperaCriado: boolean
  esperaDuplicata?: string
  porque: string
}

const CASOS_REC: CasoRec[] = [
  { nome: 'Netto Brito', slug: 'netto-brito', esperaSlug: 'neto-brito', esperaCriado: false, porque: 'alias confirmado: slug do roster tem 1 "t"' },
  { nome: 'Fillipe Aladin', slug: 'fillipe-aladin', esperaSlug: 'filipe-aladim', esperaCriado: false, porque: 'alias: distância 2, nome não casaria sozinho' },
  { nome: 'Danniel Vieira', slug: 'danniel-vieira', esperaSlug: 'daniel-vieira', esperaCriado: false, porque: 'alias confirmado' },
  { nome: 'Rock Salles', slug: 'rock-salles', esperaSlug: 'rock-salles', esperaCriado: false, porque: 'slug idêntico' },
  { nome: 'O Caça', slug: 'o-caca', esperaSlug: 'o-caca', esperaCriado: false, porque: 'casa por nome, ignorando caixa/acento' },
  { nome: 'Allan Fernandes', slug: 'allan-fernandes', esperaSlug: 'allan-fernandes', esperaCriado: false, porque: 'roster tem o nome em minúsculas' },
  { nome: 'Banda Katukada', slug: 'banda-katukada', esperaSlug: 'banda-katukada', esperaCriado: true, porque: 'realmente novo' },
  { nome: 'Rock Salle', slug: 'rock-salle', esperaSlug: 'rock-salle', esperaCriado: true, esperaDuplicata: 'rock-salles', porque: 'parecido: cria, mas sinaliza — não funde sozinho' },
  { nome: 'Zé da Serra', slug: 'ze-da-serra', esperaSlug: 'ze-da-serra', esperaCriado: true, porque: 'novo e sem parecidos: nenhum aviso' },
]

let falhasRec = 0
const rec = reconciliarArtistas(
  CASOS_REC.map((c) => ({ artistaSlug: c.slug, artistaNome: c.nome })),
  ROSTER
)
for (const c of CASOS_REC) {
  const r = rec.get(c.slug)!
  const ok = r.slug === c.esperaSlug && r.criado === c.esperaCriado && r.possivelDuplicata === c.esperaDuplicata
  if (!ok) falhasRec++
  console.log(
    `${ok ? '✅' : '❌'} ${c.nome.padEnd(18)}`,
    `→ ${r.slug.padEnd(16)}`,
    `${r.criado ? 'CRIA ' : 'reusa'}`,
    `${r.possivelDuplicata ? `⚠️ ${r.possivelDuplicata}` : ''}`.padEnd(18),
    `· ${c.porque}`
  )
}

// Dois artistas do relatório NUNCA podem gravar no mesmo doc de receita, mesmo
// quando convergem pro mesmo slug ("Netto Brito" e "Neto Brito").
const colisao = reconciliarArtistas(
  [
    { artistaSlug: 'netto-brito', artistaNome: 'Netto Brito' },
    { artistaSlug: 'neto-brito', artistaNome: 'Neto Brito' },
  ],
  ROSTER
)
const destinos = Array.from(colisao.values()).map((r) => r.slug)
const sinalizada = Array.from(colisao.values()).some((r) => r.possivelDuplicata)
const okColisao = new Set(destinos).size === destinos.length && sinalizada
console.log(
  `\n${okColisao ? '✅' : '❌'} colisão: destinos distintos (${destinos.join(', ')}) e sinalizada=${sinalizada}`
)
if (!okColisao) falhasRec++

const tudoOk = falhas === 0 && okSobra && falhasRec === 0
console.log(`\n${tudoOk ? '✅ TODOS OS CASOS PASSARAM' : `❌ ${falhas + falhasRec} caso(s) falharam`}`)
process.exit(tudoOk ? 0 : 1)

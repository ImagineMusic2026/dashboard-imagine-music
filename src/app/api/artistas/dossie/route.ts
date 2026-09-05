import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { exigirPermissao } from '@/lib/server-auth'
import {
  linkValido,
  PLATAFORMAS_MIDIA,
  STATUS_CATALOGO,
  type CrescimentoDigital,
  type Evidencia,
  type ExpansaoMercado,
  type MembroEquipe,
  type Patrimonio,
  type PlataformaMidiaPaga,
  type StatusCatalogo,
} from '@/lib/artistas/dossie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dossiê do artista — as alavancas estratégicas do documento "Cadastro-base do
 * projeto/artista" (IAOS).
 *
 * Existe como rota, e não como escrita direta do navegador, por dois motivos:
 * `projetos/{slug}` e `artistas/{slug}` negam escrita pelo client nas regras, e
 * os carimbos de "quem conferiu e quando" precisam vir do SERVIDOR — se viessem
 * no corpo do pedido, qualquer um marcaria um presskit de 2024 como conferido
 * hoje, e o status derivado (ver `@/lib/artistas/dossie`) viraria ficção.
 *
 * ── Permissão por bloco ────────────────────────────────────────────────────
 *
 * O dossiê inteiro exige `editarArtistas`, MENOS o inventário de patrimônio,
 * que exige `contratos`. O motivo é o conteúdo: patrimônio traz titularidade,
 * licenciamento e o parecer "Restrito" — a mesma natureza dos contratos, que já
 * são admin por padrão. Sem essa separação, ligar o dossiê para o marketing
 * abriria licenciamento junto, sem ninguém ter decidido isso.
 */

const CAP_POR_BLOCO = {
  identidade: 'editarArtistas',
  equipe: 'editarArtistas',
  expansao: 'editarArtistas',
  digital: 'editarArtistas',
  patrimonio: 'contratos',
} as const

type Bloco = keyof typeof CAP_POR_BLOCO

const BLOCOS = Object.keys(CAP_POR_BLOCO) as Bloco[]

const slugValido = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s.trim())

/** Texto curto e limpo, ou `null` — nunca `undefined`, que o Firestore recusa. */
function texto(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t || null
}

/**
 * Inteiro não-negativo, ou `null`.
 *
 * O teste de vazio vem ANTES do `Number()` de propósito: `Number('')` é 0, não
 * NaN, então um campo numérico em branco era gravado como zero — e "0 obras
 * registradas" é uma afirmação, enquanto o vazio significa "ninguém levantou
 * ainda". A diferença aparece na tela: o card mostraria um inventário
 * preenchido com zeros para quem só quis salvar o nome da editora.
 */
function inteiro(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const bruto = typeof v === 'string' ? v.trim() : v
  if (bruto === '') return null
  const n = Number(bruto)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

function dataISO(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null
}

/** Até 10 links http(s) — o resto é descartado em silêncio, não recusado. */
function links(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string' && linkValido(x))
    .map((x) => x.trim())
    .slice(0, 10)
}

/**
 * Monta a evidência. O carimbo é do SERVIDOR e só é renovado quando a URL
 * muda ou quando ela é confirmada de novo — reabrir o formulário e salvar sem
 * mexer em nada não deve rejuvenescer um link parado há um ano.
 */
function evidencia(
  v: unknown,
  anterior: Evidencia | null | undefined,
  quem: string,
  agora: string,
): Evidencia | null {
  const url = typeof v === 'string' && linkValido(v) ? v.trim() : null
  if (!url) return null
  if (anterior?.url === url) return anterior
  return { url, atualizadoEm: agora, atualizadoPor: quem }
}

function limparExpansao(
  dados: Record<string, unknown>,
  atual: ExpansaoMercado | undefined,
  quem: string,
  agora: string,
): ExpansaoMercado {
  return {
    agenda: evidencia(dados.agenda, atual?.agenda, quem, agora),
    release: evidencia(dados.release, atual?.release, quem, agora),
    presskit: evidencia(dados.presskit, atual?.presskit, quem, agora),
    notoriedade: evidencia(dados.notoriedade, atual?.notoriedade, quem, agora),
  }
}

function limparDigital(
  dados: Record<string, unknown>,
  atual: CrescimentoDigital | undefined,
  quem: string,
  agora: string,
): CrescimentoDigital {
  const bruto = (dados.midiaPaga ?? {}) as Record<string, unknown>
  const base = evidencia(bruto.url, atual?.midiaPaga, quem, agora)
  if (!base) return { midiaPaga: null }
  const plataforma = PLATAFORMAS_MIDIA.includes(bruto.plataforma as PlataformaMidiaPaga)
    ? (bruto.plataforma as PlataformaMidiaPaga)
    : 'outra'
  return {
    midiaPaga: { ...base, plataforma, periodo: texto(bruto.periodo, 60) },
  }
}

function limparPatrimonio(
  dados: Record<string, unknown>,
  atual: Patrimonio | undefined,
  quem: string,
  agora: string,
): Patrimonio {
  const autoral = (dados.autoral ?? {}) as Record<string, unknown>
  const interpretativo = (dados.interpretativo ?? {}) as Record<string, unknown>
  const fonografico = (dados.fonografico ?? {}) as Record<string, unknown>
  const relacional = (dados.relacional ?? {}) as Record<string, unknown>

  // O status do catálogo é a única exceção à regra "status se deriva": é parecer
  // de titularidade, não atualidade de link. Guarda-se o valor COM data e
  // responsável, e o carimbo só é refeito quando o parecer muda.
  const valorStatus = STATUS_CATALOGO.includes(fonografico.statusCatalogo as StatusCatalogo)
    ? (fonografico.statusCatalogo as StatusCatalogo)
    : null
  const statusAnterior = atual?.fonografico?.statusCatalogo ?? null
  const statusCatalogo = valorStatus
    ? statusAnterior?.valor === valorStatus
      ? statusAnterior
      : { valor: valorStatus, declaradoEm: agora, declaradoPor: quem }
    : null

  return {
    autoral: {
      ipi: texto(autoral.ipi, 40),
      editora: texto(autoral.editora, 120),
      numeroObras: inteiro(autoral.numeroObras),
      sociedade: texto(autoral.sociedade, 80),
      links: links(autoral.links),
      observacoes: texto(autoral.observacoes, 2000),
    },
    interpretativo: {
      ipn: texto(interpretativo.ipn, 40),
      links: links(interpretativo.links),
      observacoes: texto(interpretativo.observacoes, 2000),
    },
    fonografico: {
      fonogramasProdutor: inteiro(fonografico.fonogramasProdutor),
      masters: inteiro(fonografico.masters),
      statusCatalogo,
      links: links(fonografico.links),
      observacoes: texto(fonografico.observacoes, 2000),
    },
    relacional: {
      songDna: typeof relacional.songDna === 'string' && linkValido(relacional.songDna)
        ? relacional.songDna.trim()
        : null,
      colaboracoes: texto(relacional.colaboracoes, 2000),
      conexoes: texto(relacional.conexoes, 2000),
      observacoes: texto(relacional.observacoes, 2000),
    },
  }
}

/** Até 12 responsáveis, com o nome denormalizado para exibir sem ler `users`. */
function limparEquipe(v: unknown): MembroEquipe[] {
  if (!Array.isArray(v)) return []
  const vistos = new Set<string>()
  const saida: MembroEquipe[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const m = item as Record<string, unknown>
    const uid = texto(m.uid, 128)
    if (!uid || vistos.has(uid)) continue
    vistos.add(uid)
    saida.push({ uid, nome: texto(m.nome, 120) ?? uid })
    if (saida.length >= 12) break
  }
  return saida
}

export async function POST(req: Request) {
  let body: { slug?: unknown; bloco?: unknown; dados?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  if (!slugValido(body.slug)) {
    return NextResponse.json({ error: 'Artista inválido.' }, { status: 400 })
  }
  if (typeof body.bloco !== 'string' || !BLOCOS.includes(body.bloco as Bloco)) {
    return NextResponse.json({ error: 'Bloco desconhecido.' }, { status: 400 })
  }
  const bloco = body.bloco as Bloco

  // A permissão é escolhida pelo BLOCO, antes de qualquer escrita.
  const auth = await exigirPermissao(req, CAP_POR_BLOCO[bloco])
  if (auth instanceof NextResponse) return auth

  const slug = body.slug.trim()
  const dados = (body.dados ?? {}) as Record<string, unknown>

  const artista = await adminDb.doc(`artistas/${slug}`).get()
  if (!artista.exists) {
    return NextResponse.json({ error: 'Artista não encontrado.' }, { status: 404 })
  }

  // Nome de quem assina o carimbo. Uma leitura por SALVAMENTO (ação rara), e o
  // e-mail cobre o caso de o perfil não ter nome preenchido.
  const perfil = await adminDb.doc(`users/${auth.uid}`).get()
  const quem = (perfil.data()?.nome as string | undefined)?.trim() || auth.email || auth.uid
  const agora = new Date().toISOString()

  if (bloco === 'identidade') {
    // Vai para `artistas/{slug}`: são fatos públicos do artista, que ele lê no
    // portal. O resto do dossiê é juízo da equipe e mora em `projetos`.
    await adminDb.doc(`artistas/${slug}`).set(
      {
        imagineBio: typeof dados.imagineBio === 'string' && linkValido(dados.imagineBio)
          ? dados.imagineBio.trim()
          : null,
        imagineUp: typeof dados.imagineUp === 'string' && linkValido(dados.imagineUp)
          ? dados.imagineUp.trim()
          : null,
        soundchartsId: texto(dados.soundchartsId, 80),
        entradaIaos: dataISO(dados.entradaIaos),
      },
      { merge: true },
    )
    return NextResponse.json({ ok: true })
  }

  // O inventário mora numa SUBCOLEÇÃO, não num campo do projeto: `projetos/{slug}`
  // libera leitura para toda a equipe (`isStaff()`), e regra do Firestore não
  // esconde campo — um mapa ali dentro entregaria titularidade e licenciamento a
  // quem tem só `editarArtistas`. Ver `PatrimonioDoc` em `@/lib/artistas/client`.
  if (bloco === 'patrimonio') {
    const ref = adminDb.doc(`projetos/${slug}/patrimonio/inventario`)
    // O `atual` vem da MESMA subcoleção — se viesse do doc-pai, `statusAnterior`
    // seria sempre nulo e o parecer do catálogo seria recarimbado com data nova
    // a cada salvamento, que é justamente o que o carimbo existe para evitar.
    const atualPat = (await ref.get()).data() as Patrimonio | undefined
    await ref.set({ slug, ...limparPatrimonio(dados, atualPat, quem, agora) }, { merge: true })
    return NextResponse.json({ ok: true })
  }

  const projetoRef = adminDb.doc(`projetos/${slug}`)
  const atual = (await projetoRef.get()).data() as
    | { expansao?: ExpansaoMercado; digital?: CrescimentoDigital }
    | undefined

  const patch: Record<string, unknown> = { slug }
  if (bloco === 'equipe') patch.equipe = limparEquipe(dados.equipe)
  if (bloco === 'expansao') patch.expansao = limparExpansao(dados, atual?.expansao, quem, agora)
  if (bloco === 'digital') patch.digital = limparDigital(dados, atual?.digital, quem, agora)

  await projetoRef.set(patch, { merge: true })
  return NextResponse.json({ ok: true })
}

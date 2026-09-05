import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { invalidarCachesDeLeitura, memoCurta, memoCurtaPorChave } from '@/lib/cache-leitura'
import type { OneRpmAggregate } from '@/lib/onerpm/types'
import type {
  CrescimentoDigital,
  ExpansaoMercado,
  MembroEquipe,
  Patrimonio,
} from '@/lib/artistas/dossie'

/**
 * Leitura client (Firestore) dos artistas REAIS — o que veio das planilhas.
 *
 * Importante: `artistas` (cadastro/redes) é legível por QUALQUER membro ativo,
 * mas a RECEITA mora numa coleção separada `receitas` (admin-only). Por isso a
 * lista chama `listarArtistas()` pra todo mundo e `listarReceitas()` só p/ admin.
 */

export interface RedeSocialDoc {
  url: string
  id: string | null
  handle: string | null
}

export interface ArtistaDoc {
  slug: string
  nome: string
  genero?: string
  label?: string
  /** Foto do artista (URL) — mostrada no avatar no lugar das iniciais. */
  fotoUrl?: string
  fonteCadastro?: string
  /** Criado por uma importação de receita, sem redes sociais. Limpo ao editar o perfil. */
  pendenteConfiguracao?: boolean
  pendenteDesde?: number
  /**
   * Quantas faixas de `catalogo-faixas` estão atribuídas a este artista.
   *
   * Contador DENORMALIZADO de propósito: a tela do catálogo mostra a cobertura
   * dos 96 artistas de uma vez, e contar ao vivo seria varrer o catálogo inteiro
   * (1.136 docs) a cada abertura — exatamente o que estourou a cota em agosto.
   * Aqui o número vem de graça junto com o roster, que já é cacheado.
   *
   * Quem mantém: `scripts/atribuir-fonogramas.mjs` (lote) e `/api/fonogramas`
   * (a cada cadastro/remoção manual). Ausente = nunca contado, não "zero".
   */
  fonogramas?: number
  redes?: {
    spotify?: RedeSocialDoc | null
    youtube?: RedeSocialDoc | null
    instagram?: RedeSocialDoc | null
    tiktok?: RedeSocialDoc | null
  }

  /* ── Cadastro-base do IAOS (documento da Imagine) ───────────────────────
   *
   * Estes quatro moram AQUI, e não no dossiê da equipe (`projetos/{slug}`),
   * porque são fatos públicos sobre o artista — nada que constranja se ele os
   * vir no portal. A régua é a mesma que separa `redes` das anotações do time.
   */

  /** Página de links do artista (o "Linktree" que a Imagine mantém). */
  imagineBio?: string | null
  /** Perfil no ImagineUp, o app de rede social da Imagine — ainda em construção. */
  imagineUp?: string | null
  /**
   * Id do artista no Soundcharts.
   *
   * Fica vazio enquanto não houver assinatura. Existe desde já porque é ele que
   * destrava consumo (40%) e airplay (20%) do IGE — ver `@/lib/iaos/ige`, que
   * hoje roda com 40% de cobertura por falta exatamente disto.
   */
  soundchartsId?: string | null
  /**
   * Data de entrada no IAOS ('YYYY-MM-DD'), DECLARADA pela equipe.
   *
   * Não dá para derivar de carimbo técnico: o grosso do roster entrou por
   * importação de planilha, que não grava data de criação. Quem sabe quando o
   * artista entrou no acompanhamento é a Imagine.
   */
  entradaIaos?: string | null
}

/**
 * Lado COMERCIAL do cadastro (`projetos/{slug}`) — conta do selo, e-mail do
 * projeto, serviços contratados e anotações da equipe.
 *
 * Mora numa coleção SEPARADA de `artistas` de propósito, pelo mesmo motivo da
 * receita: o artista lê o próprio `artistas/{slug}` no portal (ver firestore.rules),
 * e as "anotações gerais" são notas da equipe SOBRE ele. Regra de documento não
 * esconde campo — só separar resolve.
 */
export interface ProjetoDoc {
  slug: string
  contaArtistaSelo?: string
  emailProjeto?: string
  servicosPrevistos?: string[]
  anotacoesGerais?: string
  /**
   * Mercado ao vivo declarado pela equipe — 10% do IGE (IAOS-DOC-02 v1.2). Mora
   * aqui, e não em `artistas/{slug}`, porque é uma classificação da EQUIPE sobre
   * o projeto (o nível 0 é "mercado praticamente inativo") e o artista lê o
   * próprio cadastro no portal.
   */
  mercadoAoVivo?: {
    nivel: number
    score: number
    declaradoEm: string
    declaradoPor?: string
    declaradoPorEmail?: string | null
    metodologia?: string
    /** Data da AVALIAÇÃO (YYYY-MM-DD) — pode ser anterior ao dia em que foi digitada. */
    avaliadoEm?: string | null
    /** Observação livre da equipe sobre a classificação. */
    observacao?: string | null
  }

  /* ── Dossiê das alavancas estratégicas (ver `@/lib/artistas/dossie`) ─────
   *
   * Três mapas dentro do documento que JÁ EXISTE, e não coleções novas: este
   * doc já é lido e cacheado em todo perfil aberto (dois cards o pedem juntos),
   * então acrescentar campos aqui custa ZERO leitura nova em qualquer tela. Uma
   * coleção paralela lida na lista de artistas custaria 96 leituras por
   * abertura — o padrão que estourou a cota em agosto.
   */

  /** Equipe interna da Imagine que atende este artista. */
  equipe?: MembroEquipe[]
  /** Alavanca Expansão de Mercado: agenda, release, presskit, notoriedade. */
  expansao?: ExpansaoMercado
  /** Alavanca Crescimento Digital: o que não vem de integração (mídia paga). */
  digital?: CrescimentoDigital
}

/**
 * Inventário de Patrimônio Artístico — `projetos/{slug}/patrimonio/inventario`.
 *
 * Mora numa SUBCOLEÇÃO, e não num campo de `projetos/{slug}`, porque a regra do
 * Firestore é por documento e não esconde campo: `projetos/{slug}` libera
 * leitura para `isStaff()`, então um mapa ali dentro chegaria inteiro ao
 * navegador de quem tem `editarArtistas` — inclusive titularidade, licenciamento
 * e o parecer "Restrito", que a decisão de produto reservou a `contratos`.
 * Esconder o bloco na tela não é fronteira; separar o documento é.
 *
 * É o mesmo movimento que os contratos já fizeram, pelo mesmo motivo.
 */
export interface PatrimonioDoc extends Patrimonio {
  slug: string
}

/** Resumo de receita (coleção `receitas`, admin-only). */
export interface ReceitaResumo {
  slug: string
  /** Líquido por moeda original — não somamos moedas; a lista ordena por streams. */
  netPorMoeda: Record<string, number>
  streams: number
  /**
   * Receita do mês de lançamento mais recente (a lista mostra o MÊS, não o total).
   * Ausente em docs ainda não migrados pelo backfill — a lista cai no total nesse caso.
   */
  ultimoMes?: {
    periodoKey: string
    periodo: OneRpmAggregate['periodo']
    netPorMoeda: Record<string, number>
    streams: number
  } | null
}

const PALETA = [
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-rose-500',
  'from-emerald-500 to-cyan-500',
  'from-blue-500 to-indigo-500',
  'from-purple-500 to-pink-500',
  'from-red-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-cyan-400 to-fuchsia-500',
]

/** Gradiente determinístico a partir do slug (mesmo artista, mesma cor sempre). */
export function corAvatarDe(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

/** Iniciais a partir do nome (1ª letra do primeiro e do último nome). */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const a = partes[0]?.[0] ?? '?'
  const b = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0]?.[1] ?? '')
  return (a + b).toUpperCase()
}

async function lerRoster(): Promise<ArtistaDoc[]> {
  const snap = await getDocs(collection(db, 'artistas'))
  return snap.docs
    .map((d) => ({ slug: d.id, ...(d.data() as Omit<ArtistaDoc, 'slug'>) }))
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
}

/**
 * O roster inteiro. Cacheado por um minuto (`memoCurta`): lista, home, busca,
 * alertas e o badge do sino pedem esta MESMA varredura de 85 docs quase juntos —
 * sem o cache, cada um pagava a sua. Quem grava artista chama
 * `invalidarCachesDeLeitura()` e a próxima leitura já vem do Firestore.
 */
export const listarArtistas = memoCurta(lerRoster).ler

/** Uma conta/artista vinculado a uma fonte, para as listas de "ver contas" nas Integrações. */
export interface ContaVinculadaRef {
  slug: string
  nome: string
  /** @username limpo (null quando a fonte não tem handle, ex.: streaming). */
  handle: string | null
  /** Texto secundário opcional (ex.: "12.3K streams"). */
  detalhe?: string | null
}

/** Redes que guardam o vínculo em `redes.<plat>.id` (mesmo formato url/id/handle). */
export type PlataformaRede = 'instagram' | 'tiktok' | 'youtube'

/**
 * Extrai um @username limpo do handle/URL cadastrado (sem importar código
 * server-only). Devolve null quando não há um handle legível — ex.: URLs de
 * canal do YouTube (`/channel/UC…`, `/user/…`, `/c/…`), onde o identificador é
 * opaco e o melhor rótulo é o nome do artista.
 */
export function apelidoDaRede(rede?: { handle?: string | null; url?: string | null } | null): string | null {
  const bruto = rede?.handle ?? rede?.url ?? null
  if (!bruto) return null
  const s = bruto.trim()

  // @handle explícito (também casa youtube.com/@nome, tiktok.com/@nome).
  const at = s.match(/@([A-Za-z0-9._-]+)/)
  if (at) return at[1]

  // URL de rede conhecida: usa o 1º segmento, ignorando "containers" sem handle.
  const url = s.match(/(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\/(.+)$/i)
  if (url) {
    const partes = url[1].split(/[/?#]/).filter(Boolean)
    const containers = new Set(['channel', 'user', 'c'])
    if (!partes.length || containers.has(partes[0].toLowerCase())) return null
    return partes[0]
  }

  // Valor solto (handle sem @ nem URL).
  const limpo = s.replace(/^@+/, '').replace(/\/+$/, '')
  return limpo || null
}

/** Artistas com a conta de uma rede vinculada (`redes.<plat>.id` gravado). */
export async function listarContasVinculadas(plat: PlataformaRede): Promise<ContaVinculadaRef[]> {
  const artistas = await listarArtistas()
  return artistas
    .filter((a) => a.redes?.[plat]?.id)
    .map((a) => ({ slug: a.slug, nome: a.nome, handle: apelidoDaRede(a.redes?.[plat]) }))
}

async function lerArtista(slug: string): Promise<ArtistaDoc | null> {
  const s = await getDoc(doc(db, 'artistas', slug))
  return s.exists() ? { slug: s.id, ...(s.data() as Omit<ArtistaDoc, 'slug'>) } : null
}

const cacheArtista = memoCurtaPorChave(lerArtista, (slug) => slug)

/**
 * Um artista. Cacheado por slug pelo mesmo motivo de `getProjeto`: o perfil e os
 * cards dentro dele pedem o MESMO documento, e sem o cache cada card pagava a
 * sua leitura do doc que a tela já tinha em mãos.
 */
export function getArtista(slug: string): Promise<ArtistaDoc | null> {
  return cacheArtista(slug)
}

async function lerPatrimonio(slug: string): Promise<Patrimonio | null> {
  // Lança `permission-denied` para quem não tem `contratos` — é o comportamento
  // desejado, e quem chama trata como "não tem inventário".
  const s = await getDoc(doc(db, 'projetos', slug, 'patrimonio', 'inventario'))
  return s.exists() ? (s.data() as Patrimonio) : null
}

const cachePatrimonio = memoCurtaPorChave(lerPatrimonio, (slug) => slug)

/** Inventário de patrimônio. SÓ quem tem `contratos` consegue ler (regras). */
export function getPatrimonio(slug: string): Promise<Patrimonio | null> {
  return cachePatrimonio(slug)
}

async function lerProjeto(slug: string): Promise<ProjetoDoc | null> {
  const s = await getDoc(doc(db, 'projetos', slug))
  return s.exists() ? { slug: s.id, ...(s.data() as Omit<ProjetoDoc, 'slug'>) } : null
}

const cacheProjeto = memoCurtaPorChave(lerProjeto, (slug) => slug)

/**
 * Cadastro comercial. As regras só liberam STAFF — pro artista logado no portal
 * isto lança permission-denied, que é exatamente o comportamento desejado. Quem
 * chama trata como "não tem projeto".
 *
 * Cacheado por slug porque o perfil monta DOIS cards que leem este mesmo doc (o
 * de Projeto e o de Estágio, que precisa do mercado ao vivo) — sem isto, abrir
 * um perfil pagaria a leitura duas vezes.
 */
export function getProjeto(slug: string): Promise<ProjetoDoc | null> {
  return cacheProjeto(slug)
}

/**
 * Declara (ou desfaz) o nível de mercado ao vivo do artista. Passa por rota —
 * `projetos` nega escrita pelo client, e o score tem que vir da tabela oficial,
 * não do navegador.
 */
export async function salvarMercadoAoVivo(
  slug: string,
  nivel: number | null,
  extras?: { avaliadoEm?: string | null; observacao?: string | null },
): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  const res = await fetch('/api/artistas/mercado-ao-vivo', {
    method: nivel == null ? 'DELETE' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(nivel == null ? { slug } : { slug, nivel, ...extras }),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Não foi possível salvar a declaração.')
  invalidarCachesDeLeitura()
}

/**
 * Grava um bloco do dossiê do artista (ver `@/lib/artistas/dossie`).
 *
 * Um bloco por chamada de propósito: a permissão é escolhida pelo bloco no
 * servidor — `patrimonio` exige `contratos`, o resto exige `editarArtistas` —, e
 * um salvamento único obrigaria a exigir a permissão mais restrita para tudo.
 */
export async function salvarDossie(
  slug: string,
  bloco: 'identidade' | 'equipe' | 'expansao' | 'digital' | 'patrimonio',
  dados: Record<string, unknown>,
): Promise<void> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  const res = await fetch('/api/artistas/dossie', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, bloco, dados }),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Não foi possível salvar.')
  invalidarCachesDeLeitura()
}

/** Mapa slug -> resumo de receita. Só admin consegue ler (regras). */
export async function listarReceitas(): Promise<Map<string, ReceitaResumo>> {
  const snap = await getDocs(collection(db, 'receitas'))
  const m = new Map<string, ReceitaResumo>()
  snap.docs.forEach((d) => {
    const x = d.data()
    const um = x.ultimoMes
    m.set(d.id, {
      slug: d.id,
      netPorMoeda: (x.totais?.netPorMoeda ?? {}) as Record<string, number>,
      streams: Number(x.streams ?? 0),
      ultimoMes: um
        ? {
            periodoKey: String(um.periodoKey ?? ''),
            periodo: um.periodo ?? { transactionMonths: [], accountedFrom: null, accountedTo: null },
            netPorMoeda: (um.netPorMoeda ?? {}) as Record<string, number>,
            streams: Number(um.streams ?? 0),
          }
        : null,
    })
  })
  return m
}

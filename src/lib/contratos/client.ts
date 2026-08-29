import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurtaPorChave, invalidarCachesDeLeitura } from '@/lib/cache-leitura'

/**
 * Contratos do artista — `projetos/{slug}/contratos/{id}`.
 *
 * Mora sob `projetos` e não sob `artistas` pelo mesmo motivo das anotações e da
 * receita: `artistas/{slug}` é lido pelo PRÓPRIO artista no portal, e contrato é
 * documento da relação comercial, não dado dele pra consultar. Regra do Firestore
 * é por documento — só separar resolve.
 *
 * ## Por que o PDF é um link, e não um upload
 *
 * O projeto não tem Firebase Storage (exigiria o plano Blaze) e a rota serverless
 * da Vercel barra corpo acima de 4,5 MB — um contrato digitalizado passa disso com
 * folga. Então o painel guarda a FICHA (tipo, vigência, percentual, observações) e
 * aponta pro arquivo onde ele já vive: o Drive da Imagine. Mesmo padrão do anexo
 * do questionário de estruturação.
 *
 * O que isso implica na prática: quem abrir o link precisa ter acesso à pasta. Se
 * um dia entrar Storage de verdade, só o campo `arquivoUrl` muda.
 */

export type TipoContrato =
  | 'agenciamento'
  | 'distribuicao'
  | 'edicao'
  | 'empresariamento'
  | 'aditivo'
  | 'outro'

export const tipoContratoMeta: Record<TipoContrato, { label: string }> = {
  agenciamento: { label: 'Agenciamento' },
  distribuicao: { label: 'Distribuição' },
  edicao: { label: 'Edição' },
  empresariamento: { label: 'Empresariamento' },
  aditivo: { label: 'Aditivo' },
  outro: { label: 'Outro' },
}

export const TIPOS_CONTRATO = Object.keys(tipoContratoMeta) as TipoContrato[]

export interface Contrato {
  id: string
  tipo: TipoContrato
  /** Nome próprio quando ajuda a distinguir (ex.: "Aditivo — turnê 2026"). */
  titulo?: string | null
  /** Início da vigência em 'YYYY-MM-DD'. */
  inicio: string
  /** Fim da vigência; `null` = prazo indeterminado. */
  fim?: string | null
  /** Encerrado/rescindido antes do fim previsto. */
  encerrado?: boolean
  /** Link do PDF digitalizado (Drive da Imagine). Ver o cabeçalho deste arquivo. */
  arquivoUrl?: string | null
  /** Percentual do selo, quando o contrato define um. */
  percentual?: number | null
  observacoes?: string | null
  criadoPor?: string
}

export interface DadosContrato {
  tipo: TipoContrato
  titulo?: string | null
  inicio: string
  fim?: string | null
  encerrado?: boolean
  arquivoUrl?: string | null
  percentual?: number | null
  observacoes?: string | null
}

/**
 * Situação derivada das datas — não é campo guardado de propósito: um status
 * gravado envelhece sozinho (o contrato vence sem ninguém tocar no doc) e vira
 * mentira na tela.
 */
export type SituacaoContrato = 'vigente' | 'a-vencer' | 'vencido' | 'encerrado' | 'futuro'

export const situacaoMeta: Record<SituacaoContrato, { label: string; chip: string }> = {
  vigente: { label: 'Vigente', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  'a-vencer': { label: 'A vencer', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  vencido: { label: 'Vencido', chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
  encerrado: { label: 'Encerrado', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
  futuro: { label: 'A iniciar', chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
}

/** Janela em que um contrato já entra como "a vencer" — tempo de renegociar. */
export const DIAS_AVISO = 90

/** Data local de hoje em 'YYYY-MM-DD' (sem conversão de fuso). */
export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias entre duas datas 'YYYY-MM-DD' (b - a). Meio-dia evita pegadinha de fuso. */
export function diasEntre(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  return Math.round(ms / 86_400_000)
}

export function situacaoDe(c: Contrato, hoje = hojeISO()): SituacaoContrato {
  if (c.encerrado) return 'encerrado'
  if (c.inicio && c.inicio > hoje) return 'futuro'
  if (!c.fim) return 'vigente'
  if (c.fim < hoje) return 'vencido'
  return diasEntre(hoje, c.fim) <= DIAS_AVISO ? 'a-vencer' : 'vigente'
}

/** Ordena o que exige atenção primeiro; encerrados e vencidos afundam. */
const PESO: Record<SituacaoContrato, number> = {
  'a-vencer': 0,
  vigente: 1,
  futuro: 2,
  vencido: 3,
  encerrado: 4,
}

function caminho(slug: string) {
  return collection(db, 'projetos', slug, 'contratos')
}

async function lerContratos(slug: string): Promise<Contrato[]> {
  const snap = await getDocs(caminho(slug))
  const hoje = hojeISO()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Contrato, 'id'>) }))
    .sort((a, b) => {
      const p = PESO[situacaoDe(a, hoje)] - PESO[situacaoDe(b, hoje)]
      // Empate na situação: o mais recente primeiro.
      return p !== 0 ? p : (b.inicio ?? '').localeCompare(a.inicio ?? '')
    })
}

const cache = memoCurtaPorChave(lerContratos, (slug) => slug)

/** Contratos de um artista, já ordenados por urgência. */
export function listarContratos(slug: string): Promise<Contrato[]> {
  return cache(slug)
}

function limpar(dados: DadosContrato) {
  const url = dados.arquivoUrl?.trim() || null
  return {
    tipo: dados.tipo,
    titulo: dados.titulo?.trim() || null,
    inicio: dados.inicio,
    fim: dados.fim || null,
    encerrado: !!dados.encerrado,
    arquivoUrl: url,
    percentual:
      typeof dados.percentual === 'number' && Number.isFinite(dados.percentual)
        ? dados.percentual
        : null,
    observacoes: dados.observacoes?.trim() || null,
  }
}

export async function criarContrato(
  slug: string,
  dados: DadosContrato,
  criadoPor: string,
): Promise<void> {
  await addDoc(caminho(slug), {
    ...limpar(dados),
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  invalidarCachesDeLeitura()
}

export async function atualizarContrato(
  slug: string,
  id: string,
  dados: DadosContrato,
): Promise<void> {
  await updateDoc(doc(db, 'projetos', slug, 'contratos', id), {
    ...limpar(dados),
    atualizadoEm: serverTimestamp(),
  })
  invalidarCachesDeLeitura()
}

export async function excluirContrato(slug: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'projetos', slug, 'contratos', id))
  invalidarCachesDeLeitura()
}

/** Aceita só http(s) — o link vira um `href` que a equipe clica. */
export function linkValido(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM-DD' → '12 set 2026' (sem conversão de fuso). */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''} ${a}`
}

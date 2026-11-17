import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta } from '@/lib/cache-leitura'
import { CONFIG_CONTRATOS_PADRAO } from '@/lib/contratos/modelo'
import {
  FORMATOS,
  TIPOS_CONTRATO,
  ehTipoContrato,
  type CampoContrato,
  type ConfigContratos,
  type FormatoCampo,
  type ModeloContrato,
  type QuemPreenche,
} from '@/lib/contratos/tipos'

/**
 * Os modelos de contrato — UM documento, `configuracoes/contratos`.
 *
 * Mesma forma da configuração do quadro de atividades, e pelos mesmos dois
 * motivos:
 *
 * 1. **Uma leitura só, cacheada.** A cota gratuita do Firestore já derrubou o
 *    painel uma vez; nada de uma coleção com um documento por modelo.
 * 2. **Nada que venha do banco é confiável.** Tudo passa por `normalizar()`,
 *    que conserta o que dá e cai no padrão de fábrica no que não dá.
 *
 * Escrita é só do ADMIN (a regra de `configuracoes/{doc}` já era essa). Aqui
 * isso pesa mais do que no quadro: quem edita o modelo escreve o texto de um
 * contrato.
 *
 * O modelo é COPIADO pro contrato na hora de emitir (ver `criarContratoGerado`
 * em `client.ts`). Mudar um modelo aqui nunca mexe no que já foi emitido — e
 * muito menos no que já foi assinado.
 */

const REF = 'configuracoes'
const DOC = 'contratos'

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

function texto(v: unknown, padrao = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : padrao
}

/**
 * Rótulo → chave estável ("Nome completo" → "nome_completo").
 *
 * Sublinhado, e não hífen como no quadro: a chave aqui vai dentro do texto do
 * contrato, entre chaves (`{{nome_completo}}`), e hífen ali lê como traço.
 * Como no quadro, a chave nasce do rótulo e NUNCA é recalculada — ela está
 * escrita no texto do modelo e gravada nos contratos já emitidos.
 */
export function chaveDeCampo(rotulo: string): string {
  const base = rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `campo_${Math.random().toString(36).slice(2, 8)}`
}

/** Chave de modelo, no formato do quadro (hífen) — não vai dentro de texto. */
export function chaveDeModelo(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `modelo-${Math.random().toString(36).slice(2, 8)}`
}

function unicas<T>(itens: T[], chaveDe: (i: T) => string, comChave: (i: T, k: string) => T): T[] {
  const vistas = new Set<string>()
  return itens.map((item) => {
    const original = chaveDe(item)
    let key = original
    let n = 2
    while (vistas.has(key)) key = `${original}_${n++}`
    vistas.add(key)
    return key === original ? item : comChave(item, key)
  })
}

function normalizarCampos(v: unknown): CampoContrato[] {
  if (!Array.isArray(v)) return []
  const campos = v
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => {
      const rotulo = texto(c.rotulo, 'Campo')
      const formato = FORMATOS.includes(c.formato as FormatoCampo)
        ? (c.formato as FormatoCampo)
        : 'texto'
      return {
        chave: texto(c.chave) || chaveDeCampo(rotulo),
        rotulo,
        formato,
        obrigatorio: c.obrigatorio === true,
        // Só 'equipe' explicitamente; o padrão é o artista, que é quem preenche
        // a maior parte da qualificação.
        quemPreenche: (c.quemPreenche === 'equipe' ? 'equipe' : 'artista') as QuemPreenche,
        ajuda: texto(c.ajuda) || null,
      }
    })
  return unicas(
    campos,
    (c) => c.chave,
    (c, chave) => ({ ...c, chave }),
  )
}

function normalizarModelos(v: unknown): ModeloContrato[] {
  if (!Array.isArray(v)) return CONFIG_CONTRATOS_PADRAO.modelos
  const modelos = v
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => {
      const nome = texto(m.nome, 'Modelo')
      return {
        key: texto(m.key) || chaveDeModelo(nome),
        nome,
        tipo: ehTipoContrato(m.tipo) ? m.tipo : TIPOS_CONTRATO[0],
        texto: typeof m.texto === 'string' ? m.texto : '',
        campos: normalizarCampos(m.campos),
      }
    })
  // Lista vazia é legítima: um admin pode apagar o modelo de exemplo e só
  // cadastrar o dele depois. O que não pode é ARRAY quebrado virar tela vazia
  // sem explicação — por isso só o "não é lista" cai no padrão.
  return unicas(
    modelos,
    (m) => m.key,
    (m, key) => ({ ...m, key }),
  )
}

/** Conserta o que veio do banco e completa o que faltar com o padrão de fábrica. */
export function normalizar(bruto: unknown): ConfigContratos {
  const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  return { modelos: normalizarModelos(c.modelos) }
}

/* -------------------------------------------------------------------------- */
/* Leitura e escrita                                                           */
/* -------------------------------------------------------------------------- */

async function lerConfig(): Promise<ConfigContratos> {
  try {
    const snap = await getDoc(doc(db, REF, DOC))
    // Documento inexistente é o caso NORMAL até alguém abrir a configuração
    // pela primeira vez — o painel roda no modelo de fábrica sem gravar nada.
    return snap.exists() ? normalizar(snap.data()) : CONFIG_CONTRATOS_PADRAO
  } catch {
    // Falha de permissão ou de rede não pode deixar a equipe sem modelo.
    return CONFIG_CONTRATOS_PADRAO
  }
}

const cacheConfig = memoCurta(lerConfig)

export function carregarConfigContratos(): Promise<ConfigContratos> {
  return cacheConfig.ler()
}

export function invalidarConfigContratos(): void {
  cacheConfig.invalidar()
}

/**
 * Rede de proteção contra `undefined` — o Firestore o recusa em qualquer campo,
 * e a recusa derruba a escrita inteira com um erro genérico. Mesma guarda do
 * `semUndefined` da configuração do quadro, pelo mesmo histórico.
 */
function semUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(semUndefined) as unknown as T
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v !== undefined) saida[k] = semUndefined(v)
    }
    return saida as T
  }
  return valor
}

/** Salva os modelos (só admin — ver as regras de `configuracoes`). */
export async function salvarConfigContratos(config: ConfigContratos): Promise<void> {
  const limpa = semUndefined(normalizar(config))
  await setDoc(doc(db, REF, DOC), { ...limpa, atualizadoEm: serverTimestamp() })
  invalidarConfigContratos()
}

/** Volta ao modelo de fábrica, sem mexer em nenhum contrato já emitido. */
export async function restaurarModelosPadrao(): Promise<void> {
  await salvarConfigContratos(CONFIG_CONTRATOS_PADRAO)
}

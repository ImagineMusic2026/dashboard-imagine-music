import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta } from '@/lib/cache-leitura'
import {
  CONFIG_PADRAO,
  CORES,
  VISOES,
  type AreaConfig,
  type CampoOpcional,
  type ConfigQuadro,
  type CorChave,
  type EtapaConfig,
  type TemplateDemanda,
  type TipoConfig,
  type Visao,
} from '@/lib/atividades/tipos'

/**
 * Configuração do quadro de atividades — UM documento, `configuracoes/atividades`.
 *
 * Duas coisas explicam este arquivo inteiro:
 *
 * 1. **É uma leitura só, cacheada.** A configuração é lida em toda tela do
 *    quadro, e a cota gratuita do Firestore já derrubou o painel uma vez. Um
 *    documento por sessão (com o cache curto por cima) é o teto que este módulo
 *    se impõe — nada de uma coleção `etapas` com um doc por coluna.
 * 2. **Nada que venha do banco é confiável.** Uma configuração salva pela metade
 *    ou de uma versão anterior não pode deixar o quadro em branco. Por isso tudo
 *    passa por `normalizar()`, que conserta o que dá e cai no padrão de fábrica
 *    no que não dá.
 *
 * Quem pode escrever é só o ADMIN — a regra de `configuracoes/{doc}` já era essa.
 * Mudar as colunas mexe no quadro do time inteiro; não é decisão de quem está
 * tocando uma demanda.
 */

const REF = 'configuracoes'
const DOC = 'atividades'

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

function texto(v: unknown, padrao = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : padrao
}

function corValida(v: unknown, padrao: CorChave = 'cinza'): CorChave {
  return CORES.includes(v as CorChave) ? (v as CorChave) : padrao
}

/**
 * Transforma um rótulo em chave estável ("Em produção" → "em-producao").
 *
 * A chave é o que fica gravado em centenas de demandas, então ela nasce do nome
 * mas NUNCA é recalculada: renomear a coluna depois muda só o `label`.
 */
export function chaveDe(rotulo: string): string {
  const base = rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `item-${Math.random().toString(36).slice(2, 8)}`
}

/** Garante chaves únicas dentro de uma lista (sufixo numérico no repetido). */
function comChavesUnicas<T extends { key: string }>(itens: T[]): T[] {
  const vistas = new Set<string>()
  return itens.map((item) => {
    let key = item.key
    let n = 2
    while (vistas.has(key)) key = `${item.key}-${n++}`
    vistas.add(key)
    return { ...item, key }
  })
}

function normalizarEtapas(v: unknown): EtapaConfig[] {
  if (!Array.isArray(v)) return CONFIG_PADRAO.etapas
  const etapas = v
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => {
      const label = texto(e.label, 'Etapa')
      const wip = typeof e.wip === 'number' && e.wip > 0 ? Math.floor(e.wip) : null
      return {
        key: texto(e.key) || chaveDe(label),
        label,
        cor: corValida(e.cor),
        wip,
        final: e.final === true,
        descricao: texto(e.descricao) || null,
      }
    })
  // Um quadro sem coluna não é um quadro — e um sem coluna final nunca conclui
  // nada, o que quebraria o carimbo de entrega e todos os indicadores. Nos dois
  // casos o padrão de fábrica vale mais que o dado salvo.
  if (!etapas.length) return CONFIG_PADRAO.etapas
  if (!etapas.some((e) => e.final)) etapas[etapas.length - 1].final = true
  return comChavesUnicas(etapas)
}

function normalizarRotulados<T extends TipoConfig | AreaConfig>(v: unknown, padrao: T[]): T[] {
  if (!Array.isArray(v)) return padrao
  const itens = v
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => {
      const label = texto(t.label, 'Item')
      return { key: texto(t.key) || chaveDe(label), label, cor: corValida(t.cor) } as T
    })
  // Lista vazia é legítima aqui: um time pode não usar "tipo" nem "área".
  return comChavesUnicas(itens)
}

function normalizarCampos(v: unknown): Record<CampoOpcional, boolean> {
  const salvo = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const saida = { ...CONFIG_PADRAO.campos }
  for (const campo of Object.keys(saida) as CampoOpcional[]) {
    if (typeof salvo[campo] === 'boolean') saida[campo] = salvo[campo] as boolean
  }
  return saida
}

function normalizarTemplates(v: unknown): TemplateDemanda[] {
  if (!Array.isArray(v)) return CONFIG_PADRAO.templates
  return comChavesUnicas(
    v
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .map((t) => {
        const nome = texto(t.nome, 'Modelo')
        // Lista VAZIA e não `undefined` quando o modelo não tem subtarefas: o
        // Firestore recusa `undefined` em qualquer campo, e um único modelo
        // avulso (como o "Demanda avulsa" do padrão de fábrica) fazia o setDoc
        // inteiro lançar — ou seja, a configuração nunca chegava a salvar.
        // Todos os consumidores testam `etapas?.length`, então [] é equivalente.
        const etapas = Array.isArray(t.etapas)
          ? t.etapas
              .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
              .map((e) => ({
                titulo: texto(e.titulo, 'Etapa'),
                inicioEmDias: Number.isFinite(e.inicioEmDias) ? Math.max(0, Number(e.inicioEmDias)) : 0,
                duracaoEmDias: Number.isFinite(e.duracaoEmDias)
                  ? Math.max(0, Number(e.duracaoEmDias))
                  : 1,
                area: texto(e.area) || null,
                esforco: (texto(e.esforco) || null) as TemplateDemanda['esforco'],
                dependeDoIndice: Number.isFinite(e.dependeDoIndice)
                  ? Number(e.dependeDoIndice)
                  : null,
              }))
          : []
        return {
          key: texto(t.key) || chaveDe(nome),
          nome,
          descricaoModelo: texto(t.descricaoModelo) || null,
          titulo: texto(t.titulo) || null,
          descricao: texto(t.descricao) || null,
          tipo: texto(t.tipo) || null,
          area: texto(t.area) || null,
          prioridade: (texto(t.prioridade) || null) as TemplateDemanda['prioridade'],
          esforco: (texto(t.esforco) || null) as TemplateDemanda['esforco'],
          prazoEmDias: Number.isFinite(t.prazoEmDias) ? Number(t.prazoEmDias) : null,
          etiquetas: Array.isArray(t.etiquetas) ? t.etiquetas.filter((x) => typeof x === 'string') : [],
          checklist: Array.isArray(t.checklist)
            ? t.checklist.filter((x): x is string => typeof x === 'string')
            : [],
          etapas,
        }
      }),
  )
}

function normalizarVisoes(v: unknown): Visao[] {
  const lista = Array.isArray(v) ? v.filter((x): x is Visao => VISOES.includes(x as Visao)) : []
  // Sem nenhuma visão a tela ficaria vazia; o quadro é o mínimo.
  return lista.length ? Array.from(new Set(lista)) : CONFIG_PADRAO.visoes
}

/** Conserta o que veio do banco e completa o que faltar com o padrão de fábrica. */
export function normalizar(bruto: unknown): ConfigQuadro {
  const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const visoes = normalizarVisoes(c.visoes)
  const padraoSalvo = texto(c.visaoPadrao) as Visao
  return {
    etapas: normalizarEtapas(c.etapas),
    tipos: normalizarRotulados(c.tipos, CONFIG_PADRAO.tipos),
    areas: normalizarRotulados(c.areas, CONFIG_PADRAO.areas),
    etiquetas: Array.isArray(c.etiquetas)
      ? Array.from(new Set(c.etiquetas.filter((x): x is string => typeof x === 'string' && !!x.trim())))
      : CONFIG_PADRAO.etiquetas,
    campos: normalizarCampos(c.campos),
    templates: normalizarTemplates(c.templates),
    visoes,
    // A visão padrão tem de estar entre as ligadas — senão a tela abriria numa
    // aba que a própria configuração escondeu.
    visaoPadrao: visoes.includes(padraoSalvo) ? padraoSalvo : visoes[0],
  }
}

/* -------------------------------------------------------------------------- */
/* Leitura e escrita                                                           */
/* -------------------------------------------------------------------------- */

async function lerConfig(): Promise<ConfigQuadro> {
  try {
    const snap = await getDoc(doc(db, REF, DOC))
    // Documento inexistente é o caso NORMAL até alguém abrir a configuração pela
    // primeira vez — o quadro roda inteiro no padrão de fábrica sem gravar nada.
    return snap.exists() ? normalizar(snap.data()) : CONFIG_PADRAO
  } catch {
    // Falha de permissão ou de rede não pode deixar a equipe sem quadro.
    return CONFIG_PADRAO
  }
}

const cacheConfig = memoCurta(lerConfig)

export function carregarConfig(): Promise<ConfigQuadro> {
  return cacheConfig.ler()
}

export function invalidarConfig(): void {
  cacheConfig.invalidar()
}

/**
 * Rede de proteção contra `undefined`.
 *
 * O Firestore recusa `undefined` em QUALQUER campo, e a recusa derruba a escrita
 * inteira com um erro genérico — foi assim que um único modelo sem subtarefas
 * impediu a configuração de salvar, e a tela culpou as regras de segurança.
 * `normalizar()` já não deveria emitir nenhum, mas ele é um mapeador grande sobre
 * dado que vem do formulário: uma varredura barata aqui garante que a próxima
 * chave opcional acrescentada ao formato não repita a história.
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

/** Salva a configuração inteira (só admin — ver as regras de `configuracoes`). */
export async function salvarConfig(config: ConfigQuadro): Promise<void> {
  const limpa = semUndefined(normalizar(config))
  await setDoc(doc(db, REF, DOC), { ...limpa, atualizadoEm: serverTimestamp() })
  invalidarConfig()
}

/** Volta ao padrão de fábrica, sem apagar nenhuma demanda. */
export async function restaurarPadrao(): Promise<void> {
  await salvarConfig(CONFIG_PADRAO)
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { memoCurta, memoCurtaPorChave, invalidarCachesDeLeitura } from '@/lib/cache-leitura'
import {
  hojeISO,
  situacaoDe,
  statusContratoValido,
  type Contrato,
  type DadosContrato,
  type ModeloContrato,
  type SituacaoContrato,
  type StatusContrato,
} from '@/lib/contratos/tipos'
import { limparValores } from '@/lib/contratos/modelo'

/**
 * Contratos do artista — `projetos/{slug}/contratos/{id}`.
 *
 * Mora sob `projetos` e não sob `artistas` pelo mesmo motivo das anotações e da
 * receita: `artistas/{slug}` é lido pelo PRÓPRIO artista no portal, e contrato é
 * documento da relação comercial, não dado dele pra consultar. Regra do Firestore
 * é por documento — só separar resolve.
 *
 * Este arquivo é o IO. Os tipos e as contas (situação, estado, datas, campos do
 * modelo) vivem em `tipos.ts`, que não importa Firebase — a página pública onde
 * o artista assina precisa deles e não pode carregar o SDK. Tudo de lá é
 * reexportado aqui, então quem já importava deste arquivo não muda nada.
 *
 * ## Por que o PDF ANEXADO é um link, e não um upload
 *
 * O projeto não tem Firebase Storage (exigiria o plano Blaze) e a rota serverless
 * da Vercel barra corpo acima de 4,5 MB — um contrato digitalizado passa disso com
 * folga. Então o painel guarda a FICHA (tipo, vigência, percentual, observações) e
 * aponta pro arquivo onde ele já vive: o Drive da Imagine. Mesmo padrão do anexo
 * do questionário de estruturação.
 *
 * O que isso implica na prática: quem abrir o link precisa ter acesso à pasta. Se
 * um dia entrar Storage de verdade, só o campo `arquivoUrl` muda.
 *
 * ## E por que o contrato GERADO não precisa de Storage
 *
 * O emitido pelo painel não é arquivo nenhum: o documento é o texto do modelo
 * copiado pra dentro do doc, mais os valores preenchidos e as duas assinaturas
 * (PNG pequena do traço, em dataURL). O PDF é REGERADO sob demanda a partir
 * disso, pela impressão do navegador — nada fica armazenado, então a decisão de
 * não ter Storage continua de pé.
 */

export * from '@/lib/contratos/tipos'

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

const cacheStatusContrato = memoCurta(async () => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sessão expirada.')

  const resp = await fetch('/api/contratos/status', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error('Não foi possível carregar os status de contrato.')

  const dados = (await resp.json()) as { statusPorSlug: Record<string, StatusContrato> }
  return new Map(Object.entries(dados.statusPorSlug))
})

export const listarStatusContrato = cacheStatusContrato.ler

function caminhoStatus(slug: string) {
  return doc(db, 'projetos', slug, 'acompanhamentoContratual', 'status')
}

export async function lerStatusContrato(slug: string): Promise<StatusContrato | ''> {
  const snap = await getDoc(caminhoStatus(slug))
  const status: unknown = snap.data()?.status
  return statusContratoValido(status) ? status : ''
}

export async function salvarStatusContrato(slug: string, status: StatusContrato): Promise<void> {
  await setDoc(caminhoStatus(slug), { status, atualizadoEm: serverTimestamp() })
  cacheStatusContrato.invalidar()
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

/**
 * Emite um contrato a partir de um modelo.
 *
 * O modelo é COPIADO: o texto e a definição dos campos entram no documento. É a
 * mesma regra dos modelos de projeto do quadro de atividades ("o modelo não vira
 * vínculo — os valores são copiados"), e aqui ela é inegociável. Um contrato
 * assinado não pode mudar uma vírgula porque alguém editou o modelo na
 * configuração depois — e o `hash` gravado na assinatura deixaria de bater.
 *
 * Devolve o id, que é o que amarra o link público a este contrato.
 */
export async function criarContratoGerado(
  slug: string,
  modelo: ModeloContrato,
  dados: DadosContrato,
  valoresEquipe: Record<string, string>,
  criadoPor: string,
): Promise<string> {
  const ref = await addDoc(caminho(slug), {
    ...limpar(dados),
    origem: 'gerado',
    modeloKey: modelo.key,
    modeloNome: modelo.nome,
    // Congela a data do documento. Ver `emitidoEm` em `tipos.ts`.
    emitidoEm: hojeISO(),
    textoModelo: modelo.texto,
    campos: modelo.campos,
    // Só o que a EQUIPE preenche entra agora. O resto é do artista e chega pela
    // rota pública — aqui nem é olhado, pra uma tela do painel não conseguir
    // gravar resposta no lugar dele.
    valores: limparValores(modelo.campos, valoresEquipe, 'equipe'),
    assinaturaArtista: null,
    assinaturaImagine: null,
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  invalidarCachesDeLeitura()
  return ref.id
}

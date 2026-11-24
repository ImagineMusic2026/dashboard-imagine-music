import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { memoCurta } from '@/lib/cache-leitura'
import {
  normalizarCatalogoServicos,
  SERVICOS_PADRAO,
  type ServicoPrevisto,
} from '@/lib/artistas/servicos'

/**
 * O catálogo de **serviços previstos** — UM documento, `configuracoes/artistas`.
 *
 * Pedido da cliente em 11/2026: até então um serviço novo era digitado dentro do
 * cadastro de um artista, e só existia lá — ninguém conseguia marcá-lo em outro.
 * A lista agora é do painel inteiro, editável em **Configurações › Artistas**.
 *
 * Mesma forma da configuração do quadro e dos modelos de contrato, pelos mesmos
 * dois motivos:
 *
 * 1. **Uma leitura só, cacheada.** A cota gratuita do Firestore já derrubou o
 *    painel uma vez; nada de uma coleção com um documento por serviço.
 * 2. **Nada que venha do banco é confiável.** Tudo passa por
 *    `normalizarCatalogoServicos`, que conserta o que dá e cai no padrão de
 *    fábrica no que não dá.
 *
 * Regras (`configuracoes/{doc}` em firestore.rules): leitura de qualquer membro
 * ATIVO, escrita só ADMIN — que é exatamente o "apenas adms podem modificar" do
 * pedido. Marketing segue editando o cadastro do artista e marcando serviços;
 * só não mexe na lista.
 */

const REF = 'configuracoes'
const DOC = 'artistas'

export interface ConfigArtistas {
  servicos: ServicoPrevisto[]
}

export const CONFIG_ARTISTAS_PADRAO: ConfigArtistas = { servicos: SERVICOS_PADRAO }

export function normalizarConfigArtistas(bruto: unknown): ConfigArtistas {
  const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  // `servicosPrevistos` é o nome do campo no artista; aceitar os dois aqui evita
  // que um documento escrito à mão com o nome "errado" apareça como catálogo vazio.
  const bruta = c.servicos ?? c.servicosPrevistos
  return { servicos: normalizarCatalogoServicos(bruta) }
}

/**
 * Lê o documento. REJEITA quando a leitura falha — de propósito.
 *
 * Já devolveu o padrão de fábrica no `catch`, e isso desligava duas proteções
 * ao mesmo tempo: `memoCurta` promete não guardar falha ("o próximo tenta de
 * novo"), mas uma falha convertida em valor fica cacheada 5 minutos como se
 * fosse o catálogo de verdade; e a tela do admin, que salva o array INTEIRO,
 * passava a mostrar os 5 de fábrica como se fossem a lista real — salvar em
 * cima apagava os serviços customizados em silêncio.
 *
 * Quem só quer mostrar caixinhas usa `catalogoServicosOuPadrao`, que escolhe o
 * fallback conscientemente. Quem EDITA usa esta, e mostra o erro.
 */
async function lerConfigArtistas(): Promise<ConfigArtistas> {
  const snap = await getDoc(doc(db, REF, DOC))
  // Documento inexistente é o caso NORMAL até um admin abrir a configuração
  // pela primeira vez — o painel roda no catálogo de fábrica sem gravar nada.
  return snap.exists() ? normalizarConfigArtistas(snap.data()) : CONFIG_ARTISTAS_PADRAO
}

const cacheConfig = memoCurta(lerConfigArtistas)

/** Rejeita se a leitura falhar. Para edição, use esta. */
export function carregarConfigArtistas(): Promise<ConfigArtistas> {
  return cacheConfig.ler()
}

/** Só o catálogo, que é o que quase toda tela quer. Rejeita se falhar. */
export async function carregarCatalogoServicos(): Promise<ServicoPrevisto[]> {
  return (await carregarConfigArtistas()).servicos
}

/**
 * O catálogo para quem só vai MOSTRAR: falha de permissão ou de rede cai no
 * padrão de fábrica em vez de deixar o cadastro sem serviço pra marcar. Nunca
 * rejeita — e por isso nunca deve alimentar uma tela que grava o catálogo.
 */
export async function catalogoServicosOuPadrao(): Promise<ServicoPrevisto[]> {
  try {
    return await carregarCatalogoServicos()
  } catch {
    return SERVICOS_PADRAO
  }
}

export function invalidarConfigArtistas(): void {
  cacheConfig.invalidar()
}

/** Salva o catálogo (só admin — ver as regras de `configuracoes`). */
export async function salvarCatalogoServicos(servicos: ServicoPrevisto[]): Promise<void> {
  const limpo = normalizarCatalogoServicos(servicos)
  await setDoc(
    doc(db, REF, DOC),
    { servicos: limpo, servicosAtualizadoEm: serverTimestamp() },
    { merge: true },
  )
  invalidarConfigArtistas()
}

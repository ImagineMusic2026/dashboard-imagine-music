import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { invalidarAtividades } from '@/lib/atividades/client'

/**
 * Comentários de uma demanda — subcoleção `atividades/{id}/comentarios`.
 *
 * Por que subcoleção e não um array dentro do documento, como o checklist e o
 * histórico: o array chega junto com o quadro, e isso é ótimo pra coisa pequena
 * e limitada. Comentário não é nem uma coisa nem outra — uma demanda tocada por
 * três pessoas durante um mês junta dezenas de parágrafos, e eles viajariam em
 * TODA leitura do quadro, em toda demanda, mesmo com ninguém aberto.
 *
 * O acordo então é: o quadro carrega só o CONTADOR (`qtdComentarios`, gravado
 * junto de cada comentário) pra desenhar o selo do card, e os comentários em si
 * só são lidos quando alguém abre a demanda. Custo de abrir o quadro: zero
 * leitura extra. Custo de abrir uma demanda: uma leitura por comentário dela.
 *
 * O contador é denormalizado, então pode dessincronizar se uma escrita falhar no
 * meio. É de propósito: ele decora um selo, não decide nada. O número certo
 * aparece assim que a demanda é aberta.
 */

export interface Comentario {
  id: string
  texto: string
  autorUid: string
  autorNome: string
  /** ISO — gravado pelo client mesmo, pra ordenar sem esperar o servidor. */
  em: string
  editadoEm?: string | null
}

const COL = 'atividades'
const SUB = 'comentarios'

function refComentarios(atividadeId: string) {
  return collection(db, COL, atividadeId, SUB)
}

/**
 * Comentários da demanda, do mais antigo ao mais novo (ordem de conversa).
 *
 * Sem cache de propósito: é a única leitura do módulo que a pessoa espera ver
 * fresquinha — ela abre a demanda justamente pra saber o que foi dito. E só
 * acontece quando o painel de detalhe abre, então não é ela que pesa na cota.
 */
export async function listarComentarios(atividadeId: string): Promise<Comentario[]> {
  const snap = await getDocs(query(refComentarios(atividadeId), orderBy('em', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comentario, 'id'>) }))
}

export async function comentar(
  atividadeId: string,
  texto: string,
  autor: { uid: string; nome: string },
): Promise<Comentario> {
  const em = new Date().toISOString()
  const dados = { texto: texto.trim(), autorUid: autor.uid, autorNome: autor.nome, em, editadoEm: null }
  const ref = await addDoc(refComentarios(atividadeId), { ...dados, criadoEm: serverTimestamp() })
  await updateDoc(doc(db, COL, atividadeId), { qtdComentarios: increment(1) })
  invalidarAtividades()
  return { id: ref.id, ...dados }
}

export async function editarComentario(
  atividadeId: string,
  comentarioId: string,
  texto: string,
): Promise<string> {
  const editadoEm = new Date().toISOString()
  await updateDoc(doc(db, COL, atividadeId, SUB, comentarioId), { texto: texto.trim(), editadoEm })
  return editadoEm
}

export async function excluirComentario(atividadeId: string, comentarioId: string): Promise<void> {
  await deleteDoc(doc(db, COL, atividadeId, SUB, comentarioId))
  // `increment(-1)` e não "contar de novo": recontar exigiria reler a subcoleção
  // inteira só pra ajustar um selo.
  await updateDoc(doc(db, COL, atividadeId), { qtdComentarios: increment(-1) })
  invalidarAtividades()
}

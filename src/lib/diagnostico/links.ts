import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TipoDiagnostico } from './perguntas'

/**
 * Links PÚBLICOS de preenchimento do questionário de estruturação — pra colher as
 * respostas do artista (ou do empresário) sem liberar acesso ao portal. A equipe
 * gera o link no perfil do artista e manda por WhatsApp; a página `/q/{token}`
 * responde sem login via `/api/questionario-link`.
 *
 * Um link por artista+tipo basta: o mesmo link pode ir pra mais de uma pessoa (é
 * só encaminhar), e todos escrevem no MESMO doc do questionário de todo jeito.
 * Revogar apaga o doc — o link morre na hora.
 *
 * Quem gerencia é quem já preenche o questionário pelo painel (`editarArtistas`,
 * nas regras). O público nunca lê esta coleção: a API valida o token com Admin SDK.
 */

export type LinkQuestionario = {
  token: string
  slug: string
  tipo: TipoDiagnostico
}

const LINKS = 'links-questionario'

/** URL pública que se manda pra pessoa (WhatsApp, e-mail…). */
export function urlDoLinkQuestionario(token: string): string {
  return `${window.location.origin}/q/${token}`
}

/** O link ativo de um artista+tipo, se existir. */
export async function getLinkQuestionario(slug: string, tipo: TipoDiagnostico): Promise<LinkQuestionario | null> {
  const snap = await getDocs(
    query(collection(db, LINKS), where('slug', '==', slug), where('tipo', '==', tipo))
  )
  const d = snap.docs[0]
  if (!d) return null
  return { token: d.id, slug, tipo }
}

/** Cria o link público de um artista+tipo (ou devolve o que já existe). */
export async function criarLinkQuestionario(
  slug: string,
  tipo: TipoDiagnostico,
  criadoPor: string
): Promise<LinkQuestionario> {
  const existente = await getLinkQuestionario(slug, tipo)
  if (existente) return existente
  const token = crypto.randomUUID()
  await setDoc(doc(db, LINKS, token), {
    slug,
    tipo,
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  return { token, slug, tipo }
}

/** Revoga (apaga) um link — quem tiver o endereço passa a ver "link expirado". */
export async function revogarLinkQuestionario(token: string): Promise<void> {
  await deleteDoc(doc(db, LINKS, token))
}

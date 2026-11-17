import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Links PÚBLICOS de assinatura de contrato — pra o artista preencher os dados
 * dele e assinar sem precisar de login no painel. A equipe gera o link no card
 * de contratos e manda por WhatsApp; a página `/c/{token}` responde sem sessão,
 * através de `/api/contrato-link`.
 *
 * Mesmo formato do link do questionário (`diagnostico/links.ts`), com duas
 * diferenças que vêm do que o link faz:
 *
 * - Quem gerencia é quem já cuida de contrato (`podeContratos`), não
 *   `podeEditarArtistas`.
 * - É **um link por contrato**, não por artista: o token aponta pro documento
 *   que vai ser assinado. Dois contratos do mesmo artista são dois links.
 *
 * O público nunca lê esta coleção: quem resolve o token é o Admin SDK, na rota.
 * Revogar apaga o doc — o link morre na hora e a página passa a dizer que não
 * está mais ativo.
 */

export type LinkContrato = {
  token: string
  slug: string
  contratoId: string
}

const LINKS = 'links-contrato'

/** URL pública que se manda pra pessoa (WhatsApp, e-mail…). */
export function urlDoLinkContrato(token: string): string {
  return `${window.location.origin}/c/${token}`
}

/**
 * Os links ativos de um artista, por contrato (`contratoId` → `token`).
 *
 * Uma consulta só pro card inteiro: perguntar contrato a contrato custaria uma
 * leitura por linha, e o card já é da aba mais cara do perfil.
 */
export async function linksDoArtista(slug: string): Promise<Record<string, string>> {
  const snap = await getDocs(query(collection(db, LINKS), where('slug', '==', slug)))
  const porContrato: Record<string, string> = {}
  snap.docs.forEach((d) => {
    const contratoId = d.data()?.contratoId
    if (typeof contratoId === 'string') porContrato[contratoId] = d.id
  })
  return porContrato
}

/** Cria o link público de um contrato (ou devolve o que já existe). */
export async function criarLinkContrato(
  slug: string,
  contratoId: string,
  criadoPor: string,
): Promise<LinkContrato> {
  const existentes = await linksDoArtista(slug)
  const atual = existentes[contratoId]
  if (atual) return { token: atual, slug, contratoId }
  const token = crypto.randomUUID()
  await setDoc(doc(db, LINKS, token), {
    slug,
    contratoId,
    criadoPor,
    criadoEm: serverTimestamp(),
  })
  return { token, slug, contratoId }
}

/** Revoga (apaga) um link — quem tiver o endereço passa a ver "link inativo". */
export async function revogarLinkContrato(token: string): Promise<void> {
  await deleteDoc(doc(db, LINKS, token))
}

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * Configurações gerais do painel (coleção `configuracoes`, doc `geral`).
 *
 * Hoje guarda o WhatsApp que recebe as solicitações de "Vincular redes" do
 * portal do artista. Antes esse número vinha de um env de build
 * (`NEXT_PUBLIC_IMAGINE_WHATSAPP`), que só mudava com redeploy — agora vive no
 * Firestore pra que um admin troque pelo próprio painel (aba Perfil).
 *
 * Regras (firestore.rules): leitura por qualquer membro ATIVO (o artista precisa
 * do número no portal); escrita só ADMIN.
 */

const REF = () => doc(db, 'configuracoes', 'geral')

/**
 * Número de fábrica do WhatsApp de vínculo (formato internacional, só dígitos).
 * Vale até um admin configurar outro no painel — assim o portal já mostra o
 * número certo sem depender de nenhum env nem de gravar nada antes.
 */
export const WHATSAPP_VINCULO_PADRAO = '5575992101600'

/** Só os dígitos de um número (descarta +, espaços, parênteses, traços). */
export function apenasDigitos(numero: string): string {
  return numero.replace(/\D/g, '')
}

/**
 * WhatsApp de vínculo gravado no painel. `null` quando ainda não foi configurado
 * — quem chama decide o fallback (o portal usa `WHATSAPP_VINCULO_PADRAO`).
 */
export async function getWhatsappVinculo(): Promise<string | null> {
  const snap = await getDoc(REF())
  const bruto = snap.exists() ? (snap.data().whatsappVinculo as string | undefined) : undefined
  const digitos = bruto ? apenasDigitos(String(bruto)) : ''
  return digitos || null
}

/**
 * Número EFETIVO do portal: o configurado no painel ou, na falta, o padrão de
 * fábrica. Nunca volta vazio.
 */
export async function getWhatsappVinculoEfetivo(): Promise<string> {
  return (await getWhatsappVinculo()) ?? WHATSAPP_VINCULO_PADRAO
}

/** Grava o WhatsApp do portal (só admin — garantido pelas regras do Firestore). */
export async function setWhatsappVinculo(numero: string): Promise<void> {
  await setDoc(
    REF(),
    {
      whatsappVinculo: apenasDigitos(numero),
      whatsappAtualizadoEm: serverTimestamp(),
      whatsappAtualizadoPor: auth.currentUser?.uid ?? null,
    },
    { merge: true },
  )
}

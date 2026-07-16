import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ehTipoValido, idsValidos, type TipoDiagnostico } from './perguntas'

/**
 * Leitura/escrita do diagnóstico pelo CLIENT SDK — quem responde é o artista, no
 * portal, e as regras do Firestore é que autorizam (mesmo padrão da `agenda`).
 *
 * Caminho: `diagnosticos/{slug}/questionarios/{tipo}`. O slug é um segmento do
 * caminho de propósito: a regra o lê direto de lá (`isArtistaDe(slug)`), sem
 * depender de um campo dentro do doc que o próprio cliente escreve.
 */

export interface DiagnosticoDoc {
  slug: string
  tipo: TipoDiagnostico
  respostas: Record<string, string>
  status: 'rascunho' | 'enviado'
  atualizadoEmMs: number | null
  enviadoEmMs: number | null
}

/** Um texto longo, mas com teto — o campo é livre e vai pro Firestore (1MB/doc). */
export const MAX_RESPOSTA = 5000

const ref = (slug: string, tipo: TipoDiagnostico) => doc(db, 'diagnosticos', slug, 'questionarios', tipo)

const ms = (t: unknown): number | null => (t instanceof Timestamp ? t.toMillis() : null)

/**
 * Descarta o que não é pergunta conhecida e corta o que passa do teto. A validação
 * de verdade é a regra do Firestore (quem pode escrever); isto é higiene — evita
 * que um id renomeado ou um paste gigante entre no doc.
 */
export function limparRespostas(tipo: TipoDiagnostico, respostas: Record<string, string>): Record<string, string> {
  const validos = idsValidos(tipo)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(respostas)) {
    if (!validos.has(k)) continue
    const s = typeof v === 'string' ? v.slice(0, MAX_RESPOSTA) : ''
    out[k] = s
  }
  return out
}

export async function getDiagnostico(slug: string, tipo: TipoDiagnostico): Promise<DiagnosticoDoc | null> {
  if (!ehTipoValido(tipo)) return null
  const s = await getDoc(ref(slug, tipo))
  if (!s.exists()) return null
  const x = s.data()
  return {
    slug,
    tipo,
    respostas: (x.respostas ?? {}) as Record<string, string>,
    status: x.status === 'enviado' ? 'enviado' : 'rascunho',
    atualizadoEmMs: ms(x.atualizadoEm),
    enviadoEmMs: ms(x.enviadoEm),
  }
}

/**
 * Salva as respostas. `merge: true` porque o autosave manda o formulário inteiro a
 * cada pausa — e porque `enviadoEm` não pode ser apagado por um rascunho posterior.
 */
export async function salvarDiagnostico(
  slug: string,
  tipo: TipoDiagnostico,
  respostas: Record<string, string>,
  opcoes: { enviar?: boolean } = {}
): Promise<void> {
  const dados: Record<string, unknown> = {
    slug,
    tipo,
    respostas: limparRespostas(tipo, respostas),
    atualizadoEm: serverTimestamp(),
  }
  if (opcoes.enviar) {
    dados.status = 'enviado'
    dados.enviadoEm = serverTimestamp()
  } else {
    // Voltar a editar depois de enviar derruba pra rascunho — o que a equipe vê é
    // o estado real, não um "enviado" que ficou velho.
    dados.status = 'rascunho'
  }
  await setDoc(ref(slug, tipo), dados, { merge: true })
}

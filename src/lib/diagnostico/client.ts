import { collectionGroup, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ehTipoValido, limparRespostas, MAX_RESPOSTA, type TipoDiagnostico } from './perguntas'

// Higiene das respostas mora em `perguntas.ts` (módulo puro — a API do link público
// também usa); re-exportada aqui porque o form e afins importam deste módulo.
export { limparRespostas, MAX_RESPOSTA }

/**
 * Leitura/escrita do diagnóstico pelo CLIENT SDK — respondem o artista (no portal) e
 * a equipe (no painel), e as regras do Firestore é que autorizam (mesmo padrão da
 * `agenda`).
 *
 * Caminho: `diagnosticos/{slug}/questionarios/{tipo}`. O slug é um segmento do
 * caminho de propósito: a regra o lê direto de lá (`isArtistaDe(slug)`), sem
 * depender de um campo dentro do doc que o próprio cliente escreve.
 */

/**
 * Quem gravou por último. É UM questionário por artista e tipo — o artista responde
 * no portal, a equipe preenche pelo painel quando a resposta veio por fora (reunião,
 * WhatsApp, o formulário antigo), e os dois mexem no mesmo doc.
 *
 * Não é enfeite: sustenta o "respondido pelo artista" do card e segura o alerta
 * quando quem preencheu foi a própria equipe. A regra do Firestore trava o valor —
 * cada lado só consegue gravar o seu.
 */
export type OrigemDiagnostico = 'artista' | 'equipe'

export interface DiagnosticoDoc {
  slug: string
  tipo: TipoDiagnostico
  respostas: Record<string, string>
  status: 'rascunho' | 'enviado'
  /** Doc antigo (anterior ao preenchimento pela equipe) só podia vir do portal. */
  origem: OrigemDiagnostico
  /** Link do questionário ORIGINAL (Drive, Pipefy…), quando a equipe guardou um. */
  arquivoUrl: string
  atualizadoEmMs: number | null
  enviadoEmMs: number | null
}

/** Teto do link do arquivo original: é uma URL, não mais um campo de texto. */
export const MAX_URL = 500

/**
 * O link do questionário original, normalizado. Quem cola um endereço sem esquema
 * (`drive.google.com/…`) quer um link, não um texto — completar com `https://` evita
 * o clique morto, e é o mesmo tipo de gentileza do campo de foto do artista.
 */
export function limparUrlArquivo(valor: string): string {
  const s = valor.trim().slice(0, MAX_URL)
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

const ref = (slug: string, tipo: TipoDiagnostico) => doc(db, 'diagnosticos', slug, 'questionarios', tipo)

const ms = (t: unknown): number | null => (t instanceof Timestamp ? t.toMillis() : null)

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
    origem: x.origem === 'equipe' ? 'equipe' : 'artista',
    arquivoUrl: typeof x.arquivoUrl === 'string' ? x.arquivoUrl : '',
    atualizadoEmMs: ms(x.atualizadoEm),
    enviadoEmMs: ms(x.enviadoEm),
  }
}

/**
 * Todos os questionários que os artistas já ENVIARAM. Alimenta o alerta que avisa a
 * equipe — sem isto, o questionário respondido ficava parado no perfil esperando
 * alguém abrir por acaso.
 *
 * Query de GRUPO (varre `questionarios` de todos os slugs): as regras só liberam pra
 * staff, e pro artista lança permission-denied — que é o esperado, ele nunca chama.
 * Quem usa trata a falha como lista vazia.
 *
 * O filtro de `status` é feito na MEMÓRIA de propósito: `where('status','==',…)` num
 * collectionGroup exige um índice COLLECTION_GROUP explícito, que não dá pra criar
 * pelo código (a service account não tem permissão) — e sem ele a query falha, o
 * `.catch` do chamador engole, e o alerta nunca dispara sem ninguém perceber. Sem o
 * `where` não há índice a criar, e o custo é ler ~2 docs por artista. Se um dia isso
 * pesar, o caminho é criar o índice pelo Console e devolver o filtro pra query.
 */
export async function listarDiagnosticosEnviados(): Promise<DiagnosticoDoc[]> {
  const snap = await getDocs(collectionGroup(db, 'questionarios'))
  return snap.docs
    .filter((d) => d.data().status === 'enviado')
    .map((d) => {
      const x = d.data()
      return {
        // O slug é o id do doc-pai (`diagnosticos/{slug}/questionarios/{tipo}`); o
        // campo `slug` existe e a regra o valida, mas o caminho é a fonte da verdade.
        slug: d.ref.parent.parent?.id ?? String(x.slug ?? ''),
        tipo: (x.tipo === 'projeto' ? 'projeto' : 'artista') as TipoDiagnostico,
        respostas: (x.respostas ?? {}) as Record<string, string>,
        status: 'enviado' as const,
        origem: (x.origem === 'equipe' ? 'equipe' : 'artista') as OrigemDiagnostico,
        arquivoUrl: typeof x.arquivoUrl === 'string' ? x.arquivoUrl : '',
        atualizadoEmMs: ms(x.atualizadoEm),
        enviadoEmMs: ms(x.enviadoEm),
      }
    })
}

/**
 * Salva as respostas. `merge: true` porque o autosave manda o formulário inteiro a
 * cada pausa — e porque `enviadoEm` não pode ser apagado por um rascunho posterior.
 *
 * `origem` diz de quem são as RESPOSTAS, e um palpite errado aqui vira um "respondido
 * pelo artista" mentiroso no card. Omitir é o que marca o save que mexeu SÓ no anexo:
 * autoria e status ficam como estavam — colar o link do arquivo original não é
 * responder o questionário, e não pode derrubar um concluído pra rascunho.
 *
 * `arquivoUrl` só entra no payload quando vem definida — o formulário do ARTISTA não
 * tem o campo, e mandá-la vazia dali apagaria o link que a equipe guardou.
 */
export async function salvarDiagnostico(
  slug: string,
  tipo: TipoDiagnostico,
  respostas: Record<string, string>,
  opcoes: { origem?: OrigemDiagnostico; enviar?: boolean; arquivoUrl?: string }
): Promise<void> {
  const dados: Record<string, unknown> = {
    slug,
    tipo,
    respostas: limparRespostas(tipo, respostas),
    atualizadoEm: serverTimestamp(),
  }
  if (opcoes.arquivoUrl !== undefined) dados.arquivoUrl = limparUrlArquivo(opcoes.arquivoUrl)
  if (opcoes.origem) {
    dados.origem = opcoes.origem
    if (opcoes.enviar) {
      dados.status = 'enviado'
      dados.enviadoEm = serverTimestamp()
    } else {
      // Voltar a editar depois de enviar derruba pra rascunho — o que a equipe vê é
      // o estado real, não um "enviado" que ficou velho.
      dados.status = 'rascunho'
    }
  }
  await setDoc(ref(slug, tipo), dados, { merge: true })
}

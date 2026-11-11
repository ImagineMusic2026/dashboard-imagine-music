import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { listarArtistas } from '@/lib/artistas/client'
import {
  getStatusMeta,
  getStatusOneRpm,
  getStatusTikTok,
  getStatusYouTube,
  listarMetricasSociais,
} from '@/lib/metricas-sociais/client'
import { listarDiagnosticosEnviados } from '@/lib/diagnostico/client'
import { memoCurta } from '@/lib/cache-leitura'
import {
  derivarAlertas,
  derivarAlertasAniversario,
  derivarAlertasCadastro,
  derivarAlertasDiagnostico,
  derivarAlertasOperacionais,
  ordenarAlertas,
  type AlertaDerivado,
  type StatusIntegracoes,
} from './derivar'
import { normalizarVistos, type MapaVistos } from './vistos'

/**
 * Lê o status das 4 integrações para os alertas operacionais. Resiliente: cada
 * leitura que falhar vira null, pra um problema de permissão/transitório numa
 * fonte não derrubar o resto (as leituras exigem staff, igual às métricas).
 */
export async function getStatusIntegracoes(): Promise<StatusIntegracoes> {
  return (await lerStatusIntegracoes()).status
}

/**
 * Como `getStatusIntegracoes`, mas dizendo se alguma leitura FALHOU. O null do
 * status sozinho não diz: ele também é o caso normal de integração que nunca foi
 * configurada (o documento não existe).
 */
async function lerStatusIntegracoes(): Promise<{ status: StatusIntegracoes; falhou: boolean }> {
  let falhou = false
  const seguro = <T>(p: Promise<T>): Promise<T | null> =>
    p.catch(() => {
      falhou = true
      return null
    })
  const [meta, tiktok, youtube, onerpm] = await Promise.all([
    seguro(getStatusMeta()),
    seguro(getStatusTikTok()),
    seguro(getStatusYouTube()),
    seguro(getStatusOneRpm()),
  ])
  return { status: { meta, tiktok, youtube, onerpm }, falhou }
}

export interface AlertasCarregados {
  alertas: AlertaDerivado[]
  /**
   * Toda fonte respondeu. Falso quando uma das leituras resilientes caiu no
   * fallback (integração ou questionários) e os alertas dela faltam na lista.
   * É o que autoriza a poda dos vistos: com a lista incompleta, ela apagaria a
   * marca de alertas que só não vieram desta vez.
   */
  completo: boolean
}

async function derivarTudo(): Promise<AlertasCarregados> {
  let completo = true
  const [mapa, arts, { status: integ, falhou }, diagnosticos] = await Promise.all([
    listarMetricasSociais(),
    listarArtistas(),
    lerStatusIntegracoes(),
    // Resiliente como as integrações: se a query de grupo falhar (permissão, índice
    // ainda subindo), perde-se este alerta — não a página inteira.
    listarDiagnosticosEnviados().catch(() => {
      completo = false
      return []
    }),
  ])
  if (falhou) completo = false
  const nome = new Map(arts.map((a) => [a.slug, a.nome]))
  return {
    completo,
    alertas: ordenarAlertas([
      ...derivarAlertas(mapa, nome),
      ...derivarAlertasCadastro(arts),
      ...derivarAlertasAniversario(arts),
      ...derivarAlertasDiagnostico(diagnosticos, nome),
      ...derivarAlertasOperacionais(integ),
    ]),
  }
}

/**
 * TODOS os alertas abertos (sociais + cadastro + diagnóstico + operacionais), já
 * ordenados por severidade e recência. Fonte única da página de Alertas e do badge
 * do sino — assim os dois números sempre batem.
 *
 * Cacheado por um minuto, e não é detalhe: o badge é renderizado pela sidebar E
 * pela topbar, que montam juntas em toda tela do painel. Sem o cache, cada
 * carregamento varria o roster e as métricas duas vezes só pra escrever um número.
 */
export const carregarAlertasCompleto = memoCurta(derivarTudo).ler

/** Só a lista — para quem não precisa saber se ela veio inteira. */
export async function carregarAlertas(): Promise<AlertaDerivado[]> {
  return (await carregarAlertasCompleto()).alertas
}

/* ── alertas VISTOS (por pessoa) ─────────────────────────────────────────────
 * Documento próprio, `alertas-vistos/{uid}` = { vistos: { chave: ms }, atualizadoEm }.
 * Não é campo do perfil de propósito: o perfil é lido pela equipe inteira e só
 * aceita auto-edição de `favoritos` — a trava que fecha a escalada de papel.
 * As regras deixam só o dono (e só sendo da equipe) ler e gravar o seu.
 */

const VISTOS = 'alertas-vistos'

/** Os vistos da pessoa. Uma leitura por sessão; doc inexistente = nada visto. */
export async function lerAlertasVistos(uid: string): Promise<MapaVistos> {
  const snap = await getDoc(doc(db, VISTOS, uid))
  return normalizarVistos(snap.data()?.vistos)
}

/**
 * Aplica uma mudança sobre o que está GRAVADO e devolve o resultado.
 *
 * Transação, e não gravação do mapa que a tela tem: com o painel aberto em duas
 * abas, a mais velha regravaria o mapa inteiro e apagaria as marcas da outra.
 * `transformar` devolve null quando não há o que mudar (ex.: poda sem nada a
 * podar) — aí não grava nada. O doc é regravado inteiro, SEM merge: com merge os
 * mapas se fundiriam e a poda nunca apagaria uma chave.
 */
export async function atualizarAlertasVistos(
  uid: string,
  transformar: (atual: MapaVistos) => MapaVistos | null,
): Promise<MapaVistos> {
  const ref = doc(db, VISTOS, uid)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const atual = normalizarVistos(snap.data()?.vistos)
    const proximo = transformar(atual)
    if (!proximo) return atual
    tx.set(ref, { vistos: proximo, atualizadoEm: serverTimestamp() })
    return proximo
  })
}

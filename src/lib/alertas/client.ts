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
  derivarAlertasCadastro,
  derivarAlertasDiagnostico,
  derivarAlertasOperacionais,
  ordenarAlertas,
  type AlertaDerivado,
  type StatusIntegracoes,
} from './derivar'

/**
 * Lê o status das 4 integrações para os alertas operacionais. Resiliente: cada
 * leitura que falhar vira null, pra um problema de permissão/transitório numa
 * fonte não derrubar o resto (as leituras exigem staff, igual às métricas).
 */
export async function getStatusIntegracoes(): Promise<StatusIntegracoes> {
  const [meta, tiktok, youtube, onerpm] = await Promise.all([
    getStatusMeta().catch(() => null),
    getStatusTikTok().catch(() => null),
    getStatusYouTube().catch(() => null),
    getStatusOneRpm().catch(() => null),
  ])
  return { meta, tiktok, youtube, onerpm }
}

async function derivarTudo(): Promise<AlertaDerivado[]> {
  const [mapa, arts, integ, diagnosticos] = await Promise.all([
    listarMetricasSociais(),
    listarArtistas(),
    getStatusIntegracoes(),
    // Resiliente como as integrações: se a query de grupo falhar (permissão, índice
    // ainda subindo), perde-se este alerta — não a página inteira.
    listarDiagnosticosEnviados().catch(() => []),
  ])
  const nome = new Map(arts.map((a) => [a.slug, a.nome]))
  return ordenarAlertas([
    ...derivarAlertas(mapa, nome),
    ...derivarAlertasCadastro(arts),
    ...derivarAlertasDiagnostico(diagnosticos, nome),
    ...derivarAlertasOperacionais(integ),
  ])
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
export const carregarAlertas = memoCurta(derivarTudo).ler

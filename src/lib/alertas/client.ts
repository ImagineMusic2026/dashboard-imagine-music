import { listarArtistas } from '@/lib/artistas/client'
import {
  getStatusMeta,
  getStatusOneRpm,
  getStatusTikTok,
  getStatusYouTube,
  listarMetricasSociais,
} from '@/lib/metricas-sociais/client'
import {
  derivarAlertas,
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

/**
 * Carrega TODOS os alertas abertos (sociais + operacionais), já ordenados por
 * severidade e recência. Fonte única da página de Alertas e do badge do sino —
 * assim os dois números sempre batem.
 */
export async function carregarAlertas(): Promise<AlertaDerivado[]> {
  const [mapa, arts, integ] = await Promise.all([
    listarMetricasSociais(),
    listarArtistas(),
    getStatusIntegracoes(),
  ])
  const nome = new Map(arts.map((a) => [a.slug, a.nome]))
  return ordenarAlertas([...derivarAlertas(mapa, nome), ...derivarAlertasOperacionais(integ)])
}

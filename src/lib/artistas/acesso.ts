import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import type { ArtistaDoc } from '@/lib/artistas/client'

/**
 * Nível de acesso/integração de um artista — o quanto dos canais dele a Imagine
 * de fato puxa dado (não só "tem o link").
 *
 * Régua (decidida com a cliente):
 *  - Instagram: métricas via Meta = completo.
 *  - TikTok: conectado (só existe com OAuth) = completo.
 *  - YouTube: público (Data API) = PARCIAL; com Analytics (OAuth) = completo.
 *  - Spotify: NÃO tem API social, mas streams e receita vêm pela **OneRPM** — então
 *    conta como "via OneRPM" quando há streaming do Spotify no snapshot; só link caso
 *    contrário.
 *
 * A barra pesa parcial como meio ponto. Deriva do que a lista/perfil já carregam.
 */

export interface CanalAcesso {
  tipo: PlataformaTipo
  nome: string
  /** Tem link no cadastro (ou, no Spotify, dado da OneRPM) — entra na barra. */
  cadastrado: boolean
  /** Conta como conectado na barra (parcial ou completo). */
  conectado: boolean
  /** Peso na barra: 1 completo, 0.5 parcial, 0 sem dado. */
  peso: number
  /** Rótulo do status pra exibir. */
  rotulo: string
  /** Classe de cor do rótulo. */
  classe: string
}

export interface NivelAcesso {
  canais: CanalAcesso[]
  /** Canais com link/dado (denominador da barra). */
  totalIntegravel: number
  /** Canais com dado fluindo (parcial ou completo). */
  conectados: number
  /** 0..1 — parcial (YouTube só-público) pesa meio ponto. */
  pct: number
}

const temLink = (r?: { url?: string | null; id?: string | null; handle?: string | null } | null): boolean =>
  !!(r?.url || r?.id || r?.handle)

const CL = {
  completo: 'text-emerald-400',
  parcial: 'text-amber-400',
  soLink: 'text-ink-400',
  semLink: 'text-ink-600',
}

/** Deriva o nível de acesso a partir do cadastro de redes + snapshot de métricas. */
export function nivelAcesso(
  redes: ArtistaDoc['redes'] | undefined,
  metricas: MetricasSociaisDoc | null | undefined,
): NivelAcesso {
  const temSpotifyStreaming = !!metricas?.streaming?.porPlataforma?.some((p) =>
    /spotify/i.test(p.plataforma),
  )

  // Spotify: sem API social, mas os streams/receita vêm pela OneRPM.
  const spotify: CanalAcesso = temSpotifyStreaming
    ? { tipo: 'spotify', nome: 'Spotify', cadastrado: true, conectado: true, peso: 1, rotulo: 'via OneRPM', classe: CL.completo }
    : temLink(redes?.spotify)
      ? { tipo: 'spotify', nome: 'Spotify', cadastrado: true, conectado: false, peso: 0, rotulo: 'Só link', classe: CL.soLink }
      : { tipo: 'spotify', nome: 'Spotify', cadastrado: false, conectado: false, peso: 0, rotulo: 'Sem dados', classe: CL.semLink }

  const social = (
    tipo: PlataformaTipo,
    nome: string,
    temLinkRede: boolean,
    conectado: boolean,
  ): CanalAcesso =>
    conectado
      ? { tipo, nome, cadastrado: true, conectado: true, peso: 1, rotulo: 'Completo', classe: CL.completo }
      : temLinkRede
        ? { tipo, nome, cadastrado: true, conectado: false, peso: 0, rotulo: 'Só link', classe: CL.soLink }
        : { tipo, nome, cadastrado: false, conectado: false, peso: 0, rotulo: 'Sem link', classe: CL.semLink }

  const instagram = social('instagram', 'Instagram', temLink(redes?.instagram), !!metricas?.instagram)
  const tiktok = social('tiktok', 'TikTok', temLink(redes?.tiktok), !!metricas?.tiktok)

  // YouTube tem o meio-termo: público (Data API) sem Analytics = parcial.
  const ytLink = temLink(redes?.youtube)
  const youtube: CanalAcesso = metricas?.youtube?.analytics
    ? { tipo: 'youtube', nome: 'YouTube', cadastrado: true, conectado: true, peso: 1, rotulo: 'Completo', classe: CL.completo }
    : metricas?.youtube
      ? { tipo: 'youtube', nome: 'YouTube', cadastrado: true, conectado: true, peso: 0.5, rotulo: 'Parcial', classe: CL.parcial }
      : ytLink
        ? { tipo: 'youtube', nome: 'YouTube', cadastrado: true, conectado: false, peso: 0, rotulo: 'Só link', classe: CL.soLink }
        : { tipo: 'youtube', nome: 'YouTube', cadastrado: false, conectado: false, peso: 0, rotulo: 'Sem link', classe: CL.semLink }

  const canais = [spotify, instagram, tiktok, youtube]
  const noBar = canais.filter((c) => c.cadastrado)
  const soma = noBar.reduce((a, c) => a + c.peso, 0)
  const conectados = noBar.filter((c) => c.conectado).length
  const pct = noBar.length ? soma / noBar.length : 0

  return { canais, totalIntegravel: noBar.length, conectados, pct }
}

/** Rótulo + classe do badge de nível (cabeçalho do card / tooltip da lista). */
export function rotuloNivel(nivel: NivelAcesso): { label: string; classe: string } {
  if (nivel.totalIntegravel === 0)
    return { label: 'Sem integração', classe: 'bg-bg-700/40 text-ink-400 border-bg-700/50' }
  if (nivel.pct >= 0.999)
    return { label: 'Completo', classe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
  if (nivel.pct >= 0.5)
    return { label: 'Parcial', classe: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
  return { label: 'Incompleto', classe: 'bg-orange-500/15 text-orange-300 border-orange-500/30' }
}

/** Gradiente da barra de progresso por nível. */
export function corBarraAcesso(pct: number, totalIntegravel: number): string {
  if (totalIntegravel === 0) return 'from-bg-600 to-bg-600'
  if (pct >= 0.999) return 'from-emerald-500 to-emerald-400'
  if (pct >= 0.5) return 'from-amber-500 to-amber-400'
  return 'from-orange-500 to-amber-500'
}

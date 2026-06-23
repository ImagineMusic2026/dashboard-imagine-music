import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import { formatNumber } from '@/lib/utils'

/**
 * Deriva alertas REAIS a partir dos snapshots de métricas sociais (sem coleção
 * nova; uma única leitura de `metricas-sociais`). Regras v1:
 *  - viralizacao: conteúdo com alta velocidade (crescimento/dia) — precisa de 2+
 *    sincronizações pra ter base de comparação;
 *  - destaque: conteúdo muito acima da mediana do próprio artista;
 *  - sem_postar: o conteúdo mais recente do artista está velho.
 * Crescimento/queda de seguidores e marcos virão depois (precisam da série de
 * histórico por artista).
 */

export type SeveridadeAlerta = 'critico' | 'atencao' | 'oportunidade' | 'operacional'

export interface AlertaDerivado {
  id: string
  artistaSlug: string
  artistaNome: string
  severidade: SeveridadeAlerta
  categoria: string
  descricao: string
  acaoSugerida: string
  /** Link do conteúdo (origem) ou do artista. */
  url: string | null
  /** Timestamp de referência (ms) — pra ordenar por recência. */
  ts: number
}

const DIA = 86_400_000

interface Conteudo {
  id: string
  plataforma: 'youtube' | 'instagram'
  titulo: string
  url: string | null
  publicadoTs: number
  /** Métrica principal (views no YT, curtidas no IG) — base do "acima da média". */
  metrica: number
  /** Crescimento por dia em "pontos de engajamento" — base do "bombando". */
  velDia: number
  crescViews: number | null
  crescCurtidas: number | null
  horas: number | null
}

function normalizar(doc: MetricasSociaisDoc): Conteudo[] {
  const out: Conteudo[] = []

  const yt = doc.youtube
  const agoraYt = yt?.coletadoEm ? Date.parse(yt.coletadoEm) : 0
  for (const v of yt?.videosRecentes ?? []) {
    const horas =
      v.medidoAntesEm && agoraYt ? Math.max(0.05, (agoraYt - Date.parse(v.medidoAntesEm)) / 3_600_000) : null
    const crescViews = v.views != null && v.viewsAntes != null ? Math.max(0, v.views - v.viewsAntes) : null
    out.push({
      id: `yt-${v.id}`,
      plataforma: 'youtube',
      titulo: v.titulo,
      url: v.url,
      publicadoTs: v.publicadoEm ? Date.parse(v.publicadoEm) : 0,
      metrica: v.views ?? 0,
      velDia: horas && crescViews ? (crescViews / horas) * 24 : 0,
      crescViews,
      crescCurtidas: null,
      horas,
    })
  }

  const ig = doc.instagram
  const agoraIg = ig?.coletadoEm ? Date.parse(ig.coletadoEm) : 0
  for (const p of ig?.postsRecentes ?? []) {
    const horas =
      p.medidoAntesEm && agoraIg ? Math.max(0.05, (agoraIg - Date.parse(p.medidoAntesEm)) / 3_600_000) : null
    const crescCurtidas = p.curtidas != null && p.curtidasAntes != null ? Math.max(0, p.curtidas - p.curtidasAntes) : null
    out.push({
      id: `ig-${p.id}`,
      plataforma: 'instagram',
      titulo: p.legenda?.trim() || '(sem legenda)',
      url: p.permalink,
      publicadoTs: p.publicadoEm ? Date.parse(p.publicadoEm) : 0,
      metrica: p.curtidas ?? 0,
      // curtida pesa ~5x uma view, pra a velocidade do IG ser comparável à do YT.
      velDia: horas && crescCurtidas ? (crescCurtidas / horas) * 24 * 5 : 0,
      crescViews: null,
      crescCurtidas,
      horas,
    })
  }

  return out
}

export function derivarAlertas(
  mapa: Map<string, MetricasSociaisDoc>,
  nomePorSlug: Map<string, string>,
): AlertaDerivado[] {
  const out: AlertaDerivado[] = []
  const agora = Date.now()

  for (const [slug, doc] of Array.from(mapa)) {
    const nome = nomePorSlug.get(slug) ?? slug
    const conteudos = normalizar(doc)
    if (!conteudos.length) continue
    const flag = new Set<string>()

    // Sem postar — só quem ficou quieto recentemente (7-21 dias). Dormência
    // crônica (30+ dias) não é "alerta", é estado — evita inundar de críticos.
    const ultimoTs = conteudos.reduce((m, c) => Math.max(m, c.publicadoTs), 0)
    if (ultimoTs > 0) {
      const dias = Math.floor((agora - ultimoTs) / DIA)
      if (dias >= 7 && dias <= 21)
        out.push(mk(`semp-${slug}`, slug, nome, 'atencao', 'sem_postar', `Sem postar há ${dias} dias`, 'Ver artista', `/artistas/${slug}`, ultimoTs))
    }

    const frescos = conteudos.filter((c) => c.publicadoTs > 0 && agora - c.publicadoTs <= 21 * DIA)

    // Bombando — top 2 do artista por velocidade, acima do piso.
    const bombando = frescos.filter((c) => c.velDia >= 3000).sort((a, b) => b.velDia - a.velDia).slice(0, 2)
    for (const c of bombando) {
      flag.add(c.id)
      const cresc = c.plataforma === 'youtube' ? `+${formatNumber(c.crescViews ?? 0)} views` : `+${formatNumber(c.crescCurtidas ?? 0)} curtidas`
      const janela = c.horas ? (c.horas < 1 ? `${Math.round(c.horas * 60)}min` : `${Math.round(c.horas)}h`) : ''
      out.push(mk(`vel-${c.id}`, slug, nome, 'oportunidade', 'viralizacao', `"${corta(c.titulo)}" bombando — ${cresc} em ${janela}`, 'Ver conteúdo', c.url, c.publicadoTs))
    }

    // Destaque — melhor conteúdo muito acima da mediana do artista (por plataforma).
    for (const plat of ['youtube', 'instagram'] as const) {
      const itens = frescos.filter((c) => c.plataforma === plat)
      if (itens.length < 4) continue
      const med = mediana(itens.map((c) => c.metrica))
      if (med <= 0) continue
      const piso = plat === 'youtube' ? 5000 : 1000
      const top = itens
        .filter((c) => !flag.has(c.id) && c.metrica >= med * 3 && c.metrica >= piso)
        .sort((a, b) => b.metrica - a.metrica)
        .slice(0, 1)
      for (const c of top) {
        flag.add(c.id)
        const x = (c.metrica / med).toFixed(1)
        const u = plat === 'youtube' ? 'views' : 'curtidas'
        out.push(mk(`dest-${c.id}`, slug, nome, 'oportunidade', 'destaque', `"${corta(c.titulo)}" ${x}× acima da média do artista — ${formatNumber(c.metrica)} ${u}`, 'Ver conteúdo', c.url, c.publicadoTs))
      }
    }
  }

  // crítico > atenção > oportunidade > operacional; depois mais recente.
  const ordemSev: Record<SeveridadeAlerta, number> = { critico: 0, atencao: 1, oportunidade: 2, operacional: 3 }
  return out.sort((a, b) => ordemSev[a.severidade] - ordemSev[b.severidade] || b.ts - a.ts)
}

function mk(
  id: string,
  artistaSlug: string,
  artistaNome: string,
  severidade: SeveridadeAlerta,
  categoria: string,
  descricao: string,
  acaoSugerida: string,
  url: string | null,
  ts: number,
): AlertaDerivado {
  return { id, artistaSlug, artistaNome, severidade, categoria, descricao, acaoSugerida, url, ts }
}

function corta(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

function mediana(arr: number[]): number {
  const a = [...arr].sort((x, y) => x - y)
  const n = a.length
  if (!n) return 0
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}

import type {
  IntegracaoMetaDoc,
  IntegracaoOneRpmDoc,
  IntegracaoTikTokDoc,
  IntegracaoYouTubeDoc,
  MetricasSociaisDoc,
  StatusIntegracao,
  StreamingSnapshot,
} from '@/lib/metricas-sociais/types'
import { formatNumber } from '@/lib/utils'

/**
 * Deriva alertas REAIS a partir dos snapshots de métricas sociais (sem coleção
 * nova; uma única leitura de `metricas-sociais`). Regras v1:
 *  - viralizacao: conteúdo com alta velocidade (crescimento/dia) — precisa de 2+
 *    sincronizações pra ter base de comparação;
 *  - destaque: conteúdo muito acima da mediana do próprio artista;
 *  - sem_postar: o conteúdo mais recente do artista está velho;
 *  - crescimento/queda/marco de seguidores (delta vs a coleta anterior);
 *  - viralizacao/queda de streaming: momentum de streams da OneRPM (semana vs média).
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

    // Streaming (OneRPM) — momentum de streams; vale mesmo sem conteúdo social.
    if (doc.streaming) alertaStreaming(out, slug, nome, doc.streaming)

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

    // Seguidores — crescimento / queda / marco (delta vs a coleta anterior).
    alertaSeguidores(out, slug, nome, 'instagram', doc.instagram?.seguidores ?? null, doc.instagram?.seguidoresAntes ?? null, doc.instagram?.coletadoEm ?? null, doc.instagram?.seguidoresAntesEm ?? null)
    alertaSeguidores(out, slug, nome, 'youtube', doc.youtube?.inscritos ?? null, doc.youtube?.inscritosAntes ?? null, doc.youtube?.coletadoEm ?? null, doc.youtube?.inscritosAntesEm ?? null)
  }

  return ordenarAlertas(out)
}

/** Prioridade de exibição: crítico > atenção > oportunidade > operacional. */
const ORDEM_SEV: Record<SeveridadeAlerta, number> = { critico: 0, atencao: 1, oportunidade: 2, operacional: 3 }

/** Ordena por severidade e, dentro dela, por recência (mais novo primeiro). */
export function ordenarAlertas(alertas: AlertaDerivado[]): AlertaDerivado[] {
  return [...alertas].sort((a, b) => ORDEM_SEV[a.severidade] - ORDEM_SEV[b.severidade] || b.ts - a.ts)
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

const MARCOS = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000,
  10_000_000,
]

function marcoCruzado(antes: number, atual: number): number | null {
  for (const m of MARCOS) if (antes < m && atual >= m) return m
  return null
}

function alertaSeguidores(
  out: AlertaDerivado[],
  slug: string,
  nome: string,
  plataforma: 'instagram' | 'youtube',
  atual: number | null,
  antes: number | null,
  agoraEm: string | null,
  antesEm: string | null,
): void {
  if (atual == null || antes == null || antes <= 0) return
  const rede = plataforma === 'instagram' ? 'Instagram' : 'YouTube'
  const termo = plataforma === 'instagram' ? 'seguidores' : 'inscritos'
  const ts = agoraEm ? Date.parse(agoraEm) : Date.now()
  const delta = atual - antes
  const pct = delta / antes

  // Marco — cruzou um número redondo desde a última coleta.
  const marco = marcoCruzado(antes, atual)
  if (marco) {
    out.push(mk(`marco-${plataforma}-${slug}`, slug, nome, 'oportunidade', 'marco_seguidores', `Passou de ${formatNumber(marco)} ${termo} no ${rede} — ${formatNumber(atual)} agora!`, 'Ver artista', `/artistas/${slug}`, ts))
  }

  // Crescimento/queda só com janela mínima (evita ruído de coletas próximas).
  const horas = antesEm && agoraEm ? (Date.parse(agoraEm) - Date.parse(antesEm)) / 3_600_000 : 0
  if (horas < 6) return

  if (delta > 0 && pct >= 0.01 && delta >= 100) {
    out.push(mk(`cresc-${plataforma}-${slug}`, slug, nome, 'oportunidade', 'crescimento_seguidores', `Crescimento acelerado no ${rede}: +${formatNumber(delta)} ${termo} (${(pct * 100).toFixed(1)}%)`, 'Ver artista', `/artistas/${slug}`, ts))
  } else if (delta < 0) {
    const queda = -delta
    if (pct <= -0.02)
      out.push(mk(`queda-${plataforma}-${slug}`, slug, nome, 'critico', 'queda_seguidores', `Queda de ${termo} no ${rede}: −${formatNumber(queda)} (${(pct * 100).toFixed(1)}%)`, 'Ver artista', `/artistas/${slug}`, ts))
    else if (pct <= -0.005)
      out.push(mk(`queda-${plataforma}-${slug}`, slug, nome, 'atencao', 'queda_seguidores', `Perdeu ${formatNumber(queda)} ${termo} no ${rede}`, 'Ver artista', `/artistas/${slug}`, ts))
  }
}

/**
 * Alertas de STREAMING (OneRPM): compara os streams da última semana (`streams7d`)
 * com a média semanal das 3 semanas anteriores. Pico forte vira oportunidade;
 * queda forte vira atenção/crítico. Piso de volume evita ruído de artista pequeno.
 */
function alertaStreaming(out: AlertaDerivado[], slug: string, nome: string, st: StreamingSnapshot): void {
  const s28 = st.streams28d ?? 0
  const s7 = st.streams7d ?? 0
  const priorSemana = (s28 - s7) / 3 // média semanal das 3 semanas anteriores
  if (priorSemana < 1000) return // volume baixo demais pra ser sinal confiável
  const pct = (s7 - priorSemana) / priorSemana
  const ts = st.coletadoEm ? Date.parse(st.coletadoEm) : Date.now()

  if (pct >= 0.5) {
    out.push(mk(`str-vir-${slug}`, slug, nome, 'oportunidade', 'viralizacao_streaming', `Streaming disparando: ${formatNumber(s7)} streams na semana (+${(pct * 100).toFixed(0)}% vs média recente)`, 'Ver artista', `/artistas/${slug}`, ts))
  } else if (pct <= -0.4) {
    const sev: SeveridadeAlerta = pct <= -0.6 ? 'critico' : 'atencao'
    out.push(mk(`str-queda-${slug}`, slug, nome, sev, 'queda_streaming', `Streaming em queda: ${(pct * 100).toFixed(0)}% na semana (${formatNumber(s7)} streams)`, 'Ver artista', `/artistas/${slug}`, ts))
  }
}

/* ── alertas OPERACIONAIS (saúde das integrações) ─────────────────────────────
 * Diferente dos demais: NÃO olham a performance do artista, e sim o encanamento.
 * Uma fonte que falhou na última sincronização (status 'erro') ou que parou de
 * atualizar (sync diário sem rodar há tempo demais) vira um alerta de SISTEMA —
 * sem artista. A UI renderiza com um ícone no lugar do avatar. É a categoria
 * "Operacional" prevista no contrato.
 */

export interface StatusIntegracoes {
  meta?: IntegracaoMetaDoc | null
  tiktok?: IntegracaoTikTokDoc | null
  youtube?: IntegracaoYouTubeDoc | null
  onerpm?: IntegracaoOneRpmDoc | null
}

interface FonteStatus {
  chave: string
  nome: string
  status?: StatusIntegracao
  ultimaSincronizacao?: string | null
  erro?: string | null
}

/** Sync diário sem rodar por mais que isto (horas) está claramente parado. */
const HORAS_SYNC_PARADO = 48

export function derivarAlertasOperacionais(integ: StatusIntegracoes): AlertaDerivado[] {
  const fontes: FonteStatus[] = [
    { chave: 'meta', nome: 'Instagram (Meta)', status: integ.meta?.status, ultimaSincronizacao: integ.meta?.ultimaSincronizacao, erro: integ.meta?.erro },
    { chave: 'tiktok', nome: 'TikTok', status: integ.tiktok?.status, ultimaSincronizacao: integ.tiktok?.ultimaSincronizacao, erro: integ.tiktok?.erro },
    { chave: 'youtube', nome: 'YouTube', status: integ.youtube?.status, ultimaSincronizacao: integ.youtube?.ultimaSincronizacao, erro: integ.youtube?.erro },
    { chave: 'onerpm', nome: 'OneRPM', status: integ.onerpm?.status, ultimaSincronizacao: integ.onerpm?.ultimaSincronizacao, erro: integ.onerpm?.erro },
  ]

  const out: AlertaDerivado[] = []
  const agora = Date.now()

  for (const f of fontes) {
    // Sem doc, ou ainda não configurada: é ausência, não falha — a página de
    // Integrações já sinaliza isso. Não polui o feed de alertas.
    if (!f.status || f.status === 'nao_configurado') continue

    const ts = f.ultimaSincronizacao ? Date.parse(f.ultimaSincronizacao) : agora

    if (f.status === 'erro') {
      const motivo = f.erro?.trim()
      out.push(
        mkSistema(
          `op-erro-${f.chave}`,
          f.nome,
          'sync_falhou',
          `Falha na última sincronização${motivo ? `: ${corta(motivo)}` : ''}`,
          ts,
        ),
      )
      continue
    }

    // Conectada, mas sem sincronizar há tempo demais — cron parado/quebrado.
    if (f.ultimaSincronizacao) {
      const horas = (agora - Date.parse(f.ultimaSincronizacao)) / 3_600_000
      if (horas >= HORAS_SYNC_PARADO) {
        const dias = Math.floor(horas / 24)
        out.push(
          mkSistema(
            `op-parado-${f.chave}`,
            f.nome,
            'sync_parado',
            `Sincronização parada há ${dias}d — o sync diário pode ter falhado`,
            ts,
          ),
        )
      }
    }
  }

  return out
}

/** Alerta de SISTEMA (sem artista): a fonte vira o "nome" e o slug é estável. */
function mkSistema(
  id: string,
  fonte: string,
  categoria: string,
  descricao: string,
  ts: number,
): AlertaDerivado {
  return {
    id,
    artistaSlug: `sistema:${id}`,
    artistaNome: fonte,
    severidade: 'operacional',
    categoria,
    descricao,
    acaoSugerida: 'Ver integrações',
    url: '/integracoes',
    ts,
  }
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Eye, Film, Flame, Heart, Layers, MessageCircle, Sparkles } from 'lucide-react'
import { listarArtistas } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { KPICard } from '@/components/shared/kpi-card'
import { cn, formatNumber, formatInt } from '@/lib/utils'

type Plataforma = 'youtube' | 'instagram' | 'tiktok'

const PLAT_META: Record<Plataforma, { nome: string; cor: string }> = {
  youtube: { nome: 'YouTube', cor: 'text-red-400' },
  instagram: { nome: 'Instagram', cor: 'text-fuchsia-400' },
  tiktok: { nome: 'TikTok', cor: 'text-cyan-400' },
}

interface Item {
  key: string
  artistaSlug: string
  artistaNome: string
  plataforma: Plataforma
  titulo: string
  thumbUrl: string | null
  publicadoEm: string | null
  url: string | null
  views: number | null
  curtidas: number | null
  comentarios: number | null
  /** Crescimento desde a medição anterior (null se ainda não há base de comparação). */
  crescViews: number | null
  crescCurtidas: number | null
  crescComentarios: number | null
  /** Horas entre a medição anterior e a atual. */
  horas: number | null
  /** Score de "bombando": engajamento + recência + velocidade. */
  heat: number
}

type Estado = 'load' | 'erro' | 'ok'

export default function ConteudoPage() {
  const [estado, setEstado] = useState<Estado>('load')
  const [itens, setItens] = useState<Item[]>([])
  const [artistasComConteudo, setArtistas] = useState<{ slug: string; nome: string }[]>([])
  const [filtroPlat, setFiltroPlat] = useState<'todas' | Plataforma>('todas')
  const [filtroArtista, setFiltroArtista] = useState('todos')
  const [ordem, setOrdem] = useState<'recentes' | 'destaque'>('destaque')
  const [pagina, setPagina] = useState(1)
  const feedRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [mapa, arts] = await Promise.all([listarMetricasSociais(), listarArtistas()])
        if (!vivo) return
        const nomePorSlug = new Map(arts.map((a) => [a.slug, a.nome]))
        const out: Item[] = []
        for (const [slug, doc] of Array.from(mapa)) {
          const nome = nomePorSlug.get(slug) ?? slug
          const agoraYt = doc.youtube?.coletadoEm ?? null
          for (const v of doc.youtube?.videosRecentes ?? []) {
            out.push(
              montar(slug, nome, 'youtube', {
                titulo: v.titulo,
                thumbUrl: v.thumbUrl,
                publicadoEm: v.publicadoEm,
                url: v.url,
                views: v.views,
                curtidas: v.curtidas,
                comentarios: v.comentarios,
                viewsAntes: v.viewsAntes,
                curtidasAntes: v.curtidasAntes,
                comentariosAntes: v.comentariosAntes,
                medidoAntesEm: v.medidoAntesEm,
                agora: agoraYt,
                id: v.id,
              }),
            )
          }
          const agoraIg = doc.instagram?.coletadoEm ?? null
          for (const p of doc.instagram?.postsRecentes ?? []) {
            out.push(
              montar(slug, nome, 'instagram', {
                titulo: p.legenda?.trim() || '(sem legenda)',
                thumbUrl: p.thumbUrl,
                publicadoEm: p.publicadoEm,
                url: p.permalink,
                views: null,
                curtidas: p.curtidas,
                comentarios: p.comentarios,
                curtidasAntes: p.curtidasAntes,
                comentariosAntes: p.comentariosAntes,
                medidoAntesEm: p.medidoAntesEm,
                agora: agoraIg,
                id: p.id,
              }),
            )
          }
          const agoraTt = doc.tiktok?.coletadoEm ?? null
          for (const v of doc.tiktok?.videosRecentes ?? []) {
            out.push(
              montar(slug, nome, 'tiktok', {
                titulo: v.titulo,
                thumbUrl: v.thumbUrl,
                publicadoEm: v.publicadoEm,
                url: v.url,
                views: v.views,
                curtidas: v.curtidas,
                comentarios: v.comentarios,
                agora: agoraTt,
                id: v.id,
              }),
            )
          }
        }
        setItens(out)
        setArtistas(
          arts
            .filter((a) => out.some((i) => i.artistaSlug === a.slug))
            .map((a) => ({ slug: a.slug, nome: a.nome })),
        )
        setEstado('ok')
      } catch {
        if (vivo) setEstado('erro')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const kpis = useMemo(() => {
    const yt = itens.filter((i) => i.plataforma === 'youtube')
    const ig = itens.filter((i) => i.plataforma === 'instagram')
    const tt = itens.filter((i) => i.plataforma === 'tiktok')
    const soma = (arr: Item[], campo: 'views' | 'curtidas') =>
      arr.reduce((s, i) => s + (i[campo] ?? 0), 0)
    return {
      total: itens.length,
      ytCount: yt.length,
      ytViews: soma(yt, 'views'),
      igCount: ig.length,
      igCurtidas: soma(ig, 'curtidas'),
      ttCount: tt.length,
      ttViews: soma(tt, 'views'),
      artistas: new Set(itens.map((i) => i.artistaSlug)).size,
    }
  }, [itens])

  const bombando = useMemo(
    () => [...itens].sort((a, b) => b.heat - a.heat).slice(0, 10),
    [itens],
  )
  const maisVistos = useMemo(
    () => itens.filter((i) => i.views != null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5),
    [itens],
  )
  const maisComentados = useMemo(
    () => [...itens].sort((a, b) => (b.comentarios ?? 0) - (a.comentarios ?? 0)).slice(0, 5),
    [itens],
  )
  const maisCurtidos = useMemo(
    () => [...itens].sort((a, b) => (b.curtidas ?? 0) - (a.curtidas ?? 0)).slice(0, 5),
    [itens],
  )

  const feed = useMemo(() => {
    let r = itens
    if (filtroPlat !== 'todas') r = r.filter((i) => i.plataforma === filtroPlat)
    if (filtroArtista !== 'todos') r = r.filter((i) => i.artistaSlug === filtroArtista)
    return [...r].sort((a, b) =>
      ordem === 'recentes' ? ts(b.publicadoEm) - ts(a.publicadoEm) : b.heat - a.heat,
    )
  }, [itens, filtroPlat, filtroArtista, ordem])

  // Paginação do feed: 10 por página, pra não despejar centenas de cards de uma vez.
  const POR_PAGINA = 10
  const totalPaginas = Math.max(1, Math.ceil(feed.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const feedVisivel = feed.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  // Volta pra 1ª página sempre que muda filtro ou ordenação.
  useEffect(() => {
    setPagina(1)
  }, [filtroPlat, filtroArtista, ordem])

  const irParaPagina = (p: number) => {
    setPagina(Math.max(1, Math.min(p, totalPaginas)))
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (estado === 'load') {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-16 justify-center">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Carregando conteúdo…
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Não foi possível carregar</h1>
        <p className="text-sm text-ink-400 mt-2">
          Verifique se você é membro ativo e se as regras do Firestore estão deployadas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Conteúdo</h1>
        <p className="text-sm text-ink-400 mt-1">
          O que está bombando e os destaques dos artistas — YouTube, Instagram e TikTok, com dados
          reais.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Conteúdos" value={formatNumber(kpis.total)} icon={Layers} accentColor="violet" subtitle={<span className="text-ink-500">{formatNumber(kpis.artistas)} artistas</span>} />
        <KPICard label="Vídeos (YouTube)" value={formatNumber(kpis.ytCount)} icon={Film} accentColor="amber" subtitle={<span className="text-ink-500">{formatNumber(kpis.ytViews)} views</span>} />
        <KPICard label="Posts (Instagram)" value={formatNumber(kpis.igCount)} icon={Heart} accentColor="emerald" subtitle={<span className="text-ink-500">{formatNumber(kpis.igCurtidas)} curtidas</span>} />
        <KPICard label="Vídeos (TikTok)" value={formatNumber(kpis.ttCount)} icon={Film} accentColor="red" subtitle={<span className="text-ink-500">{formatNumber(kpis.ttViews)} views</span>} />
      </div>

      {/* Bombando agora */}
      {bombando.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-ink-100">Bombando agora</h2>
            <span className="text-[11px] text-ink-500">melhor desempenho recente</span>
          </div>
          <CarrosselDestaques itens={bombando} />
        </section>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankBlock titulo="Mais vistos" icone={<Eye className="w-4 h-4" />} cor="text-red-400" itens={maisVistos} valor={(i) => fmt(i.views)} />
        <RankBlock titulo="Mais comentados" icone={<MessageCircle className="w-4 h-4" />} cor="text-violet-400" itens={maisComentados} valor={(i) => fmt(i.comentarios)} />
        <RankBlock titulo="Mais curtidos" icone={<Heart className="w-4 h-4" />} cor="text-fuchsia-400" itens={maisCurtidos} valor={(i) => fmt(i.curtidas)} />
      </div>

      {/* Feed completo */}
      <section ref={feedRef} className="scroll-mt-24">
        <h2 className="font-bold text-ink-100 mb-3">Todos os conteúdos</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-900 border border-bg-700/40">
            {(['todas', 'youtube', 'instagram', 'tiktok'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setFiltroPlat(p)} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors', filtroPlat === p ? 'bg-violet-500/20 text-violet-200' : 'text-ink-400 hover:text-ink-100')}>
                {p === 'todas' ? 'Todas' : p === 'youtube' ? 'YouTube' : p === 'instagram' ? 'Instagram' : 'TikTok'}
              </button>
            ))}
          </div>
          <select value={filtroArtista} onChange={(e) => setFiltroArtista(e.target.value)} className="w-full sm:w-auto bg-bg-900 border border-bg-700/40 rounded-lg px-3 py-2 text-xs text-ink-200 focus:border-violet-500 focus:outline-none">
            <option value="todos">Todos os artistas</option>
            {artistasComConteudo.map((a) => (
              <option key={a.slug} value={a.slug}>{a.nome}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-900 border border-bg-700/40 ml-auto">
            {(['destaque', 'recentes'] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOrdem(o)} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1', ordem === o ? 'bg-violet-500/20 text-violet-200' : 'text-ink-400 hover:text-ink-100')}>
                {o === 'destaque' && <Sparkles className="w-3 h-3" />}
                {o === 'destaque' ? 'Destaques' : 'Recentes'}
              </button>
            ))}
          </div>
        </div>

        {feed.length === 0 ? (
          <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-8 text-center">
            <p className="text-sm text-ink-300 font-medium">Nenhum conteúdo ainda</p>
            <p className="text-[13px] text-ink-500 mt-1 max-w-md mx-auto">
              Em <span className="text-violet-300">Integrações</span>, rode a sincronização do YouTube, Instagram e TikTok.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feedVisivel.map((i) => (
                <CardConteudo key={i.key} item={i} />
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => irParaPagina(paginaAtual - 1)}
                  disabled={paginaAtual <= 1}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-bg-900 border border-bg-700/40 text-ink-200 hover:bg-bg-800 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-bg-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <span className="text-xs text-ink-400 num px-2 text-center">
                  Página {paginaAtual} de {totalPaginas}
                  <span className="hidden sm:inline text-ink-600"> · {formatInt(feed.length)} conteúdos</span>
                </span>
                <button
                  type="button"
                  onClick={() => irParaPagina(paginaAtual + 1)}
                  disabled={paginaAtual >= totalPaginas}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-bg-900 border border-bg-700/40 text-ink-200 hover:bg-bg-800 hover:text-ink-100 disabled:opacity-40 disabled:hover:bg-bg-900 transition-colors"
                >
                  Próxima <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/* ─── helpers de dados ─── */

function montar(
  slug: string,
  nome: string,
  plataforma: Plataforma,
  d: {
    id: string
    titulo: string
    thumbUrl: string | null
    publicadoEm: string | null
    url: string | null
    views: number | null
    curtidas: number | null
    comentarios: number | null
    viewsAntes?: number | null
    curtidasAntes?: number | null
    comentariosAntes?: number | null
    medidoAntesEm?: string | null
    agora: string | null
  },
): Item {
  const cresc = (atual: number | null, antes: number | null | undefined) =>
    atual != null && antes != null ? Math.max(0, atual - antes) : null
  const crescViews = cresc(d.views, d.viewsAntes)
  const crescCurtidas = cresc(d.curtidas, d.curtidasAntes)
  const crescComentarios = cresc(d.comentarios, d.comentariosAntes)
  const horas =
    d.medidoAntesEm && d.agora
      ? Math.max(0.05, (ts(d.agora) - ts(d.medidoAntesEm)) / 3_600_000)
      : null
  return {
    // Inclui o slug: o mesmo vídeo pode vir em 2 artistas (colab/canal
    // compartilhado), e `plataforma-id` colidiria — keys duplicadas quebram a
    // reconciliação do React (cards stale ao alternar os filtros).
    key: `${slug}-${plataforma}-${d.id}`,
    artistaSlug: slug,
    artistaNome: nome,
    plataforma,
    titulo: d.titulo,
    thumbUrl: d.thumbUrl,
    publicadoEm: d.publicadoEm,
    url: d.url,
    views: d.views,
    curtidas: d.curtidas,
    comentarios: d.comentarios,
    crescViews,
    crescCurtidas,
    crescComentarios,
    horas,
    heat: calcHeat(d.views, d.curtidas, d.comentarios, d.publicadoEm, crescViews, crescCurtidas, crescComentarios, horas),
  }
}

function calcHeat(
  views: number | null,
  curtidas: number | null,
  comentarios: number | null,
  publicadoEm: string | null,
  cv: number | null,
  cc: number | null,
  cco: number | null,
  horas: number | null,
): number {
  const eng = (views ?? 0) * 0.25 + (curtidas ?? 0) + (comentarios ?? 0) * 5
  const ageDias = publicadoEm ? Math.max(0, (Date.now() - ts(publicadoEm)) / 86_400_000) : 30
  const base = eng / (1 + ageDias)
  let vel = 0
  if (horas && horas > 0) {
    const cresc = (cv ?? 0) * 0.25 + (cc ?? 0) + (cco ?? 0) * 5
    if (cresc > 0) vel = (cresc / horas) * 24
  }
  return base + vel * 2
}

/** Badge de crescimento: views (YT) ou curtidas (IG) desde a última medição. */
function crescLabel(i: Item): string | null {
  const c = i.plataforma === 'instagram' ? i.crescCurtidas : i.crescViews
  if (c == null || c <= 0) return null
  const unidade = i.plataforma === 'instagram' ? 'curtidas' : 'views'
  const janela =
    i.horas != null ? ` em ${i.horas < 1 ? `${Math.round(i.horas * 60)}min` : `${Math.round(i.horas)}h`}` : ''
  return `+${formatInt(c)} ${unidade}${janela}`
}

/* ─── componentes ─── */

/**
 * Carrossel horizontal dos destaques ("Bombando agora"): rolagem lateral fluida —
 * arrastar-pra-rolar com inércia no mouse, momentum nativo no trackpad/touch, sem
 * snap "grudento". Setas no desktop, só pro lado que ainda dá pra rolar.
 */
function CarrosselDestaques({ itens }: { itens: Item[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pode, setPode] = useState({ esq: false, dir: false })
  const drag = useRef({ ativo: false, x0: 0, s0: 0, ultimoX: 0, ultimoT: 0, vel: 0, movido: false })
  const raf = useRef(0)

  const aferir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setPode((p) => {
      const esq = el.scrollLeft > 8
      const dir = Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 1
      return p.esq === esq && p.dir === dir ? p : { esq, dir }
    })
  }, [])

  useEffect(() => {
    aferir()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', aferir, { passive: true })
    window.addEventListener('resize', aferir)
    return () => {
      el.removeEventListener('scroll', aferir)
      window.removeEventListener('resize', aferir)
      cancelAnimationFrame(raf.current)
    }
  }, [aferir, itens.length])

  const rolar = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  // Arrastar-pra-rolar com inércia — só no mouse (trackpad/touch já deslizam nativo).
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    const d = drag.current
    d.ativo = true
    d.movido = false
    d.x0 = e.clientX
    d.s0 = el.scrollLeft
    d.ultimoX = e.clientX
    d.ultimoT = performance.now()
    d.vel = 0
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* captura é best-effort */
    }
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d.ativo || !el) return
    const dx = e.clientX - d.x0
    if (Math.abs(dx) > 3) d.movido = true
    el.scrollLeft = d.s0 - dx
    const t = performance.now()
    const dt = t - d.ultimoT
    if (dt > 0) d.vel = (e.clientX - d.ultimoX) / dt
    d.ultimoX = e.clientX
    d.ultimoT = t
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d.ativo || !el) return
    d.ativo = false
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* ponteiro já solto */
    }
    // inércia: continua deslizando com a velocidade final, desacelerando.
    let v = Math.max(-42, Math.min(42, d.vel * 16))
    const deslizar = () => {
      const atual = ref.current
      if (!atual || Math.abs(v) < 0.3) return
      atual.scrollLeft -= v
      v *= 0.95
      raf.current = requestAnimationFrame(deslizar)
    }
    if (Math.abs(v) >= 0.3) raf.current = requestAnimationFrame(deslizar)
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          if (drag.current.movido) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className="flex gap-4 overflow-x-auto overscroll-x-contain pb-2 cursor-grab active:cursor-grabbing select-none"
      >
        {itens.map((i) => (
          <div key={i.key} className="shrink-0 w-[270px] sm:w-[300px]">
            <CardConteudo item={i} destaque />
          </div>
        ))}
      </div>
      {pode.esq && (
        <button
          type="button"
          aria-label="Ver anteriores"
          onClick={() => rolar(-1)}
          className="hidden sm:grid place-items-center absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-bg-950/85 backdrop-blur border border-bg-700/60 text-ink-200 hover:bg-bg-800 hover:text-ink-100 transition-colors shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {pode.dir && (
        <button
          type="button"
          aria-label="Ver próximos"
          onClick={() => rolar(1)}
          className="hidden sm:grid place-items-center absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-bg-950/85 backdrop-blur border border-bg-700/60 text-ink-200 hover:bg-bg-800 hover:text-ink-100 transition-colors shadow-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

function CardConteudo({ item: i, destaque }: { item: Item; destaque?: boolean }) {
  const plat = PLAT_META[i.plataforma]
  const cresc = destaque ? crescLabel(i) : null
  const conteudo = (
    <>
      <div className="relative aspect-video bg-bg-950 overflow-hidden">
        <ThumbImg src={i.thumbUrl} plataforma={i.plataforma} />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-bg-950/75 backdrop-blur-sm text-[10px] font-semibold text-ink-100">
          <span className={cn('w-3.5 h-3.5 block', plat.cor)}>
            <PlataformaIcon tipo={i.plataforma as PlataformaTipo} />
          </span>
          {plat.nome}
        </span>
        {cresc && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/90 text-[10px] font-bold text-bg-950">
            <Flame className="w-3 h-3" />
            {cresc}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase truncate">{i.artistaNome}</div>
        <p className="text-sm text-ink-100 font-medium mt-1 line-clamp-2 min-h-[2.5rem]">{i.titulo}</p>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-400">
          {i.views != null && (
            <span className="flex items-center gap-1 num"><Eye className="w-3.5 h-3.5 text-ink-500" />{formatInt(i.views)}</span>
          )}
          <span className="flex items-center gap-1 num"><Heart className="w-3.5 h-3.5 text-ink-500" />{fmt(i.curtidas)}</span>
          <span className="flex items-center gap-1 num"><MessageCircle className="w-3.5 h-3.5 text-ink-500" />{fmt(i.comentarios)}</span>
          <span className="num text-ink-600 ml-auto">{tempoRel(i.publicadoEm)}</span>
        </div>
      </div>
    </>
  )
  const classe = 'group block bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden hover:border-violet-500/40 transition-colors'
  return i.url ? (
    <a href={i.url} target="_blank" rel="noopener noreferrer" className={classe}>{conteudo}</a>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

function RankBlock({
  titulo,
  icone,
  cor,
  itens,
  valor,
}: {
  titulo: string
  icone: ReactNode
  cor: string
  itens: Item[]
  valor: (i: Item) => string
}) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-bg-700/30 flex items-center gap-2">
        <span className={cn('w-4 h-4 block', cor)}>{icone}</span>
        <span className="font-bold text-sm text-ink-100">{titulo}</span>
      </div>
      {itens.length === 0 ? (
        <div className="p-4 text-xs text-ink-500">Sem dados ainda.</div>
      ) : (
        <div className="divide-y divide-bg-700/30">
          {itens.map((i, idx) => (
            <a
              key={i.key}
              href={i.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-800/40 transition-colors"
            >
              <span className="num text-sm font-bold text-ink-600 w-4 text-center shrink-0">{idx + 1}</span>
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-bg-950 shrink-0">
                <ThumbImg src={i.thumbUrl} plataforma={i.plataforma} />
                <span
                  title={PLAT_META[i.plataforma].nome}
                  className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-bg-950/85 backdrop-blur-sm grid place-items-center"
                >
                  <span className={cn('w-2.5 h-2.5 block', PLAT_META[i.plataforma].cor)}>
                    <PlataformaIcon tipo={i.plataforma as PlataformaTipo} />
                  </span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink-100 font-medium truncate">{i.titulo}</div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wide truncate">{i.artistaNome}</div>
              </div>
              <div className="num text-sm font-bold text-ink-100 shrink-0">{valor(i)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function ThumbImg({ src, plataforma }: { src: string | null; plataforma: Plataforma }) {
  const [erro, setErro] = useState(false)
  const grad =
    plataforma === 'youtube'
      ? 'from-red-500/25 to-rose-700/15'
      : plataforma === 'tiktok'
        ? 'from-cyan-500/25 to-sky-700/15'
        : 'from-fuchsia-500/25 to-amber-500/15'
  if (!src || erro) {
    return (
      <div className={cn('absolute inset-0 grid place-items-center bg-gradient-to-br', grad)}>
        <span className="w-6 h-6 block text-white/60">
          <PlataformaIcon tipo={plataforma as PlataformaTipo} />
        </span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}

function ts(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0
}

function fmt(n: number | null | undefined): string {
  return n == null ? '—' : formatInt(n)
}

function tempoRel(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d}d`
  if (d < 30) return `há ${Math.floor(d / 7)}sem`
  const mes = Math.floor(d / 30)
  if (mes < 12) return `há ${mes}m`
  return `há ${Math.floor(mes / 12)}a`
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, Film, Heart, Layers, MessageCircle, Sparkles, Users } from 'lucide-react'
import { listarArtistas } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { KPICard } from '@/components/shared/kpi-card'
import { cn, formatNumber } from '@/lib/utils'

type Plataforma = 'youtube' | 'instagram'

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
  /** Para ordenar por destaque: views (YT) ou curtidas+comentários (IG). */
  score: number
}

type Estado = 'load' | 'erro' | 'ok'

export default function ConteudoPage() {
  const [estado, setEstado] = useState<Estado>('load')
  const [itens, setItens] = useState<Item[]>([])
  const [artistasComConteudo, setArtistas] = useState<{ slug: string; nome: string }[]>([])
  const [filtroPlat, setFiltroPlat] = useState<'todas' | Plataforma>('todas')
  const [filtroArtista, setFiltroArtista] = useState('todos')
  const [ordem, setOrdem] = useState<'recentes' | 'destaque'>('recentes')

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
          for (const v of doc.youtube?.videosRecentes ?? []) {
            out.push({
              key: `yt-${v.id}`,
              artistaSlug: slug,
              artistaNome: nome,
              plataforma: 'youtube',
              titulo: v.titulo,
              thumbUrl: v.thumbUrl,
              publicadoEm: v.publicadoEm,
              url: v.url,
              views: v.views,
              curtidas: v.curtidas,
              comentarios: v.comentarios,
              score: v.views ?? 0,
            })
          }
          for (const p of doc.instagram?.postsRecentes ?? []) {
            out.push({
              key: `ig-${p.id}`,
              artistaSlug: slug,
              artistaNome: nome,
              plataforma: 'instagram',
              titulo: p.legenda?.trim() || '(sem legenda)',
              thumbUrl: p.thumbUrl,
              publicadoEm: p.publicadoEm,
              url: p.permalink,
              views: null,
              curtidas: p.curtidas,
              comentarios: p.comentarios,
              score: (p.curtidas ?? 0) + (p.comentarios ?? 0),
            })
          }
        }
        const comConteudo = arts
          .filter((a) => out.some((i) => i.artistaSlug === a.slug))
          .map((a) => ({ slug: a.slug, nome: a.nome }))
        setItens(out)
        setArtistas(comConteudo)
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
    const soma = (arr: Item[], campo: 'views' | 'curtidas') =>
      arr.reduce((s, i) => s + (i[campo] ?? 0), 0)
    return {
      total: itens.length,
      ytCount: yt.length,
      ytViews: soma(yt, 'views'),
      igCount: ig.length,
      igCurtidas: soma(ig, 'curtidas'),
      artistas: new Set(itens.map((i) => i.artistaSlug)).size,
    }
  }, [itens])

  const filtrados = useMemo(() => {
    let r = itens
    if (filtroPlat !== 'todas') r = r.filter((i) => i.plataforma === filtroPlat)
    if (filtroArtista !== 'todos') r = r.filter((i) => i.artistaSlug === filtroArtista)
    return [...r].sort((a, b) =>
      ordem === 'recentes' ? ts(b.publicadoEm) - ts(a.publicadoEm) : b.score - a.score,
    )
  }, [itens, filtroPlat, filtroArtista, ordem])

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
          Vídeos do YouTube e posts do Instagram dos artistas — dados reais coletados na
          sincronização.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Conteúdos"
          value={formatNumber(kpis.total)}
          icon={Layers}
          accentColor="violet"
          subtitle={<span className="text-ink-500">YouTube + Instagram</span>}
        />
        <KPICard
          label="Vídeos (YouTube)"
          value={formatNumber(kpis.ytCount)}
          icon={Film}
          accentColor="amber"
          subtitle={<span className="text-ink-500">{formatNumber(kpis.ytViews)} views</span>}
        />
        <KPICard
          label="Posts (Instagram)"
          value={formatNumber(kpis.igCount)}
          icon={Heart}
          accentColor="emerald"
          subtitle={<span className="text-ink-500">{formatNumber(kpis.igCurtidas)} curtidas</span>}
        />
        <KPICard
          label="Artistas com conteúdo"
          value={formatNumber(kpis.artistas)}
          icon={Users}
          accentColor="violet"
        />
      </div>

      {/* Toolbar: filtros + ordenação */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-900 border border-bg-700/40">
          {(['todas', 'youtube', 'instagram'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFiltroPlat(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize',
                filtroPlat === p
                  ? 'bg-violet-500/20 text-violet-200'
                  : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {p === 'todas' ? 'Todas' : p === 'youtube' ? 'YouTube' : 'Instagram'}
            </button>
          ))}
        </div>

        <select
          value={filtroArtista}
          onChange={(e) => setFiltroArtista(e.target.value)}
          className="bg-bg-900 border border-bg-700/40 rounded-lg px-3 py-2 text-xs text-ink-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="todos">Todos os artistas</option>
          {artistasComConteudo.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.nome}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-900 border border-bg-700/40 ml-auto">
          {(['recentes', 'destaque'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrdem(o)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1',
                ordem === o ? 'bg-violet-500/20 text-violet-200' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {o === 'destaque' && <Sparkles className="w-3 h-3" />}
              {o === 'recentes' ? 'Recentes' : 'Destaques'}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-8 text-center">
          <p className="text-sm text-ink-300 font-medium">Nenhum conteúdo ainda</p>
          <p className="text-[13px] text-ink-500 mt-1 max-w-md mx-auto">
            Em <span className="text-violet-300">Integrações</span>, rode a sincronização do YouTube
            e do Instagram. Os vídeos e posts recentes dos artistas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((i) => (
            <CardConteudo key={i.key} item={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function CardConteudo({ item: i }: { item: Item }) {
  const cor = i.plataforma === 'youtube' ? 'text-red-400' : 'text-fuchsia-400'
  const conteudo = (
    <>
      <div className="relative aspect-video bg-bg-950 overflow-hidden">
        <ThumbImg src={i.thumbUrl} plataforma={i.plataforma} />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-bg-950/75 backdrop-blur-sm text-[10px] font-semibold text-ink-100">
          <span className={cn('w-3.5 h-3.5 block', cor)}>
            <PlataformaIcon tipo={i.plataforma as PlataformaTipo} />
          </span>
          {i.plataforma === 'youtube' ? 'YouTube' : 'Instagram'}
        </span>
      </div>
      <div className="p-4">
        <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase truncate">
          {i.artistaNome}
        </div>
        <p className="text-sm text-ink-100 font-medium mt-1 line-clamp-2 min-h-[2.5rem]">
          {i.titulo}
        </p>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-400">
          {i.views != null && (
            <span className="flex items-center gap-1 num">
              <Eye className="w-3.5 h-3.5 text-ink-500" />
              {formatNumber(i.views)}
            </span>
          )}
          <span className="flex items-center gap-1 num">
            <Heart className="w-3.5 h-3.5 text-ink-500" />
            {fmt(i.curtidas)}
          </span>
          <span className="flex items-center gap-1 num">
            <MessageCircle className="w-3.5 h-3.5 text-ink-500" />
            {fmt(i.comentarios)}
          </span>
          <span className="num text-ink-600 ml-auto">{tempoRel(i.publicadoEm)}</span>
        </div>
      </div>
    </>
  )

  const classe =
    'group block bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden hover:border-violet-500/40 transition-colors'
  return i.url ? (
    <a href={i.url} target="_blank" rel="noopener noreferrer" className={classe}>
      {conteudo}
    </a>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

function ThumbImg({ src, plataforma }: { src: string | null; plataforma: Plataforma }) {
  const [erro, setErro] = useState(false)
  const grad =
    plataforma === 'youtube'
      ? 'from-red-500/25 to-rose-700/15'
      : 'from-fuchsia-500/25 to-amber-500/15'
  if (!src || erro) {
    return (
      <div className={cn('absolute inset-0 grid place-items-center bg-gradient-to-br', grad)}>
        <span className="w-8 h-8 block text-white/60">
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
  return n == null ? '—' : formatNumber(n)
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

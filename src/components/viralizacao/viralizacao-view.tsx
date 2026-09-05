'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Flame,
  Globe,
  Heart,
  Info,
  Loader2,
  Search,
  Timer,
  User,
  Video,
} from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { Bandeira } from '@/components/artistas/bandeira'
import { Sparkline } from '@/components/artistas/sparkline'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { ChartResponsivo } from '@/components/shared/chart-responsivo'
import { corAvatarDe, iniciaisDe, listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import { getStatusTikTokUgc } from '@/lib/metricas-sociais/client'
import type { IntegracaoTikTokUgcDoc, TikTokUgcArtistaResumo } from '@/lib/metricas-sociais/types'
import {
  compacto,
  getTikTokDoArtista,
  listarFonogramas,
  type Fonograma,
  type TikTokDoArtista,
  type TikTokFaixa,
} from '@/lib/fonogramas/client'
import { cn } from '@/lib/utils'

/**
 * Tela **Viralização** — o que o PÚBLICO faz com as músicas do selo no TikTok.
 *
 * É a resposta possível ao pedido "quero ver os vídeos de outras pessoas usando
 * a música do artista", que o TikTok for Artists mostra e nenhuma API entrega:
 * a Display API só devolve os vídeos da conta que autorizou, e a busca por som
 * (`music_id`) existe apenas na Research API, restrita a instituições acadêmicas
 * dos EUA e da Europa. Raspar o site quebraria os Termos e o app do painel.
 *
 * O que o painel TEM é a MEDIÇÃO desses vídeos: o feed `Reports/stats/tiktok` da
 * OneRPM separa `UGC` (vídeo do público) de `PGC` (conteúdo oficial) por ISRC,
 * por dia e por país. Então a tela mostra quantos vídeos o público fez com cada
 * faixa, quanto renderam, de onde vêm e se está acelerando — e leva pro TikTok
 * quem quiser ver os vídeos em si.
 *
 * Cota: o ranking do selo sai de UM doc (`integracoes/onerpm-tiktok`, gravado
 * pelo sync) em vez dos ~85 de `streaming-detalhe`. O detalhe de um artista lê
 * só o doc dele, e pelo mesmo cache que o card de Fonogramas já usa.
 */
export function ViralizacaoView() {
  const params = useSearchParams()
  const slugSelecionado = params.get('artista')

  const [status, setStatus] = useState<IntegracaoTikTokUgcDoc | null>(null)
  const [roster, setRoster] = useState<ArtistaDoc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([getStatusTikTokUgc(), listarArtistas()])
      .then(([s, r]) => {
        if (!vivo) return
        setStatus(s)
        setRoster(r)
      })
      .catch(() => vivo && setErro(true))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  const porSlug = useMemo(() => new Map(roster.map((a) => [a.slug, a])), [roster])
  const ranking = useMemo(
    () => (status?.artistas ?? []).filter((a) => a.criacoesUgc > 0 || a.viewsUgc > 0),
    [status],
  )

  if (slugSelecionado) {
    return (
      <DetalheArtista
        slug={slugSelecionado}
        artista={porSlug.get(slugSelecionado) ?? null}
        periodo={status?.periodo ?? null}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Cabecalho periodo={status?.periodo ?? null} />

      {carregando ? (
        <Carregando />
      ) : erro ? (
        <Aviso texto="Não consegui carregar a viralização. Tente recarregar a página." />
      ) : ranking.length === 0 ? (
        <SemDado />
      ) : (
        <>
          <ResumoRoster ranking={ranking} />
          <ListaArtistas ranking={ranking} porSlug={porSlug} />
        </>
      )}

      <Rodape ultima={status?.ultimaSincronizacao ?? null} />
    </div>
  )
}

/* ── topo ──────────────────────────────────────────────────────────────────── */

function Cabecalho({ periodo }: { periodo?: { de: string; ate: string } | null }) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-ink-100">Viralização</h1>
      <p className="text-sm text-ink-400 mt-1">
        Vídeos que o público fez usando as músicas do selo no TikTok — quantos, de quem e de onde.
      </p>
      {periodo?.de && (
        <p className="text-[12px] text-ink-500 mt-1 num">
          Janela do último sync: {curto(periodo.de)} a {curto(periodo.ate)}.
        </p>
      )}
    </div>
  )
}

function ResumoRoster({ ranking }: { ranking: TikTokUgcArtistaResumo[] }) {
  const videos = ranking.reduce((s, a) => s + a.criacoesUgc, 0)
  const views = ranking.reduce((s, a) => s + a.viewsUgc, 0)
  const recente = ranking.reduce((s, a) => s + a.ugc7, 0)
  const anterior = ranking.reduce((s, a) => s + a.ugcAnt7, 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi icone={Video} rotulo="Vídeos do público" valor={videos.toLocaleString('pt-BR')} />
      <Kpi icone={Eye} rotulo="Views desses vídeos" valor={compacto(views)} />
      <Kpi icone={User} rotulo="Artistas com uso" valor={String(ranking.length)} />
      <Kpi
        icone={Flame}
        rotulo="Últimos 7 dias"
        valor={recente.toLocaleString('pt-BR')}
        delta={<Delta atual={recente} anterior={anterior} />}
      />
    </div>
  )
}

function ListaArtistas({
  ranking,
  porSlug,
}: {
  ranking: TikTokUgcArtistaResumo[]
  porSlug: Map<string, ArtistaDoc>
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista = termo
    ? ranking.filter((a) => (porSlug.get(a.slug)?.nome ?? a.nome).toLowerCase().includes(termo))
    : ranking
  const maior = ranking[0]?.criacoesUgc ?? 0

  return (
    <div className="space-y-3">
      {ranking.length >= 12 && (
        <div className="relative w-56">
          <Search
            className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar artista…"
            aria-label="Buscar artista"
            className="bg-bg-900 border border-bg-700/50 rounded-lg pl-8 pr-3 py-2 text-xs text-ink-200 w-full focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      )}

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        {lista.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-500">Nenhum artista com esse nome.</div>
        ) : (
          <ul className="divide-y divide-bg-700/30">
            {lista.map((a) => {
              const art = porSlug.get(a.slug)
              const nome = art?.nome ?? a.nome
              return (
                <li key={a.slug}>
                  <Link
                    href={`/viralizacao?artista=${encodeURIComponent(a.slug)}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-bg-800/30 transition-colors"
                  >
                    <AvatarFallback
                      iniciais={iniciaisDe(nome)}
                      gradient={corAvatarDe(a.slug)}
                      size="sm"
                      fotoUrl={art?.fotoUrl}
                    />
                    <span className="text-sm text-ink-100 font-medium truncate flex-1 min-w-0">
                      {nome}
                    </span>

                    <Delta atual={a.ugc7} anterior={a.ugcAnt7} />

                    {/* Barra proporcional ao maior do roster — dá a escala de
                        relance sem precisar comparar número a número. */}
                    <span
                      className="hidden sm:block w-28 h-1.5 rounded-full bg-bg-800 overflow-hidden shrink-0"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-cyan-500/70"
                        style={{
                          width: maior ? `${Math.max(2, (a.criacoesUgc / maior) * 100)}%` : '0%',
                        }}
                      />
                    </span>

                    <span
                      className="num text-xs font-semibold text-ink-200 w-20 text-right shrink-0"
                      title={`${a.criacoesUgc.toLocaleString('pt-BR')} vídeos do público`}
                    >
                      {compacto(a.criacoesUgc)} vídeos
                    </span>
                    <span
                      className="num text-xs text-ink-400 w-16 text-right shrink-0 hidden md:block"
                      title={`${a.viewsUgc.toLocaleString('pt-BR')} views`}
                    >
                      {compacto(a.viewsUgc)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ── detalhe de um artista ─────────────────────────────────────────────────── */

type Metrica = 'videos' | 'views'

function DetalheArtista({
  slug,
  artista,
  periodo,
}: {
  slug: string
  artista: ArtistaDoc | null
  periodo?: { de: string; ate: string } | null
}) {
  const [dados, setDados] = useState<TikTokDoArtista | null>(null)
  const [faixas, setFaixas] = useState<Fonograma[]>([])
  const [carregando, setCarregando] = useState(true)
  const [metrica, setMetrica] = useState<Metrica>('videos')

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    Promise.all([
      getTikTokDoArtista(slug).catch(() => null),
      // Só pra dar TÍTULO ao ISRC. Falhar aqui não esconde a tração: a linha
      // aparece com o ISRC, que é o que o feed da OneRPM garante.
      listarFonogramas(slug).catch(() => [] as Fonograma[]),
    ])
      .then(([d, f]) => {
        if (!vivo) return
        setDados(d)
        setFaixas(f)
      })
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [slug])

  const nome = artista?.nome ?? slug
  const tituloPorIsrc = useMemo(
    () => new Map(faixas.map((f) => [f.isrc, f.titulo])),
    [faixas],
  )

  // O doc vem ordenado por views TOTAIS (com o conteúdo oficial dentro). Aqui a
  // lista é do que o público fez, então reordena pelo número que a linha mostra
  // — senão a faixa nº 1 da tela não é a de cima.
  const usadas = useMemo(
    () =>
      (dados?.faixas ?? [])
        .filter((f) => f.criacoesUgc > 0 || f.viewsUgc > 0)
        .sort((a, b) => b.criacoesUgc - a.criacoesUgc || b.viewsUgc - a.viewsUgc),
    [dados],
  )

  const serie = useMemo(
    () =>
      (dados?.porDia ?? []).map((d) => ({
        dia: curto(d.dia),
        videos: d.criacoesUgc,
        views: d.viewsUgc,
      })),
    [dados],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href="/viralizacao"
          className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100 bg-bg-900 border border-bg-700/40 rounded-lg px-3 py-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Todos
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <AvatarFallback
            iniciais={iniciaisDe(nome)}
            gradient={corAvatarDe(slug)}
            size="md"
            fotoUrl={artista?.fotoUrl}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-100 truncate">{nome}</h1>
            <p className="text-[12px] text-ink-500">
              Vídeos do público no TikTok
              {dados?.periodo?.de ? ` · ${curto(dados.periodo.de)} a ${curto(dados.periodo.ate)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <Link
          href={`/artistas/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-ink-100 bg-bg-900 border border-bg-700/40 rounded-lg px-3 py-2 transition-colors"
        >
          <User className="w-3.5 h-3.5" aria-hidden /> Perfil
        </Link>
      </div>

      {carregando ? (
        <Carregando />
      ) : !dados || usadas.length === 0 ? (
        <SemDado nome={nome} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icone={Video}
              rotulo="Vídeos do público"
              valor={dados.totais.criacoesUgc.toLocaleString('pt-BR')}
              delta={
                dados.tendencia ? (
                  <Delta atual={dados.tendencia.ugc7} anterior={dados.tendencia.ugcAnt7} />
                ) : undefined
              }
            />
            <Kpi icone={Eye} rotulo="Views desses vídeos" valor={compacto(dados.totais.viewsUgc)} />
            <Kpi
              icone={Heart}
              rotulo="Fatia do público"
              valor={fatia(dados.totais.viewsUgc, dados.totais.views)}
              ajuda="Das views de vídeos com as músicas dele, quanto veio de vídeo do público (o resto é conteúdo oficial)."
            />
            <Kpi
              icone={Timer}
              rotulo="Watchtime médio"
              valor={
                dados.totais.watchtimeMedio == null
                  ? '—'
                  : `${dados.totais.watchtimeMedio.toFixed(1)}s`
              }
              ajuda="Segundos assistidos por vídeo, média ponderada por views. A OneRPM só publica esta média junto (vídeo do público e conteúdo oficial no mesmo número)."
            />
          </div>

          {serie.length > 1 && (
            <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-700/30 flex items-center gap-2 flex-wrap">
                <Flame className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden />
                <span className="font-bold text-ink-100 text-sm">Por dia</span>
                <span className="text-[11px] text-ink-500">
                  {serie.length} dia{serie.length === 1 ? '' : 's'} com dado
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1 bg-bg-800 rounded-lg p-1">
                  {(
                    [
                      { key: 'videos', label: 'Vídeos' },
                      { key: 'views', label: 'Views' },
                    ] as { key: Metrica; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMetrica(m.key)}
                      aria-pressed={metrica === m.key}
                      className={cn(
                        'px-3 py-1 rounded-md text-[11px] font-semibold transition-colors',
                        metrica === m.key
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-ink-400 hover:text-ink-100',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-2">
                <ChartResponsivo altura={200}>
                  {(largura) => (
                    <AreaChart
                      width={largura}
                      height={200}
                      data={serie}
                      margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="viralizacao-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="dia"
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        tickFormatter={(v) => compacto(Number(v))}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#1a1a1f',
                          border: '1px solid #33333a',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(v) => [
                          Number(v).toLocaleString('pt-BR'),
                          metrica === 'videos' ? 'Vídeos do público' : 'Views',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey={metrica}
                        stroke="#22D3EE"
                        strokeWidth={2}
                        fill="url(#viralizacao-grad)"
                      />
                    </AreaChart>
                  )}
                </ChartResponsivo>
              </div>
            </div>
          )}

          {dados.porPais.length > 0 && <Paises paises={dados.porPais} />}

          <Faixas faixas={usadas} titulos={tituloPorIsrc} artista={nome} dias={dados.dias} />
        </>
      )}

      <Rodape ultima={null} periodo={periodo} />
    </div>
  )
}

function Paises({ paises }: { paises: { pais: string; criacoesUgc: number; viewsUgc: number }[] }) {
  const maior = paises[0]?.viewsUgc ?? 0
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-bg-700/30 flex items-center gap-2">
        <Globe className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden />
        <span className="font-bold text-ink-100 text-sm">De onde vêm</span>
        <span className="text-[11px] text-ink-500">views dos vídeos do público</span>
      </div>
      <ul className="divide-y divide-bg-700/30">
        {paises.map((p) => (
          <li key={p.pais} className="flex items-center gap-3 px-5 py-2.5">
            <Bandeira pais={p.pais} />
            <span className="text-xs text-ink-200 font-semibold w-8 shrink-0">{p.pais}</span>
            <span
              className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden min-w-0"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-cyan-500/70"
                style={{ width: maior ? `${Math.max(2, (p.viewsUgc / maior) * 100)}%` : '0%' }}
              />
            </span>
            <span
              className="num text-xs text-ink-300 w-16 text-right shrink-0"
              title={`${p.viewsUgc.toLocaleString('pt-BR')} views`}
            >
              {compacto(p.viewsUgc)}
            </span>
            <span
              className="num text-[11px] text-ink-500 w-20 text-right shrink-0 hidden sm:block"
              title={`${p.criacoesUgc.toLocaleString('pt-BR')} vídeos`}
            >
              {compacto(p.criacoesUgc)} vídeos
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Quantas faixas aparecem antes de "Ver todas". */
const PREVIA_FAIXAS = 12

function Faixas({
  faixas,
  titulos,
  artista,
  dias,
}: {
  faixas: TikTokFaixa[]
  titulos: Map<string, string | null>
  artista: string
  dias: string[]
}) {
  const [expandido, setExpandido] = useState(false)
  const visiveis = expandido ? faixas : faixas.slice(0, PREVIA_FAIXAS)
  const ocultas = faixas.length - visiveis.length

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-bg-700/30 flex items-center gap-2 flex-wrap">
        <span className="w-4 h-4 block text-cyan-400 shrink-0" aria-hidden>
          <PlataformaIcon tipo="tiktok" />
        </span>
        <span className="font-bold text-ink-100 text-sm">Músicas usadas pelo público</span>
        <span className="text-[10px] num bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded font-semibold">
          {faixas.length}
        </span>
      </div>

      <ul className="divide-y divide-bg-700/30">
        {visiveis.map((f) => {
          const titulo = titulos.get(f.isrc) ?? null
          return (
            <li key={f.isrc} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink-100 font-medium truncate">
                  {titulo ?? <span className="num text-ink-300">{f.isrc}</span>}
                </div>
                <div className="text-[11px] text-ink-500 num flex items-center gap-2 flex-wrap">
                  {titulo && <span>{f.isrc}</span>}
                  {f.watchtimeMedio != null && <span>{f.watchtimeMedio.toFixed(1)}s médios</span>}
                  {f.curtidas > 0 && <span>{compacto(f.curtidas)} curtidas</span>}
                </div>
              </div>

              {f.serieUgc && f.serieUgc.length > 1 && (
                <span className="hidden lg:block shrink-0" aria-hidden>
                  <Sparkline data={f.serieUgc} width={80} height={22} />
                </span>
              )}

              <Delta atual={f.ugc7 ?? 0} anterior={f.ugcAnt7 ?? 0} />

              <span
                className="num text-xs font-semibold text-ink-100 w-20 text-right shrink-0"
                title={`${f.criacoesUgc.toLocaleString('pt-BR')} vídeos do público`}
              >
                {compacto(f.criacoesUgc)} vídeos
              </span>
              <span
                className="num text-xs text-ink-400 w-16 text-right shrink-0 hidden md:block"
                title={`${f.viewsUgc.toLocaleString('pt-BR')} views nos vídeos do público`}
              >
                {compacto(f.viewsUgc)}
              </span>

              <a
                href={buscaNoTikTok(titulo, artista, f.isrc)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abre a busca do TikTok pela música — os vídeos em si só existem lá"
                aria-label={`Ver no TikTok os vídeos de ${titulo ?? f.isrc}`}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 border border-cyan-500/25 rounded-lg px-2 py-1.5 transition-colors"
              >
                <ExternalLink className="w-3 h-3" aria-hidden />
                <span className="hidden sm:inline">TikTok</span>
              </a>
            </li>
          )
        })}
      </ul>

      {ocultas > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="w-full px-5 py-2.5 text-xs text-ink-400 hover:text-ink-100 hover:bg-bg-800/30 border-t border-bg-700/30 transition-colors"
        >
          Ver todas as {faixas.length} músicas
        </button>
      )}

      {dias.length > 0 && (
        <p className="px-5 py-2.5 text-[11px] text-ink-600 border-t border-bg-700/30">
          A curva de cada faixa cobre os {dias.length} dias com dado da janela.
        </p>
      )}
    </div>
  )
}

/* ── peças ─────────────────────────────────────────────────────────────────── */

function Kpi({
  icone: Icone,
  rotulo,
  valor,
  delta,
  ajuda,
}: {
  icone: typeof Video
  rotulo: string
  valor: string
  delta?: React.ReactNode
  ajuda?: string
}) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl px-4 py-3" title={ajuda}>
      <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase flex items-center gap-1.5">
        <Icone className="w-3 h-3" aria-hidden />
        {rotulo}
      </div>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className="num text-2xl font-bold text-ink-100">{valor}</span>
        {delta}
      </div>
    </div>
  )
}

/**
 * Variação entre as duas janelas de 7 dias COM DADO. Sem base anterior não
 * inventa porcentagem: mostra "novo", que é o que o número realmente diz.
 */
function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (!atual && !anterior) return null
  if (!anterior) {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 shrink-0">
        novo
      </span>
    )
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return null
  return (
    <span
      className={cn(
        'num text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0',
        pct > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
      )}
      title={`${atual.toLocaleString('pt-BR')} nos últimos 7 dias com dado, contra ${anterior.toLocaleString('pt-BR')} nos 7 anteriores`}
    >
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

function Carregando() {
  return (
    <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando viralização…
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200/90">
      {texto}
    </div>
  )
}

function SemDado({ nome }: { nome?: string }) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-8 text-center">
      <span className="w-8 h-8 mx-auto mb-3 block text-ink-600" aria-hidden>
        <PlataformaIcon tipo="tiktok" />
      </span>
      <p className="text-sm text-ink-300 font-medium">
        {nome
          ? `Ainda não há vídeo do público com as músicas de ${nome}.`
          : 'O feed ainda não trouxe vídeo do público.'}
      </p>
      <p className="text-[12px] text-ink-500 mt-2 max-w-md mx-auto">
        A OneRPM só publica este relatório desde 07/08/2026, e ele cobre as faixas que tiveram
        movimento no período. Ausência aqui é falta de medição, não necessariamente falta de uso.
      </p>
    </div>
  )
}

function Rodape({
  ultima,
  periodo,
}: {
  ultima: string | null
  periodo?: { de: string; ate: string } | null
}) {
  return (
    <div className="flex items-start gap-2 text-[11px] text-ink-600 px-1">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
      <p>
        Os números vêm do relatório de TikTok da OneRPM (atualizado todo dia às 5h05) e contam os
        vídeos que o público publicou usando as músicas. Os vídeos em si não vêm por API — nenhum
        endpoint público lista quem usou um som —, por isso cada faixa leva pra busca do TikTok.
        {ultima ? ` Último sync: ${dataHora(ultima)}.` : ''}
        {!ultima && periodo?.ate ? ` Dado até ${curto(periodo.ate)}.` : ''}
      </p>
    </div>
  )
}

/* ── utilidades ────────────────────────────────────────────────────────────── */

/** 'YYYY-MM-DD' → 'dd/mm'. */
function curto(iso: string): string {
  const [, m, d] = (iso || '').split('-')
  return m && d ? `${d}/${m}` : iso
}

function dataHora(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fatia(parte: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((parte / total) * 100)}%`
}

/**
 * Busca do TikTok pela música. O painel não tem o `music_id` do TikTok (o feed
 * da OneRPM identifica faixa por ISRC, e o TikTok não expõe esse de↔para), então
 * o link mais honesto é a busca por título + artista. Sem título, cai no ISRC —
 * raramente acha, mas não leva a equipe pra uma busca vazia sem explicação.
 */
function buscaNoTikTok(titulo: string | null, artista: string, isrc: string): string {
  const q = titulo ? `${titulo} ${artista}` : isrc
  return `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`
}

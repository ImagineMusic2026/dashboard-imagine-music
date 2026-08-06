'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  Clock,
  DollarSign,
  Flame,
  Music2,
  Search,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'

/* ─────────────────────────────────────────────────────────────────────────────
 * Showcase de features em abas (estilo Viberate).
 *
 * Uma fileira de abas no topo + uma fileira de painéis: o painel ATIVO expande e
 * mostra o mock; os inativos viram colunas finas de gradiente (cada uma com uma
 * cor de acento) e são clicáveis. Abaixo, título + descrição + link, mudando com
 * a aba. Auto-avança a cada ~7s com barra de progresso; pausa no hover; respeita
 * prefers-reduced-motion.
 * ───────────────────────────────────────────────────────────────────────────── */

const INTERVALO_MS = 7000

// No mobile o mock é desenhado nesta "tela" fixa (landscape) e escalado pra
// caber na largura — assim mostra tudo, sem scroll lateral nem corte.
const DESIGN_W = 820
const DESIGN_H = 460

type Tab = {
  id: string
  rotulo: string
  titulo: string
  descricao: string
  acento: string // borda/realce da coluna fina (cor de acento sutil)
  grad: string // gradiente da coluna fina inativa
  texto: string // cor do texto/ícone de realce
  Mock: () => JSX.Element
}

const TABS: Tab[] = [
  {
    id: 'metricas',
    rotulo: 'Métricas consolidadas',
    titulo: 'Acompanhe o crescimento em todos os canais',
    descricao:
      'Seguidores, visualizações e engajamento de YouTube, Instagram e TikTok — lado a lado, por artista, atualizados todo dia.',
    acento: 'border-violet-500/40',
    grad: 'from-violet-600/20 via-bg-900 to-bg-950',
    texto: 'text-violet-300',
    Mock: MockMetricasConsolidadas,
  },
  {
    id: 'saude',
    rotulo: 'Saúde do artista',
    titulo: 'A saúde de cada artista num índice só',
    descricao:
      'Um Health Score que resume evolução e engajamento de cada artista em todas as plataformas conectadas.',
    acento: 'border-fuchsia-500/40',
    grad: 'from-fuchsia-600/20 via-bg-900 to-bg-950',
    texto: 'text-fuchsia-300',
    Mock: MockSaudeArtista,
  },
  {
    id: 'receita',
    rotulo: 'Receita',
    titulo: 'Royalties e streaming, detalhados',
    descricao:
      'Receita importada da OneRPM, aberta por artista, faixa e plataforma — sem planilha.',
    acento: 'border-sky-500/40',
    grad: 'from-sky-600/20 via-bg-900 to-bg-950',
    texto: 'text-sky-300',
    Mock: MockReceita,
  },
  {
    id: 'alertas',
    rotulo: 'Alertas',
    titulo: 'Quedas e oportunidades, na hora',
    descricao:
      'Viralizações, marcos e quedas detectados automaticamente a partir dos dados — assim que acontecem.',
    acento: 'border-amber-500/40',
    grad: 'from-amber-500/15 via-bg-900 to-bg-950',
    texto: 'text-amber-300',
    Mock: MockAlertas,
  },
]

/* ─────────────────────────────────────────────────────────────────────────────
 * Casca interativa
 * ───────────────────────────────────────────────────────────────────────────── */

export function FeatureShowcase() {
  const [ativo, setAtivo] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [reduzMov, setReduzMov] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const [escalaMobile, setEscalaMobile] = useState(0.42)

  // Mede a largura disponível no mobile e calcula a escala pra o mock caber.
  useEffect(() => {
    const el = mobileRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const calcular = () => setEscalaMobile(el.clientWidth / DESIGN_W)
    calcular()
    const ro = new ResizeObserver(calcular)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Detecta prefers-reduced-motion (sem auto-avanço nem barra animada).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aplicar = () => setReduzMov(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  // Auto-avanço. Reinicia quando muda a aba (ativo), pausa ou preferência.
  useEffect(() => {
    if (reduzMov || pausado) return
    timerRef.current = setTimeout(() => {
      setAtivo((i) => (i + 1) % TABS.length)
    }, INTERVALO_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [ativo, pausado, reduzMov])

  const selecionar = (i: number) => setAtivo(i) // troca reinicia o timer via dep [ativo]

  const tabAtiva = TABS[ativo]

  return (
    <div
      className="w-full"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {/* ── Abas ── */}
      <div
        role="tablist"
        aria-label="Recursos do painel"
        className="flex flex-wrap gap-x-1 gap-y-1 border-b border-bg-700/40 pb-px sm:gap-x-2"
      >
        {TABS.map((t, i) => {
          const sel = i === ativo
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`showcase-tab-${t.id}`}
              aria-selected={sel}
              aria-controls={`showcase-panel-${t.id}`}
              onClick={() => selecionar(i)}
              className={cn(
                'relative shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors sm:px-4',
                sel ? 'text-ink-100' : 'text-ink-500 hover:text-ink-300',
              )}
            >
              {t.rotulo}
              {/* trilho + barra de progresso sob a aba ativa */}
              {sel && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-bg-700/60">
                  {reduzMov ? (
                    <span className="absolute inset-0 bg-violet-400" />
                  ) : pausado ? (
                    <span className="absolute inset-y-0 left-0 w-full bg-violet-400" />
                  ) : (
                    <span
                      key={ativo}
                      className="absolute inset-y-0 left-0 w-full origin-left bg-violet-400 animate-showcase-progress"
                    />
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Painéis ── */}
      {/* Mobile: o mock inteiro escalado pra caber na largura (sem corte/scroll lateral). */}
      <div className="mt-6 sm:hidden">
        <div
          ref={mobileRef}
          className="relative w-full overflow-hidden rounded-2xl border border-bg-700/40 bg-bg-950"
          style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${escalaMobile})` }}
          >
            <div key={ativo} className="h-full w-full animate-showcase-in">
              <tabAtiva.Mock />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: fileira de 4 painéis — ativo expande, inativos viram colunas finas. */}
      <div className="mt-6 hidden h-[430px] gap-2.5 sm:flex">
        {TABS.map((t, i) => {
          const sel = i === ativo
          return (
            <div
              key={t.id}
              id={`showcase-panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={`showcase-tab-${t.id}`}
              aria-hidden={!sel}
            >
              {sel ? (
                <div className="h-full overflow-hidden rounded-2xl border border-bg-700/40 bg-bg-950 transition-all duration-500">
                  <div key={ativo} className="h-full w-full animate-showcase-in">
                    <t.Mock />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => selecionar(i)}
                  aria-label={`Ver ${t.rotulo}`}
                  className={cn(
                    'group relative h-full w-12 overflow-hidden rounded-2xl border bg-gradient-to-b transition-all duration-500 hover:w-16 sm:w-14 lg:w-16',
                    t.acento,
                    t.grad,
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 100%, rgba(255,255,255,0.06), transparent 60%)',
                    }}
                  />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Faz o painel ativo ocupar todo o espaço restante (flex-1) no desktop. */}
      <style jsx>{`
        @media (min-width: 640px) {
          div[role='tabpanel'][aria-hidden='false'] {
            flex: 1 1 0%;
            min-width: 0;
          }
        }
      `}</style>

      {/* ── Título + descrição + link (muda com a aba) ── */}
      <div key={ativo} className="mt-8 max-w-2xl animate-showcase-in">
        <h3 className="text-2xl font-bold tracking-tight text-ink-100 sm:text-3xl">
          {tabAtiva.titulo}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-ink-400">{tabAtiva.descricao}</p>
        <Link
          href="/login"
          className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
        >
          Entrar no painel
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Mocks (decorativos)
 * ───────────────────────────────────────────────────────────────────────────── */

function MockMetricasConsolidadas() {
  const linhas = [
    {
      pos: 1,
      nome: 'Marília Vasques',
      handle: '@mariliavasques',
      grad: 'from-fuchsia-500 to-violet-600',
      ini: 'MV',
      streams: '4,82M',
      sd: +18.4,
      views: '12,1M',
      vd: +9.2,
      seg: '1,94M',
      gd: +4.1,
    },
    {
      pos: 2,
      nome: 'Beto Caldas',
      handle: '@betocaldas',
      grad: 'from-cyan-400 to-sky-600',
      ini: 'BC',
      streams: '3,57M',
      sd: +11.7,
      views: '8,4M',
      vd: +2.3,
      seg: '1,12M',
      gd: +6.8,
    },
    {
      pos: 3,
      nome: 'Duo Aurora',
      handle: '@duoaurora',
      grad: 'from-amber-400 to-orange-600',
      ini: 'DA',
      streams: '2,90M',
      sd: +24.6,
      views: '6,9M',
      vd: +15.1,
      seg: '884K',
      gd: +12.4,
    },
    {
      pos: 4,
      nome: 'Lia Ferraz',
      handle: '@liaferraz',
      grad: 'from-rose-400 to-pink-600',
      ini: 'LF',
      streams: '2,11M',
      sd: -3.8,
      views: '5,2M',
      vd: +1.4,
      seg: '742K',
      gd: +0.9,
    },
    {
      pos: 5,
      nome: 'Núcleo Sul',
      handle: '@nucleosul',
      grad: 'from-emerald-400 to-teal-600',
      ini: 'NS',
      streams: '1,78M',
      sd: +7.2,
      views: '4,1M',
      vd: -5.6,
      seg: '613K',
      gd: +3.3,
    },
    {
      pos: 6,
      nome: 'Rafa Quintana',
      handle: '@rafaquintana',
      grad: 'from-violet-500 to-indigo-600',
      ini: 'RQ',
      streams: '1,46M',
      sd: +5.9,
      views: '3,3M',
      vd: +8.7,
      seg: '498K',
      gd: -1.2,
    },
    {
      pos: 7,
      nome: 'Mel & os Cometas',
      handle: '@melcometas',
      grad: 'from-sky-400 to-blue-600',
      ini: 'MC',
      streams: '1,02M',
      sd: +2.1,
      views: '2,6M',
      vd: +3.0,
      seg: '371K',
      gd: +1.8,
    },
  ]

  const Delta = ({ v }: { v: number }) => {
    const up = v >= 0
    return (
      <span
        className={cn(
          'num inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums',
          up ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {up ? '+' : ''}
        {v.toFixed(1).replace('.', ',')}%
      </span>
    )
  }

  const ColHead = ({
    tipo,
    cor,
    label,
  }: {
    tipo: PlataformaTipo
    cor: string
    label: string
  }) => (
    <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-[10px] text-ink-400">
      <div className="flex items-center justify-end gap-1.5">
        <span className={cn('h-3 w-3', cor)}>
          <PlataformaIcon tipo={tipo} />
        </span>
        {label}
      </div>
    </th>
  )

  return (
    <div
      aria-hidden
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-bg-700/60 bg-bg-900 shadow-2xl shadow-black/40"
    >
      {/* Chrome da janela */}
      <div className="flex shrink-0 items-center gap-3 border-b border-bg-700/50 bg-bg-950/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="ml-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-200">Métricas consolidadas</span>
          <span className="rounded-full border border-bg-700/60 bg-bg-800/60 px-2 py-0.5 text-[9px] font-medium text-ink-400">
            68 artistas
          </span>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 rounded-md border border-bg-700/50 bg-bg-800/50 px-2 py-1 text-[10px] text-ink-500 sm:flex">
          <Search className="h-3 w-3" />
          Buscar artista
        </div>
      </div>

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-bg-700/40 bg-bg-950/30">
              <th className="w-10 px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-[10px] text-ink-400">
                #
              </th>
              <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-ink-400">
                Artista
              </th>
              <ColHead tipo="spotify" cor="text-emerald-400" label="Streams" />
              <ColHead tipo="youtube" cor="text-red-400" label="Views" />
              <ColHead tipo="instagram" cor="text-fuchsia-400" label="Seguidores" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.pos}
                className="group border-b border-bg-700/30 transition-colors last:border-0 hover:bg-bg-800/40"
              >
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={cn(
                      'num text-xs font-semibold tabular-nums',
                      l.pos <= 3 ? 'text-accent-400' : 'text-ink-500',
                    )}
                  >
                    {l.pos}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-inner shadow-black/20',
                        l.grad,
                      )}
                    >
                      {l.ini}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-ink-100">{l.nome}</div>
                      <div className="num truncate text-[10px] text-ink-500">{l.handle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="num text-xs font-semibold tabular-nums text-ink-100">{l.streams}</div>
                  <Delta v={l.sd} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="num text-xs font-semibold tabular-nums text-ink-100">{l.views}</div>
                  <Delta v={l.vd} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="num text-xs font-semibold tabular-nums text-ink-100">{l.seg}</div>
                  <Delta v={l.gd} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé sutil */}
      <div className="flex shrink-0 items-center justify-between border-t border-bg-700/40 bg-bg-950/40 px-4 py-2 text-[10px] text-ink-500">
        <span>Últimos 28 dias · sincronizado há 2h</span>
        <span className="num text-ink-400">1–7 de 68</span>
      </div>
    </div>
  )
}

function MockSaudeArtista() {
  const artistas = [
    {
      nome: 'Marina Sayuri',
      iniciais: 'MS',
      pais: 'Brasil',
      genero: 'Pop / MPB',
      score: 92,
      tag: 'Saudável',
      tagCor: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20',
      gradiente: 'from-fuchsia-500/30 to-violet-500/30',
      ring: 'ring-fuchsia-400/30',
    },
    {
      nome: 'Léo Andrade',
      iniciais: 'LA',
      pais: 'Brasil',
      genero: 'Sertanejo',
      score: 78,
      tag: 'Estável',
      tagCor: 'text-accent-400 bg-accent-400/10 ring-accent-400/20',
      gradiente: 'from-sky-500/30 to-cyan-500/30',
      ring: 'ring-sky-400/30',
    },
  ]

  const plataformas: {
    tipo: PlataformaTipo
    nome: string
    valor: string
    variacao: string
    positivo: boolean
    cor: string
    barra: string
    largura: string
  }[] = [
    {
      tipo: 'youtube',
      nome: 'YouTube',
      valor: '1,24 mi',
      variacao: '+4,8%',
      positivo: true,
      cor: 'text-red-500',
      barra: 'from-red-500/80 to-red-400',
      largura: '92%',
    },
    {
      tipo: 'instagram',
      nome: 'Instagram',
      valor: '842 mil',
      variacao: '+2,1%',
      positivo: true,
      cor: 'text-fuchsia-400',
      barra: 'from-fuchsia-500/80 to-pink-400',
      largura: '68%',
    },
    {
      tipo: 'tiktok',
      nome: 'TikTok',
      valor: '1,56 mi',
      variacao: '+11,4%',
      positivo: true,
      cor: 'text-cyan-300',
      barra: 'from-cyan-400/80 to-sky-300',
      largura: '100%',
    },
    {
      tipo: 'spotify',
      nome: 'Spotify',
      valor: '518 mil',
      variacao: '-0,6%',
      positivo: false,
      cor: 'text-emerald-400',
      barra: 'from-emerald-500/80 to-emerald-400',
      largura: '44%',
    },
  ]

  // mini-grafico de inscritos (pontos normalizados 0..1)
  const serie = [0.18, 0.3, 0.26, 0.42, 0.5, 0.46, 0.62, 0.58, 0.74, 0.82, 0.78, 0.96]
  const w = 132
  const h = 40
  const stepX = w / (serie.length - 1)
  const pts = serie.map((v, i) => `${(i * stepX).toFixed(1)},${(h - v * h).toFixed(1)}`)
  const linha = `M ${pts.join(' L ')}`
  const area = `${linha} L ${w},${h} L 0,${h} Z`

  return (
    <div
      aria-hidden
      className="relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-xl bg-bg-950 p-4 sm:p-5"
    >
      {/* brilho ambiente */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-1/3 h-44 w-44 rounded-full bg-fuchsia-600/10 blur-3xl" />

      {/* cabecalho */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold leading-none text-ink-100">Saúde do artista</p>
            <p className="mt-1 text-[10px] leading-none text-ink-500">Visão consolidada · últimos 30 dias</p>
          </div>
        </div>
        <span className="rounded-full bg-bg-800 px-2 py-1 text-[10px] font-medium text-ink-400 ring-1 ring-bg-700">
          2 artistas
        </span>
      </div>

      {/* cards de perfil */}
      <div className="relative grid grid-cols-2 gap-3">
        {artistas.map((a) => (
          <div
            key={a.nome}
            className="flex items-center gap-3 rounded-lg border border-bg-700 bg-bg-900/80 p-3"
          >
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-ink-100 ring-2',
                a.gradiente,
                a.ring,
              )}
            >
              {a.iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold text-ink-100">{a.nome}</p>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-ink-500">
                {a.pais} · {a.genero}
              </p>
              <span
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1',
                  a.tagCor,
                )}
              >
                <span className="h-1 w-1 rounded-full bg-current" />
                {a.tag}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="num text-[28px] font-bold leading-none text-ink-100">{a.score}</span>
              <span className="mt-1 text-[9px] uppercase tracking-wide text-ink-500">Health Score</span>
            </div>
          </div>
        ))}
      </div>

      {/* grafico de barras por plataforma */}
      <div className="relative flex-1 rounded-lg border border-bg-700 bg-bg-900/60 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-ink-200">Crescimento da base por plataforma</p>
          <span className="text-[9px] text-ink-500">vs. mês anterior</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {plataformas.map((p) => (
            <div key={p.nome} className="flex items-center gap-2.5">
              <span className={cn('h-3.5 w-3.5 shrink-0', p.cor)}>
                <PlataformaIcon tipo={p.tipo} />
              </span>
              <span className="w-14 shrink-0 text-[10px] text-ink-400">{p.nome}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-bg-800">
                <div
                  className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', p.barra)}
                  style={{ width: p.largura }}
                />
              </div>
              <span className="num w-14 shrink-0 text-right text-[11px] font-semibold text-ink-100">
                {p.valor}
              </span>
              <span
                className={cn(
                  'num flex w-12 shrink-0 items-center justify-end gap-0.5 text-[10px] font-medium',
                  p.positivo ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {p.positivo ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {p.variacao}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* card flutuante: inscritos no YouTube */}
      <div className="absolute bottom-4 right-4 w-[180px] rounded-lg border border-bg-700 bg-bg-800/90 p-2.5 shadow-xl shadow-black/40 backdrop-blur-sm sm:bottom-5 sm:right-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 text-red-500">
              <PlataformaIcon tipo="youtube" />
            </span>
            <span className="text-[9px] font-medium text-ink-400">Inscritos no YouTube</span>
          </div>
          <span className="num flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400">
            <TrendingUp className="h-2.5 w-2.5" />
            +4,8%
          </span>
        </div>
        <p className="num mt-1 text-[18px] font-bold leading-none text-ink-100">1.243.902</p>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="mt-2 h-9 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="yt-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#yt-area-fill)" />
          <path
            d={linha}
            fill="none"
            stroke="#f87171"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}

function MockReceita() {
  const meses = [
    { m: 'Jul', v: 18.2 },
    { m: 'Ago', v: 22.6 },
    { m: 'Set', v: 24.1 },
    { m: 'Out', v: 21.8 },
    { m: 'Nov', v: 28.4 },
    { m: 'Dez', v: 34.9 },
    { m: 'Jan', v: 31.5 },
    { m: 'Fev', v: 38.7 },
    { m: 'Mar', v: 42.3 },
    { m: 'Abr', v: 45.1 },
    { m: 'Mai', v: 52.8 },
    { m: 'Jun', v: 58.4 },
  ]

  const W = 560
  const H = 200
  const padX = 8
  const padTop = 16
  const padBottom = 24
  const max = Math.max(...meses.map((d) => d.v)) * 1.08
  const min = 0
  const stepX = (W - padX * 2) / (meses.length - 1)
  const x = (i: number) => padX + i * stepX
  const y = (v: number) =>
    padTop + (H - padTop - padBottom) * (1 - (v - min) / (max - min))

  const pts = meses.map((d, i) => [x(i), y(d.v)] as const)

  const linePath = pts
    .map((p, i) => {
      if (i === 0) return `M ${p[0]} ${p[1]}`
      const prev = pts[i - 1]
      const cx = (prev[0] + p[0]) / 2
      return `C ${cx} ${prev[1]} ${cx} ${p[1]} ${p[0]} ${p[1]}`
    })
    .join(' ')

  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${H - padBottom} L ${pts[0][0]} ${H - padBottom} Z`

  const plataformas: {
    tipo: PlataformaTipo
    nome: string
    cor: string
    receita: string
    streams: string
    pct: number
  }[] = [
    { tipo: 'spotify', nome: 'Spotify', cor: 'text-emerald-400', receita: 'R$ 142,8k', streams: '38,4M', pct: 57 },
    { tipo: 'apple-music', nome: 'Apple Music', cor: 'text-rose-400', receita: 'R$ 48,2k', streams: '7,9M', pct: 19 },
    { tipo: 'youtube', nome: 'YouTube Music', cor: 'text-red-500', receita: 'R$ 34,6k', streams: '11,2M', pct: 14 },
    { tipo: 'deezer', nome: 'Deezer', cor: 'text-fuchsia-400', receita: 'R$ 22,9k', streams: '4,1M', pct: 9 },
  ]

  const topFaixas = [
    { titulo: 'Madrugada Inteira', artista: 'Luana Reis', valor: 'R$ 31,4k', streams: '8,9M', cor: 'text-emerald-400' },
    { titulo: 'Ela Dança', artista: 'MC Theo', valor: 'R$ 24,7k', streams: '12,1M', cor: 'text-amber-400' },
    { titulo: 'Volta pra Casa', artista: 'Banda Aurora', valor: 'R$ 18,2k', streams: '5,3M', cor: 'text-sky-400' },
  ]

  return (
    <div
      aria-hidden
      className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-xl border border-bg-700 bg-bg-900 p-4 text-ink-100"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight text-ink-100">Receita</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-bg-700 bg-bg-800 px-2 py-1 text-[10px] text-ink-400">
          <Calendar className="h-3 w-3" />
          <span>Últimos 12 meses</span>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.55fr_1fr] gap-3">
        {/* Chart card */}
        <div className="flex min-h-0 flex-col rounded-lg border border-bg-700 bg-bg-950 p-3">
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Receita acumulada</span>
              <div className="flex items-baseline gap-2">
                <span className="num text-2xl font-bold text-ink-100">R$ 248,5k</span>
                <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  <span className="num">+18,7%</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-ink-500">Junho</span>
              <span className="num text-sm font-semibold text-amber-400">R$ 58,4k</span>
            </div>
          </div>

          {/* SVG area chart */}
          <div className="relative mt-2 min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.38" />
                  <stop offset="55%" stopColor="#34D399" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="recLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#FBBF24" />
                </linearGradient>
              </defs>

              {/* gridlines */}
              {[0.25, 0.5, 0.75].map((g) => (
                <line
                  key={g}
                  x1={padX}
                  x2={W - padX}
                  y1={padTop + (H - padTop - padBottom) * g}
                  y2={padTop + (H - padTop - padBottom) * g}
                  stroke="#2A2540"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
              ))}

              <path d={areaPath} fill="url(#recGrad)" />
              <path
                d={linePath}
                fill="none"
                stroke="url(#recLine)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* last point marker */}
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="6" fill="#FBBF24" fillOpacity="0.2" />
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="#FBBF24" />
            </svg>
          </div>

          {/* month labels */}
          <div className="mt-1 flex justify-between px-1 text-[8px] text-ink-600">
            {meses.filter((_, i) => i % 2 === 0).map((d) => (
              <span key={d.m} className="num">{d.m}</span>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Por plataforma */}
          <div className="flex flex-col gap-2 rounded-lg border border-bg-700 bg-bg-950 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Por plataforma</span>
              <span className="num text-[10px] text-ink-500">streams</span>
            </div>
            <div className="flex flex-col gap-2">
              {plataformas.map((p) => (
                <div key={p.nome} className="flex items-center gap-2">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center', p.cor)}>
                    <PlataformaIcon tipo={p.tipo} className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-ink-300">{p.nome}</span>
                      <span className="num shrink-0 text-[11px] font-semibold text-emerald-400">{p.receita}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-bg-800">
                      <div
                        className={cn('h-full rounded-full', p.cor.replace('text-', 'bg-'))}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top faixas */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-bg-700 bg-bg-950 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Top faixas</span>
              <Music2 className="h-3 w-3 text-ink-600" />
            </div>
            <div className="flex flex-col gap-1.5">
              {topFaixas.map((f, i) => (
                <div key={f.titulo} className="flex items-center gap-2">
                  <span className={cn('num w-3 text-[11px] font-bold', f.cor)}>{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[11px] font-medium text-ink-200">{f.titulo}</span>
                    <span className="num truncate text-[9px] text-ink-500">{f.streams} streams</span>
                  </div>
                  <span className="num shrink-0 text-[11px] font-semibold text-amber-400">{f.valor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockAlertas() {
  const alertas = [
    {
      tipo: 'viralizando' as const,
      icone: Flame,
      cor: 'emerald',
      plataforma: 'tiktok' as PlataformaTipo,
      titulo: 'MC Aurora viralizando no TikTok',
      detalhe: '+312% de visualizações em 24h · vídeo "Madrugada" puxando o pico',
      kpi: '+312%',
      tempo: 'há 18min',
      novo: true,
    },
    {
      tipo: 'marco' as const,
      icone: Trophy,
      cor: 'amber',
      plataforma: 'instagram' as PlataformaTipo,
      titulo: 'Luma cruzou 1M de seguidores',
      detalhe: 'Marca de 1.000.000 atingida no Instagram · meta do trimestre batida',
      kpi: '1,02M',
      tempo: 'há 2h',
      novo: true,
    },
    {
      tipo: 'queda' as const,
      icone: TrendingDown,
      cor: 'red',
      plataforma: 'instagram' as PlataformaTipo,
      titulo: 'Queda de engajamento no Instagram',
      detalhe: 'Stefano · taxa caiu de 6,4% para 3,1% nos últimos 7 dias',
      kpi: '-3,3pp',
      tempo: 'há 5h',
      novo: false,
    },
    {
      tipo: 'streaming' as const,
      icone: Music2,
      cor: 'violet',
      plataforma: 'spotify' as PlataformaTipo,
      titulo: 'Pico de streams para "Reluz"',
      detalhe: 'Bru Velloso · 84.2K streams no Spotify ontem (recorde da faixa)',
      kpi: '84,2K',
      tempo: 'há 9h',
      novo: false,
    },
    {
      tipo: 'receita' as const,
      icone: DollarSign,
      cor: 'cyan',
      plataforma: 'spotify' as PlataformaTipo,
      titulo: 'Receita OneRPM acima do previsto',
      detalhe: 'Fechamento parcial do mês · roster 18% acima da projeção',
      kpi: 'R$ 42,8K',
      tempo: 'ontem',
      novo: false,
    },
  ]

  const corMap: Record<string, { texto: string; bg: string; ring: string; dot: string }> = {
    emerald: { texto: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', dot: 'bg-emerald-400' },
    amber: { texto: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', dot: 'bg-amber-400' },
    red: { texto: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20', dot: 'bg-red-400' },
    violet: { texto: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20', dot: 'bg-violet-400' },
    cyan: { texto: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20', dot: 'bg-cyan-400' },
  }

  return (
    <div
      aria-hidden
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-bg-700 bg-bg-900"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-bg-700 bg-bg-800/50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent-400/10 text-accent-400 ring-1 ring-accent-400/20">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-400" />
            </span>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-100">Alertas</div>
            <div className="text-[11px] text-ink-500">Monitoramento do roster em tempo real</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Ao vivo
          </span>
          <span className="num inline-flex items-center rounded-full bg-bg-700 px-2 py-1 text-[10px] font-semibold text-ink-200">
            2 novos
          </span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 divide-y divide-bg-800 overflow-hidden">
        {alertas.map((a, i) => {
          const c = corMap[a.cor]
          const Icone = a.icone
          return (
            <div
              key={i}
              className={cn(
                'group flex items-start gap-3 px-4 py-3 transition-colors',
                a.novo ? 'bg-bg-800/40' : 'bg-transparent',
              )}
            >
              {/* Ícone do tipo */}
              <span
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
                  c.bg,
                  c.ring,
                  c.texto,
                )}
              >
                <Icone className="h-[18px] w-[18px]" />
              </span>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {a.novo && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} />}
                  <span className="truncate text-[13px] font-semibold text-ink-100">{a.titulo}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-ink-500">
                    <span className="h-3.5 w-3.5 text-ink-500">
                      <PlataformaIcon tipo={a.plataforma} />
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="truncate text-[11.5px] leading-snug text-ink-400">{a.detalhe}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      'num inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
                      c.bg,
                      c.texto,
                    )}
                  >
                    {a.kpi}
                  </span>
                  <span className="flex items-center gap-1 text-[10.5px] text-ink-600">
                    <Clock className="h-3 w-3" />
                    <span className="num">{a.tempo}</span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between border-t border-bg-700 bg-bg-800/50 px-4 py-2.5">
        <span className="text-[11px] text-ink-500">
          <span className="num text-ink-300">68</span> artistas monitorados
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-accent-400">
          Ver todos os alertas
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}
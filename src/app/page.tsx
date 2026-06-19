import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, BarChart3, Wallet } from 'lucide-react'
import { BrandLogo } from '@/components/shared/logo'
import { cn } from '@/lib/utils'

/**
 * Landing pública do painel (rota `/`).
 *
 * Antes esta rota redirecionava direto para `/login` — o que deixava o domínio
 * raiz como uma "parede de login". Revisores de App Review (ex.: TikTok) batem
 * no Website URL e precisam ver o que o produto é, além de links para as
 * políticas. Por isso `/` é uma página pública (server component, sem auth) que
 * descreve o painel e leva ao login. As rotas privadas continuam protegidas
 * pelo `AuthGuard`.
 *
 * Visual: mesma linguagem da tela de login — fundo aurora + grade de pontos,
 * entradas escalonadas (`animate-rise`) e título com `animate-gradient-text`.
 * Tudo em CSS (sem JS) para renderizar instantâneo ao revisor e respeitar
 * `prefers-reduced-motion` (tratado em globals.css).
 */

export const metadata: Metadata = {
  title: 'Painel de Artistas — Imagine',
  description:
    'Plataforma da Imagine para acompanhar métricas e receita dos artistas do selo, consolidando dados de YouTube, Instagram, TikTok e OneRPM mediante autorização do titular de cada conta.',
}

type Accent = 'violet' | 'emerald' | 'amber'

const RECURSOS: {
  icon: typeof BarChart3
  titulo: string
  texto: string
  accent: Accent
  visual: 'bars' | 'ring' | 'area'
}[] = [
  {
    icon: BarChart3,
    titulo: 'Métricas consolidadas',
    texto:
      'Seguidores, visualizações, engajamento e crescimento de YouTube, Instagram e TikTok, lado a lado, por artista.',
    accent: 'violet',
    visual: 'bars',
  },
  {
    icon: Activity,
    titulo: 'Saúde do artista',
    texto:
      'Um índice que resume a evolução e o engajamento de cada artista em todas as plataformas conectadas.',
    accent: 'emerald',
    visual: 'ring',
  },
  {
    icon: Wallet,
    titulo: 'Receita',
    texto: 'Royalties e streaming importados da OneRPM, detalhados por artista, faixa e plataforma.',
    accent: 'amber',
    visual: 'area',
  },
]

// Classes estáticas por acento (Tailwind não enxerga nomes dinâmicos).
const ACCENTS: Record<Accent, { chip: string; ring: string; line: string }> = {
  violet: {
    chip: 'border-violet-500/20 from-violet-500/20 to-violet-400/5 text-violet-300',
    ring: 'hover:border-violet-500/40 hover:shadow-violet-500/10',
    line: 'via-violet-500/70',
  },
  emerald: {
    chip: 'border-emerald-500/20 from-emerald-500/20 to-emerald-400/5 text-emerald-300',
    ring: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10',
    line: 'via-emerald-500/70',
  },
  amber: {
    chip: 'border-amber-500/20 from-amber-500/20 to-amber-400/5 text-amber-300',
    ring: 'hover:border-amber-500/40 hover:shadow-amber-500/10',
    line: 'via-amber-500/70',
  },
}

const ANO = new Date().getFullYear()

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-950 text-ink-300">
      {/* ── Atmosfera de fundo: aurora animada + grade de pontos com máscara ── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-bg-950 to-bg-950" />
        <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] bg-violet-600/20 rounded-full blur-3xl animate-aurora" />
        <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-amber-500/12 rounded-full blur-3xl animate-aurora [animation-delay:-7s]" />
        <div className="absolute -bottom-32 left-1/4 w-[28rem] h-[28rem] bg-fuchsia-500/12 rounded-full blur-3xl animate-aurora [animation-delay:-14s]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 72%)',
          }}
        />
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-bg-700/30 bg-bg-950/70 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Página inicial"
              className="transition-opacity hover:opacity-80"
            >
              <BrandLogo className="h-7" priority />
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-ink-200 hover:text-ink-100 px-4 py-2 rounded-lg border border-bg-700/60 bg-bg-900/40 hover:bg-bg-800/70 hover:border-violet-500/50 transition-all"
            >
              Entrar
            </Link>
          </div>
        </header>

        <section className="flex-1">
          <div className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
            <div className="grid lg:grid-cols-2 gap-14 lg:gap-8 items-center">
              {/* Texto */}
              <div className="max-w-xl">
                <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-ink-100 animate-rise">
                  Acompanhe seus artistas{' '}
                  <span className="animate-gradient-text">num só painel.</span>
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-ink-300 animate-rise [animation-delay:120ms]">
                  A ferramenta da Imagine para acompanhar métricas e receita dos artistas do selo,
                  reunindo YouTube, Instagram, TikTok e OneRPM, sempre com a autorização do titular
                  de cada conta.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-4 animate-rise [animation-delay:240ms]">
                  <Link
                    href="/login"
                    className="bg-violet-500 hover:bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/25"
                  >
                    Entrar no painel
                  </Link>
                </div>
              </div>

              {/* Visual: prévia do painel (decorativo, só em telas grandes) */}
              <div className="hidden lg:block animate-rise [animation-delay:200ms]" aria-hidden>
                <DashboardPreview />
              </div>
            </div>

            {/* Recursos */}
            <div className="mt-24 grid gap-5 sm:grid-cols-3">
              {RECURSOS.map(({ icon: Icon, titulo, texto, accent, visual }, i) => {
                const a = ACCENTS[accent]
                return (
                  <div key={titulo} className="animate-rise" style={{ animationDelay: `${360 + i * 100}ms` }}>
                    <div
                      className={cn(
                        'group relative h-full overflow-hidden rounded-2xl border border-bg-700/40 bg-gradient-to-b from-bg-900/70 to-bg-900/20 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                        a.ring
                      )}
                    >
                      {/* fio de luz no topo (aparece no hover) */}
                      <span
                        className={cn(
                          'pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100',
                          a.line
                        )}
                      />
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'grid h-10 w-10 place-items-center rounded-xl border bg-gradient-to-br transition-transform duration-300 group-hover:scale-110',
                            a.chip
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="text-base font-semibold text-ink-100">{titulo}</h2>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink-400">{texto}</p>
                      <div className="mt-5 border-t border-bg-700/30 pt-4">
                        <CardVisual tipo={visual} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <footer className="border-t border-bg-700/30">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-500">
            <span>© {ANO} Imagine Group</span>
            <nav className="flex items-center gap-5">
              <Link href="/privacidade" className="hover:text-ink-300 transition-colors">
                Política de Privacidade
              </Link>
              <Link href="/termos" className="hover:text-ink-300 transition-colors">
                Termos de Uso
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  )
}

/* ── Prévia do painel (mockup decorativo, flutuante) ───────────────────────── */

function DashboardPreview() {
  return (
    <div className="relative ml-auto w-full max-w-md animate-floaty">
      {/* halo atrás do card */}
      <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-violet-600/25 to-amber-500/10 blur-2xl" />

      <div className="rounded-2xl border border-bg-700/50 bg-bg-900/70 p-5 shadow-2xl shadow-violet-950/50 backdrop-blur-xl">
        {/* Artista + health */}
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-amber-400 font-bold text-bg-950">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink-100">MC Aurora</div>
            <div className="text-xs text-ink-500">@mcaurora</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Saúde 92
          </div>
        </div>

        {/* Streams + sparkline */}
        <div className="mt-5 rounded-xl border border-bg-700/40 bg-bg-950/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-400">Streams · últimos 30 dias</span>
            <span className="text-xs font-medium text-emerald-400">+18%</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="num text-2xl font-bold text-ink-100">1,24M</span>
            <Sparkline />
          </div>
        </div>

        {/* Plataformas */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Plataforma cor="bg-red-500" nome="YouTube" valor="1,2M" />
          <Plataforma cor="bg-pink-500" nome="Instagram" valor="340k" />
          <Plataforma cor="bg-cyan-400" nome="TikTok" valor="890k" />
        </div>

        {/* Receita */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-bg-700/40 bg-bg-950/50 px-4 py-3">
          <span className="text-xs text-ink-400">Receita do mês</span>
          <div className="flex items-center gap-2">
            <span className="num text-lg font-bold text-ink-100">R$ 24,5k</span>
            <span className="text-xs font-medium text-emerald-400">+9%</span>
          </div>
        </div>
      </div>

      {/* chip satélite flutuante */}
      <div className="absolute -top-4 -left-6 flex items-center gap-2 rounded-xl border border-bg-700/60 bg-bg-800/80 px-3 py-2 text-xs font-medium text-ink-100 shadow-xl backdrop-blur-md animate-floaty [animation-delay:-4s]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        +1.240 seguidores hoje
      </div>
    </div>
  )
}

function Sparkline() {
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-32 overflow-visible" fill="none" aria-hidden>
      <defs>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,33 C12,31 20,27 32,28 C44,29 52,21 64,19 C76,17 84,11 96,9 C108,7 114,5 120,3"
        stroke="url(#spark-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M0,33 C12,31 20,27 32,28 C44,29 52,21 64,19 C76,17 84,11 96,9 C108,7 114,5 120,3 L120,40 L0,40 Z"
        fill="url(#spark-fill)"
      />
    </svg>
  )
}

function Plataforma({ cor, nome, valor }: { cor: string; nome: string; valor: string }) {
  return (
    <div className="rounded-xl border border-bg-700/40 bg-bg-950/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', cor)} />
        <span className="truncate text-[11px] text-ink-500">{nome}</span>
      </div>
      <div className="num mt-1 text-sm font-semibold text-ink-100">{valor}</div>
    </div>
  )
}

/* ── Mini-visuais dos cards de recurso ──────────────────────────────────────── */

function CardVisual({ tipo }: { tipo: 'bars' | 'ring' | 'area' }) {
  if (tipo === 'ring') return <VisualRing />
  if (tipo === 'area') return <VisualArea />
  return <VisualBars />
}

function VisualBars() {
  const alturas = [38, 55, 46, 70, 58, 84, 72, 100]
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {alturas.map((h, i) => (
        <span
          key={i}
          className="fx-bar flex-1 rounded-t bg-gradient-to-t from-violet-600/40 to-violet-400"
          style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  )
}

function VisualRing() {
  // Medidor de 270° (abertura centralizada embaixo). Os valores de dasharray
  // batem com os keyframes `fx-ring-fill` em globals.css: circ≈113.097,
  // arco 270°=84.823, 92% do arco=78.037.
  return (
    <div className="flex items-center justify-center gap-3.5">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden>
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="84.823 113.097"
            transform="rotate(135 24 24)"
          />
          <circle
            className="fx-ring-prog"
            cx="24"
            cy="24"
            r="18"
            stroke="#34d399"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="78.037 113.097"
            transform="rotate(135 24 24)"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="num fx-count text-base font-bold text-ink-100" />
        </div>
      </div>
      <div className="text-xs leading-tight">
        <div className="font-semibold text-emerald-400">Saudável</div>
        <div className="text-ink-500">índice de saúde</div>
      </div>
    </div>
  )
}

function VisualArea() {
  // Curva exponencial: quase plana à esquerda e subindo cada vez mais forte até
  // o topo à direita ("hockey stick"). Ocupa a largura toda e NÃO usa dasharray
  // (que, com o stretch + non-scaling-stroke, cortava a linha no meio). A
  // animação de hover (fx-rise) faz o gráfico inteiro "sair do chão".
  const d = 'M0,48 C30,48 55,47 78,44 C100,41 114,33 128,23 C138,16 145,9 150,4'
  return (
    <svg viewBox="0 0 150 52" className="fx-rise h-16 w-full" preserveAspectRatio="none" fill="none" aria-hidden>
      <defs>
        <linearGradient id="cv-area-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
        <linearGradient id="cv-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L150,52 L0,52 Z`} fill="url(#cv-area-fill)" />
      <path
        d={d}
        stroke="url(#cv-area-stroke)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

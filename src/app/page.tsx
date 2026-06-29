import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { BrandLogo } from '@/components/shared/logo'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { cn } from '@/lib/utils'
import { FeatureShowcase } from '@/components/landing/feature-showcase'

/**
 * Landing pública do painel (rota `/`).
 *
 * `/` é uma página pública (server component, sem auth): descreve o produto e
 * leva ao login. Revisores de App Review (ex.: TikTok) batem no Website URL e
 * precisam ver o que o produto é + links para as políticas. As rotas privadas
 * seguem protegidas pelo `AuthGuard`.
 *
 * Direção visual: tema escuro premium da Imagine + energia/estrutura do Viberate
 * — hero com cluster de cards flutuantes, carrossel infinito de logos das
 * plataformas, banda de números e um showcase de recursos em abas
 * (`FeatureShowcase`, client component). Animações em CSS respeitam
 * `prefers-reduced-motion` (tratado em globals.css).
 */

export const metadata: Metadata = {
  title: 'Painel de Artistas — Imagine',
  description:
    'Plataforma da Imagine e dos seus artistas para acompanhar métricas e receita, consolidando dados de YouTube, Instagram, TikTok e OneRPM mediante autorização do titular de cada conta.',
}

/* Plataformas do carrossel infinito (as que o painel consome + OneRPM).
   Logos brancos servidos de /public/logos; OneRPM usa o selo próprio (OneRpmMark). */
const PLATAFORMAS: { nome: string; logo?: string; tam?: string; inv?: boolean }[] = [
  { nome: 'YouTube', logo: '/logos/youtube.svg' },
  { nome: 'Instagram', logo: '/logos/instagram.svg' },
  { nome: 'Meta', logo: '/logos/meta.svg' },
  { nome: 'TikTok', logo: '/logos/tiktok.svg', tam: 'h-9 w-9' },
  { nome: 'Spotify', logo: '/logos/spotify.svg' },
  { nome: 'Apple Music', logo: '/logos/applemusic.svg' },
  { nome: 'Deezer', logo: '/logos/deezer.svg' },
  // OneRPM tem logo escura (feita p/ fundo claro) → renderiza em branco no escuro.
  { nome: 'OneRPM', logo: '/logos/onerpm.svg', tam: 'h-9 w-9', inv: true },
]

// Repetimos a lista o suficiente pra UMA metade da faixa já ser mais larga que
// a tela — assim o carrossel nunca mostra espaço vazio ao "virar". O JSX
// renderiza duas metades idênticas e a animação anda -50% (volta exatamente ao
// ponto de partida, sem emenda).
const FILA_LOGOS = Array.from({ length: 4 }, () => PLATAFORMAS).flat()

/* ⚠️  EDITE AQUI: números da banda de estatísticas (ajuste ao roster real). */
const ESTATISTICAS = [
  { valor: '100+', rotulo: 'Artistas no roster' },
  { valor: '8', rotulo: 'Plataformas conectadas' },
  { valor: '24h', rotulo: 'Dados atualizados' },
  { valor: '100%', rotulo: 'Sob autorização' },
]

const ANO = new Date().getFullYear()

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-950 text-ink-300 antialiased">
      {/* ── Atmosfera de fundo: aurora colorida (energia Viberate) sobre o escuro ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-bg-950 to-bg-950" />
        <div className="absolute -top-44 -left-40 h-[34rem] w-[34rem] rounded-full bg-violet-600/20 blur-3xl animate-aurora" />
        <div className="absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/15 blur-3xl animate-aurora [animation-delay:-6s]" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-sky-500/12 blur-3xl animate-aurora [animation-delay:-11s]" />
        <div className="absolute bottom-0 left-1/4 h-[26rem] w-[26rem] rounded-full bg-amber-500/[0.08] blur-3xl animate-aurora [animation-delay:-16s]" />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 72%)',
          }}
        />
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-bg-700/30 bg-bg-950/70 backdrop-blur-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/30 to-transparent"
          />
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/" aria-label="Página inicial" className="transition-opacity hover:opacity-80">
              <BrandLogo className="h-7" priority />
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-bg-700/60 bg-bg-900/40 px-4 py-2 text-sm font-medium text-ink-200 transition-all hover:border-violet-500/50 hover:bg-bg-800/70 hover:text-ink-100"
            >
              Entrar
            </Link>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="relative">
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8">
            <div className="max-w-xl">
              <h1 className="hero-title font-bold text-ink-100 animate-rise">
                Toda a carreira dos seus artistas{' '}
                <span className="accent-vibe">num só painel</span>
              </h1>

              <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-300 animate-rise [animation-delay:160ms]">
                A Imagine reúne as métricas e a receita dos seus artistas em uma só
                visão atualizada todo dia e sempre com a autorização do titular de
                cada conta
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4 animate-rise [animation-delay:240ms]">
                <Link
                  href="/login"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-500/30"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/40" />
                  Entrar no painel
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Cluster de cards flutuantes (decorativo) */}
            <div className="animate-rise [animation-delay:200ms]" aria-hidden>
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* ── Recursos: showcase em abas (estilo Viberate) ── */}
        <section id="recursos" className="mx-auto w-full max-w-6xl px-6 pb-20 pt-20">
          <div className="mb-8 flex items-baseline justify-between border-b border-bg-700/40 pb-5">
            <h2 className="text-sm font-semibold tracking-tight text-ink-200">O que você acompanha</h2>
            <span className="mono-eyebrow text-ink-600">Visão por artista</span>
          </div>
          <FeatureShowcase />
        </section>

        {/* ── Banda de números ── */}
        <section className="relative border-t border-bg-700/30">
          <div className="mx-auto max-w-6xl px-6 pb-12 pt-16 text-center">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">
              Todas as suas plataformas{' '}
              <span className="accent-vibe">num só lugar</span>
            </h2>

            <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {ESTATISTICAS.map(({ valor, rotulo }) => (
                <div key={rotulo}>
                  <div className="num text-4xl font-bold text-ink-100 sm:text-5xl">{valor}</div>
                  <div className="mt-1.5 text-sm text-ink-400">{rotulo}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Carrossel infinito de plataformas (faixa antes do rodapé) ── */}
        <section className="relative marquee-mask overflow-hidden border-t border-bg-700/30 py-8">
          <div className="flex w-max animate-marquee">
            {[...FILA_LOGOS, ...FILA_LOGOS].map((p, i) => (
              <LogoTile key={`${p.nome}-${i}`} {...p} />
            ))}
          </div>
        </section>

        <footer className="border-t border-bg-700/30">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-ink-500 sm:flex-row">
            <span>© {ANO} Imagine Group</span>
            <nav className="flex items-center gap-5">
              <Link href="/privacidade" className="transition-colors hover:text-ink-300">
                Política de Privacidade
              </Link>
              <Link href="/termos" className="transition-colors hover:text-ink-300">
                Termos de Uso
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  )
}

/* ── Carrossel: tile de logo de plataforma ─────────────────────────────────── */

function LogoTile({ nome, logo, tam, inv }: { nome: string; logo?: string; tam?: string; inv?: boolean }) {
  return (
    <div className="mx-3 flex shrink-0 flex-col items-center gap-2.5">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-bg-700/50 bg-bg-900/60 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/5 transition-colors hover:border-bg-700">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={nome} className={cn('object-contain opacity-90', tam || 'h-7 w-7', inv && 'brightness-0 invert')} loading="lazy" />
        ) : (
          <span className="h-7 w-7 text-amber-400">
            <OneRpmMark className="h-full w-full" />
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-ink-400">{nome}</span>
    </div>
  )
}

function OneRpmMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M10.6 7.4h2.4v9.2h-2.2V9.6l-1.7.5-.4-1.7z" fill="#0F0B1F" />
    </svg>
  )
}

/* ── Hero: cluster de cards flutuantes (decorativo) ────────────────────────── */

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
      {/* halo colorido atrás do cluster */}
      <div className="absolute -inset-8 -z-20 rounded-[3rem] bg-gradient-to-br from-violet-600/25 via-fuchsia-500/10 to-sky-500/10 blur-3xl" />
      {/* card-base atrás — profundidade empilhada */}
      <div className="absolute inset-x-4 top-6 -z-10 h-full rounded-2xl border border-bg-700/30 bg-bg-900/40" />

      {/* Card principal — moldura de app */}
      <div className="overflow-hidden rounded-2xl border border-bg-700/50 bg-bg-900/70 shadow-2xl shadow-violet-950/50 ring-1 ring-inset ring-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-bg-700/40 bg-bg-950/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-bg-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-bg-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-bg-700" />
          <span className="ml-3 truncate rounded-md bg-bg-800/60 px-2.5 py-1 text-[11px] text-ink-500">
            painel.imagine / artistas
          </span>
        </div>

        <div className="p-5">
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

          <div className="mt-5 rounded-xl border border-bg-700/40 bg-bg-950/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-400">Streams · últimos 30 dias</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                +18%
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="num text-2xl font-bold text-ink-100">1,24M</span>
              <Sparkline />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Plataforma cor="bg-red-500" nome="YouTube" valor="1,2M" delta="+12%" />
            <Plataforma cor="bg-pink-500" nome="Instagram" valor="340k" delta="+6%" />
            <Plataforma cor="bg-cyan-400" nome="TikTok" valor="890k" delta="+21%" />
          </div>
        </div>
      </div>

      {/* chip flutuante: seguidores hoje */}
      <div className="absolute -left-4 -top-4 flex items-center gap-2 rounded-xl border border-bg-700/60 bg-bg-800/80 px-3 py-2 text-xs font-medium text-ink-100 shadow-xl ring-1 ring-inset ring-white/5 backdrop-blur-md animate-floaty [animation-delay:-3s]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        +1.240 seguidores hoje
      </div>

      {/* card flutuante: pizza de audiência por plataforma (estilo Viberate) */}
      <div className="absolute -bottom-14 -left-12 hidden animate-floaty rounded-2xl border border-bg-700/50 bg-bg-900/85 p-6 shadow-2xl ring-1 ring-inset ring-white/5 backdrop-blur-md [animation-delay:-6s] sm:block">
        <DonutAudiencia />
      </div>

      {/* card flutuante: ouvintes Spotify */}
      <div className="absolute -bottom-9 -right-6 hidden animate-floaty rounded-xl border border-bg-700/50 bg-bg-900/85 px-4 py-3 shadow-2xl ring-1 ring-inset ring-white/5 backdrop-blur-md [animation-delay:-5s] sm:block">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 text-emerald-400">
            <PlataformaIcon tipo="spotify" />
          </span>
          <span className="text-[11px] text-ink-400">Ouvintes mensais</span>
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="num text-lg font-bold text-ink-100">63,8M</span>
          <span className="mb-0.5 text-[11px] font-medium text-emerald-400">+4,2%</span>
        </div>
      </div>
    </div>
  )
}

// Pizza de audiência estilo Viberate: anel com os ícones das plataformas em
// "bolhas" ao redor (N/L/S/O) e o total no centro.
function DonutAudiencia() {
  return (
    <div className="relative h-32 w-32">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(#ef4444 0 30%, #d946ef 30% 55%, #22d3ee 55% 78%, #34d399 78% 100%)',
        }}
      >
        <div className="absolute inset-[11px] grid place-items-center rounded-full bg-bg-900 text-center">
          <div>
            <div className="num text-lg font-bold text-ink-100">80,9M</div>
            <div className="text-[9px] text-ink-500">audiência total</div>
          </div>
        </div>
      </div>
      <IconeBolha tipo="youtube" cor="text-red-500" className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
      <IconeBolha tipo="instagram" cor="text-fuchsia-500" className="right-0 top-1/2 -translate-y-1/2 translate-x-1/2" />
      <IconeBolha tipo="tiktok" cor="text-cyan-400" className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />
      <IconeBolha tipo="spotify" cor="text-emerald-400" className="left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  )
}

function IconeBolha({ tipo, cor, className }: { tipo: PlataformaTipo; cor: string; className: string }) {
  return (
    <span
      className={cn(
        'absolute grid h-8 w-8 place-items-center rounded-full border border-bg-700/60 bg-bg-800 shadow-lg ring-1 ring-inset ring-white/10',
        className,
      )}
    >
      <span className={cn('h-4 w-4', cor)}>
        <PlataformaIcon tipo={tipo} />
      </span>
    </span>
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

function Plataforma({
  cor,
  nome,
  valor,
  delta,
}: {
  cor: string
  nome: string
  valor: string
  delta: string
}) {
  return (
    <div className="rounded-xl border border-bg-700/40 bg-bg-950/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', cor)} />
        <span className="truncate text-[11px] text-ink-500">{nome}</span>
      </div>
      <div className="num mt-1 text-sm font-semibold text-ink-100">{valor}</div>
      <div className="mt-0.5 text-[10px] font-medium text-emerald-400">{delta}</div>
    </div>
  )
}

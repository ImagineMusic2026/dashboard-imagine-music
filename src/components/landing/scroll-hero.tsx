'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
 * Hero "scroll preso" (estilo OneRPM).
 *
 * Desktop (>= lg): a seção tem altura de N telas e o conteúdo fica `sticky` no
 * topo; conforme a pessoa rola, o slide ativo muda SEM a página descer. Ao passar
 * do último slide, o sticky solta e o resto da página aparece normalmente.
 *
 * Mobile: sem prender o scroll — vira um hero normal de uma tela que troca os
 * slides sozinho (respeitando prefers-reduced-motion). O visual do produto
 * (children) fica fixo ao lado/abaixo; só o título + a cor de acento giram.
 *
 * ⚠️ A altura no desktop é `lg:h-[400vh]` = 100vh por slide. Se mudar a
 * quantidade de SLIDES, ajuste esse valor (N * 100vh).
 * ───────────────────────────────────────────────────────────────────────────── */

type AccentKey = 'violet' | 'fuchsia' | 'sky' | 'amber'

type Slide = {
  kicker: string
  titulo: string
  destaque: string
  sub: string
  cor: AccentKey
}

// ⚠️ EDITE AQUI os títulos dos slides (curtos e fortes — o artista também lê).
const SLIDES: Slide[] = [
  {
    kicker: 'A plataforma da Imagine',
    titulo: 'Toda a carreira dos seus artistas',
    destaque: 'num só painel',
    sub: 'Métricas e receita de todas as plataformas reunidas em um só lugar',
    cor: 'violet',
  },
  {
    kicker: 'Em tempo real',
    titulo: 'Cada número que importa',
    destaque: 'no mesmo lugar',
    sub: 'YouTube Instagram TikTok e streaming lado a lado por artista',
    cor: 'fuchsia',
  },
  {
    kicker: 'Crescimento',
    titulo: 'Do primeiro stream',
    destaque: 'ao próximo marco',
    sub: 'Acompanhe a evolução de cada artista dia após dia',
    cor: 'sky',
  },
  {
    kicker: 'Decisão',
    titulo: 'Mais clareza',
    destaque: 'para crescer mais rápido',
    sub: 'Saúde audiência e receita juntas para você decidir com dados',
    cor: 'amber',
  },
]

const ACENTOS: Record<
  AccentKey,
  { kicker: string; destaque: string; dot: string; b1: string; b2: string }
> = {
  violet: {
    kicker: 'text-violet-300',
    destaque: 'from-violet-300 to-fuchsia-300',
    dot: 'bg-violet-400',
    b1: 'bg-violet-600/25',
    b2: 'bg-fuchsia-500/15',
  },
  fuchsia: {
    kicker: 'text-fuchsia-300',
    destaque: 'from-fuchsia-300 to-pink-300',
    dot: 'bg-fuchsia-400',
    b1: 'bg-fuchsia-600/25',
    b2: 'bg-violet-500/15',
  },
  sky: {
    kicker: 'text-sky-300',
    destaque: 'from-sky-300 to-cyan-300',
    dot: 'bg-sky-400',
    b1: 'bg-sky-600/25',
    b2: 'bg-cyan-500/15',
  },
  amber: {
    kicker: 'text-amber-300',
    destaque: 'from-amber-200 to-orange-300',
    dot: 'bg-amber-400',
    b1: 'bg-amber-500/20',
    b2: 'bg-orange-500/12',
  },
}

export function ScrollHero({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)

  // Detecta desktop (>= lg) — só aí o scroll fica "preso".
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const aplicar = () => setIsDesktop(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])

  // Desktop: slide ativo derivado da posição de scroll dentro da seção.
  useEffect(() => {
    if (!isDesktop) return
    const el = wrapRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const dist = el.offsetHeight - window.innerHeight
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(dist, 1))
        const progresso = dist > 0 ? scrolled / dist : 0
        const idx = Math.min(SLIDES.length - 1, Math.floor(progresso * SLIDES.length))
        setAtivo(idx)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [isDesktop])

  // Mobile: troca automática (sem prender o scroll).
  useEffect(() => {
    if (isDesktop) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setAtivo((i) => (i + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [isDesktop])

  // Clicar num indicador: no desktop rola até a faixa do slide; no mobile só troca.
  const irPara = (i: number) => {
    const el = wrapRef.current
    if (isDesktop && el) {
      const dist = el.offsetHeight - window.innerHeight
      const alvo = el.offsetTop + ((i + 0.5) / SLIDES.length) * dist
      window.scrollTo({ top: alvo, behavior: 'smooth' })
    } else {
      setAtivo(i)
    }
  }

  return (
    <section ref={wrapRef} className="relative lg:h-[400vh]">
      <div className="flex min-h-screen items-center overflow-hidden lg:sticky lg:top-0 lg:h-screen">
        {/* Fundo: blobs de acento que trocam de cor por slide */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-950/0 via-bg-950/0 to-bg-950" />
          {SLIDES.map((s, i) => {
            const a = ACENTOS[s.cor]
            return (
              <div
                key={i}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700 ease-out',
                  i === ativo ? 'opacity-100' : 'opacity-0',
                )}
              >
                <div className={cn('absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full blur-3xl', a.b1)} />
                <div className={cn('absolute top-1/4 right-0 h-[32rem] w-[32rem] rounded-full blur-3xl', a.b2)} />
              </div>
            )
          })}
        </div>

        {/* Conteúdo */}
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:gap-8 lg:py-0">
          {/* Coluna de texto (slides em crossfade) */}
          <div className="max-w-xl">
            <h1 className="sr-only">Imagine — painel de gestão de artistas</h1>

            <div className="relative min-h-[19rem] sm:min-h-[20rem] lg:min-h-[23rem]">
              {SLIDES.map((s, i) => {
                const a = ACENTOS[s.cor]
                const atual = i === ativo
                return (
                  <div
                    key={i}
                    aria-hidden={!atual}
                    className={cn(
                      'absolute inset-0 transition-all duration-500 ease-out',
                      atual ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-3 opacity-0',
                    )}
                  >
                    <p className={cn('mono-eyebrow', a.kicker)}>{s.kicker}</p>
                    <p className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-5xl lg:text-6xl">
                      {s.titulo}{' '}
                      <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', a.destaque)}>
                        {s.destaque}
                      </span>
                    </p>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-300">{s.sub}</p>
                  </div>
                )
              })}
            </div>

            {/* CTA + indicadores (fixos) */}
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="/login"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-500/30"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/40" />
                Entrar no painel
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <div className="flex items-center gap-2.5">
                {SLIDES.map((s, i) => {
                  const a = ACENTOS[s.cor]
                  const atual = i === ativo
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => irPara(i)}
                      aria-label={`Slide ${i + 1}`}
                      aria-current={atual}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        atual ? cn('w-7', a.dot) : 'w-1.5 bg-bg-700 hover:bg-bg-700/70',
                      )}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Visual do produto (fixo em todos os slides) */}
          <div aria-hidden>{children}</div>
        </div>

        {/* Dica de scroll (só desktop, some depois do 1º slide) */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center transition-opacity duration-500 lg:flex',
            ativo === 0 ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-500">
            <ChevronDown className="h-4 w-4 animate-bounce" />
            role para explorar
          </span>
        </div>
      </div>
    </section>
  )
}

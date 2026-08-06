'use client'

/**
 * Home pública (`/`) — corpo da landing redesenhada (Claude Design, ago/2026).
 *
 * Direção visual: dark quase-preto (#07070C) com accent roxo #7C5CFF, títulos
 * em Familjen Grotesk (aplicada no `page.tsx` via next/font) e números em
 * JetBrains Mono (var global `--font-mono`). Estrutura: hero com contador
 * gigante, marquee de plataformas, grade do roster, 3 blocos de recursos com
 * mockups, banda de estatísticas, marquee de cards de artistas e CTA final.
 *
 * Motion (portado do protótipo do Claude Design em `useMotionLanding`):
 * - Smooth scroll com inércia (lerp): o wrapper fica `position:fixed` e anda
 *   via transform; um spacer dá altura real ao documento. Só no desktop e
 *   fora de `prefers-reduced-motion` — no mobile o scroll é nativo.
 * - Parallax leve nos glows e mockups (`data-par`), reveal on scroll com
 *   delay (`data-rv`/`data-d`) e contadores que sobem ao entrar na tela
 *   (`data-count`). O texto final já vem renderizado do servidor, então sem
 *   JS a página fica íntegra.
 *
 * Artistas/números são FICTÍCIOS (aprovados no design) — retrato ilustrativo
 * do produto, não dado real. Fotos: por ora placeholders em gradiente com a
 * inicial; para usar foto real, coloque o arquivo em `public/landing/` e
 * preencha `foto` no array `ARTISTAS`.
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/logo'
import { cn } from '@/lib/utils'

/* ── Dados fictícios do design ─────────────────────────────────────────────── */

const PLATAFORMAS: { nome: string; cor: string }[] = [
  { nome: 'YouTube', cor: '#FF3B30' },
  { nome: 'Instagram', cor: '#E1306C' },
  { nome: 'Meta', cor: '#1877F2' },
  { nome: 'TikTok', cor: '#38E0D6' },
  { nome: 'Spotify', cor: '#34D399' },
  { nome: 'Apple Music', cor: '#FC5C7D' },
  { nome: 'Deezer', cor: '#A238FF' },
  { nome: 'OneRPM', cor: '#B6A3FF' },
]

type Artista = {
  nome: string
  handle: string
  genero: string
  streams: string
  delta: string
  saude: number
  /** Gradiente do placeholder de foto (par [de, para]). */
  grad: [string, string]
  /** Polyline do sparkline (viewBox 0 0 84 30). */
  spark: string
  /** Caminho de foto real em /public (ex.: '/landing/marilia.webp'). */
  foto?: string
}

const ARTISTAS: Artista[] = [
  { nome: 'Marília Vasques', handle: '@mariliavasques', genero: 'Pop / MPB', streams: '4,82M', delta: '+18,4%', saude: 92, grad: ['#4A3AA0', '#171232'], spark: '0,24 12,21 24,22 36,15 48,17 60,9 72,11 84,4' },
  { nome: 'Beto Caldas', handle: '@betocaldas', genero: 'Arrocha', streams: '3,57M', delta: '+11,7%', saude: 79, grad: ['#0E6159', '#0E1A20'], spark: '0,22 12,19 24,23 36,16 48,13 60,15 72,8 84,6' },
  { nome: 'Duo Aurora', handle: '@duoaurora', genero: 'Forró', streams: '2,90M', delta: '+24,6%', saude: 88, grad: ['#7C2D5B', '#1B1023'], spark: '0,26 12,24 24,18 36,20 48,12 60,14 72,7 84,3' },
  { nome: 'Lia Ferraz', handle: '@liaferraz', genero: 'Sertanejo', streams: '2,11M', delta: '-3,8%', saude: 67, grad: ['#2E3E80', '#101528'], spark: '0,8 12,11 24,9 36,14 48,13 60,18 72,17 84,21' },
  { nome: 'Núcleo Sul', handle: '@nucleosul', genero: 'Arrocha', streams: '1,78M', delta: '+7,2%', saude: 74, grad: ['#1F5D86', '#0F1622'], spark: '0,23 12,20 24,21 36,17 48,18 60,12 72,13 84,9' },
  { nome: 'Rafa Quintana', handle: '@rafaquintana', genero: 'Gospel', streams: '1,46M', delta: '+5,9%', saude: 58, grad: ['#20684C', '#0F1A17'], spark: '0,20 12,22 24,17 36,19 48,14 60,16 72,11 84,10' },
  { nome: 'Mel & os Cometas', handle: '@melcometas', genero: 'Pop', streams: '1,02M', delta: '+2,1%', saude: 71, grad: ['#6A4BC4', '#191233'], spark: '0,25 12,22 24,23 36,19 48,20 60,16 72,17 84,14' },
  { nome: 'MC Aurora', handle: '@mcaurora', genero: 'Arrocha', streams: '890k', delta: '+21,0%', saude: 92, grad: ['#A03A6B', '#1C1023'], spark: '0,27 12,21 24,19 36,13 48,15 60,8 72,9 84,2' },
]

/* Colunas extras da tabela de métricas (views + variação, 7 primeiras linhas). */
const VIEWS = ['12,1M', '8,4M', '6,9M', '5,2M', '4,1M', '3,3M', '2,6M']
const VIEWS_DELTA = ['+9,2%', '+2,3%', '+15,1%', '+1,4%', '-5,6%', '+8,7%', '+3,0%']

const PILARES: [string, number][] = [
  ['Engajamento', 95],
  ['Crescimento', 88],
  ['Consistência', 90],
  ['Audiência', 93],
  ['Receita', 84],
]

/* ⚠️  EDITE AQUI: números da banda de estatísticas (ajuste ao roster real). */
const ESTATISTICAS = [
  { rotulo: '100+', n: '100', sufixo: '+', legenda: 'Artistas no roster', atraso: 0 },
  { rotulo: '8', n: '8', sufixo: '', legenda: 'Plataformas conectadas', atraso: 80 },
  { rotulo: '24h', n: '24', sufixo: 'h', legenda: 'Dados atualizados', atraso: 160 },
  { rotulo: '100%', n: '100', sufixo: '%', legenda: 'Sob autorização', atraso: 240 },
]

const MENU: [string, string][] = [
  ['Artistas', '#roster'],
  ['O que acompanha', '#recursos'],
  ['Integrações', '#plataformas'],
]

const ANO = new Date().getFullYear()

const corDelta = (delta: string) => (delta.startsWith('-') ? '#F87171' : '#34D399')

/* ── Motion (portado do protótipo) ─────────────────────────────────────────── */

function useMotionLanding() {
  const navRef = useRef<HTMLElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const nav = navRef.current
    const spacer = spacerRef.current
    if (!wrap) return

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const suave = !reduzido && window.innerWidth > 820 && !/Mobi|Android/i.test(navigator.userAgent)

    if (suave) {
      /* Sem `will-change: transform` aqui de propósito: promover um layer de
         ~5600px inteiro estoura o orçamento de rasterização (a página chegou
         a renderizar em branco); o transform por frame já compõe sozinho. */
      Object.assign(wrap.style, { position: 'fixed', top: '0', left: '0', width: '100%' })
    }

    /* Contador: 0 → alvo em 1,5s com ease-out cúbico; vírgula como separador. */
    const contar = (el: HTMLElement) => {
      const ate = parseFloat(el.dataset.count || '')
      if (Number.isNaN(ate)) return
      const pfx = el.dataset.prefix || ''
      const sfx = el.dataset.suffix || ''
      const dec = String(ate).includes('.') ? 1 : 0
      const t0 = performance.now()
      const passo = (t: number) => {
        const p = Math.min(1, (t - t0) / 1500)
        const e = 1 - Math.pow(1 - p, 3)
        el.textContent = pfx + (ate * e).toFixed(dec).replace('.', ',') + sfx
        if (p < 1) requestAnimationFrame(passo)
      }
      requestAnimationFrame(passo)
    }

    /* Reveal on scroll. Depois que a entrada termina, limpamos os estilos
       inline pra devolver o elemento às classes (senão o transform/transition
       inline "engole" os hovers, ex.: card do roster que sobe no hover). */
    const easeCss = 'cubic-bezier(.16,1,.3,1)'
    const timeouts = new Set<number>()
    const io = reduzido
      ? null
      : new IntersectionObserver(
          (entradas) => {
            entradas.forEach((entrada) => {
              if (!entrada.isIntersecting) return
              const el = entrada.target as HTMLElement
              if (el.dataset.count !== undefined) contar(el)
              el.style.opacity = '1'
              el.style.transform = ''
              const espera = parseInt(el.dataset.d || '0', 10) + 1100
              timeouts.add(
                window.setTimeout(() => {
                  el.style.transition = ''
                  el.style.opacity = ''
                }, espera),
              )
              io!.unobserve(el)
            })
          },
          { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
        )
    if (io) {
      wrap.querySelectorAll<HTMLElement>('[data-rv]').forEach((el) => {
        const d = parseInt(el.dataset.d || '0', 10) / 1000
        el.style.opacity = '0'
        el.style.transform = 'translateY(26px)'
        el.style.transition = `opacity .95s ${easeCss} ${d}s, transform 1.05s ${easeCss} ${d}s`
        io.observe(el)
      })
      wrap.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => io.observe(el))
    }

    /* Parallax: guarda o centro de cada `[data-par]` relativo ao wrapper e
       aplica um translateY proporcional à distância do meio da viewport. */
    let pars: { el: HTMLElement; centro: number; k: number }[] = []
    let vh = window.innerHeight
    const remedir = () => {
      const els = Array.from(wrap.querySelectorAll<HTMLElement>('[data-par]'))
      els.forEach((el) => {
        el.style.transform = ''
      })
      const topoWrap = wrap.getBoundingClientRect().top
      pars = els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          el,
          centro: r.top - topoWrap + r.height / 2,
          k: parseFloat(el.dataset.par || '0') * 44 * (90 / 70),
        }
      })
      if (suave && spacer) spacer.style.height = `${Math.round(wrap.scrollHeight)}px`
      vh = window.innerHeight
    }
    remedir()

    let cur = window.scrollY || 0
    let navOn: boolean | null = null
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const alvo = window.scrollY || 0
      if (suave) {
        cur += (alvo - cur) * 0.085
        if (Math.abs(alvo - cur) < 0.06) cur = alvo
        wrap.style.transform = `translate3d(0,${(-cur).toFixed(2)}px,0)`
      } else {
        cur = alvo
      }
      if (!reduzido) {
        const meio = cur + vh / 2
        for (const p of pars) {
          const prog = (meio - p.centro) / vh
          if (prog < -1.6 || prog > 1.6) continue
          p.el.style.transform = `translate3d(0,${(prog * p.k).toFixed(1)}px,0)`
        }
      }
      if (nav) {
        const on = cur > 40
        if (on !== navOn) {
          navOn = on
          nav.style.background = on ? 'rgba(7,7,12,.72)' : 'transparent'
          nav.style.backdropFilter = on ? 'blur(20px)' : 'none'
          nav.style.borderBottomColor = on ? 'rgba(255,255,255,.07)' : 'transparent'
        }
      }
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(remedir)
    ro.observe(wrap)
    window.addEventListener('resize', remedir)

    /* Âncoras do menu: com o wrapper fixo, o offset nativo do fragmento não
       existe mais — calculamos a posição dentro do wrapper e pulamos o scroll
       da janela pra lá (o lerp faz a suavização). Sem hijack, âncora nativa. */
    const aoClicarAncora = (ev: MouseEvent) => {
      if (!suave) return
      const a = (ev.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a) return
      const id = a.getAttribute('href')!.slice(1)
      const destino = id === 'top' ? wrap : wrap.querySelector<HTMLElement>(`#${id}`)
      if (!destino) return
      ev.preventDefault()
      const topo =
        id === 'top'
          ? 0
          : destino.getBoundingClientRect().top - wrap.getBoundingClientRect().top
      window.scrollTo({ top: topo, behavior: 'instant' as ScrollBehavior })
    }
    nav?.addEventListener('click', aoClicarAncora)

    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
      ro.disconnect()
      timeouts.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', remedir)
      nav?.removeEventListener('click', aoClicarAncora)
      if (spacer) spacer.style.height = ''
      Object.assign(wrap.style, { position: '', top: '', left: '', width: '', transform: '' })
    }
  }, [])

  return { navRef, wrapRef, spacerRef }
}

/* ── Página ────────────────────────────────────────────────────────────────── */

export function LandingHome() {
  const { navRef, wrapRef, spacerRef } = useMotionLanding()

  return (
    <>
      <Nav navRef={navRef} />

      <div ref={wrapRef} id="top" className="bg-[#07070C]">
        <Hero />
        <Plataformas />
        <Roster />
        <Recursos />
        <Estatisticas />
        <CardsArtistas />
        <CtaFinal />
        <Rodape />
      </div>

      {/* Dá altura ao documento enquanto o wrapper está fixo (smooth scroll). */}
      <div ref={spacerRef} aria-hidden />
    </>
  )
}

/* ── Nav fixa (fundo/blur ligados por JS ao rolar) ─────────────────────────── */

function Nav({ navRef }: { navRef: React.MutableRefObject<HTMLElement | null> }) {
  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-between gap-6 border-b border-transparent px-[clamp(18px,3.4vw,52px)] py-4 transition-[background,border-color,backdrop-filter] duration-[450ms]"
    >
      <a href="#top" aria-label="Voltar ao topo" className="flex flex-none items-center">
        <BrandLogo className="h-[22px] opacity-95" priority />
      </a>
      <div className="hidden items-center gap-[30px] text-[13.5px] tracking-[-0.01em] md:flex">
        {MENU.map(([rotulo, href]) => (
          <a key={href} href={href} className="text-[#8E8BA3] transition-colors duration-300 hover:text-[#F3F2F7]">
            {rotulo}
          </a>
        ))}
      </div>
      <div className="flex flex-none items-center gap-3.5">
        <Link
          href="/login"
          className="hidden text-[13.5px] text-[#8E8BA3] transition-colors duration-300 hover:text-[#F3F2F7] sm:block"
        >
          Entrar
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-[#7C5CFF] px-[17px] py-[9px] text-[13.5px] font-medium text-white shadow-[0_6px_24px_-8px_#7C5CFF] [transition:transform_.35s_cubic-bezier(.16,1,.3,1),box-shadow_.35s] hover:-translate-y-px hover:shadow-[0_12px_30px_-8px_#7C5CFF]"
        >
          Entrar no painel
        </Link>
      </div>
    </nav>
  )
}

/* ── Hero: contador gigante + headline + faces do roster ───────────────────── */

function Hero() {
  return (
    <header className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-[clamp(18px,3.4vw,52px)] pb-[60px] pt-[130px] text-center">
      {/* Glow central. O elemento com `data-par` fica DENTRO de um wrapper que
          centraliza — o parallax sobrescreve o transform inline, então não
          pode dividir elemento com o translateX(-50%). */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[14%] w-[92vw] max-w-[1300px] -translate-x-1/2">
        <div
          data-par="0.7"
          className="h-[62vw] max-h-[820px] rounded-full blur-[30px]"
          style={{ background: 'radial-gradient(ellipse,rgba(124,92,255,.34),rgba(124,92,255,0) 62%)' }}
        />
      </div>

      <div data-rv className="relative font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.24em] text-[#66647c]">
        imagine music · roster {ANO}
      </div>

      <div data-rv data-d="80" className="relative mt-[26px]">
        <div
          data-count="80.9"
          data-prefix="+"
          data-suffix="M"
          className="animate-sheen pr-[0.06em] font-mono text-[clamp(84px,17.5vw,250px)] font-medium leading-[0.86] tracking-[-0.06em] text-transparent"
          style={{
            backgroundImage: 'linear-gradient(96deg,#FFFFFF,#B6A3FF 34%,#7C5CFF 58%,#38E0D6 92%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
          }}
        >
          +80,9M
        </div>
      </div>
      <div data-rv data-d="150" className="relative mt-1.5 font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-[#8E8BA3]">
        pessoas ouvindo os artistas da imagine
      </div>

      <h1 data-rv data-d="220" className="relative mt-11 max-w-[19ch] text-balance text-[clamp(30px,4.2vw,58px)] font-medium leading-[1.02] tracking-[-0.035em]">
        Toda essa carreira cabe <span className="text-[#B6A3FF]">num só painel</span>
      </h1>
      <p data-rv data-d="280" className="relative mt-[22px] max-w-[50ch] text-pretty text-[17px] leading-relaxed text-[#A5A2B8]">
        Métricas e receita de YouTube, Instagram, TikTok e streaming — lado a lado, por artista, atualizadas todo dia.
      </p>

      <div data-rv data-d="340" className="relative mt-[38px] flex flex-wrap items-center justify-center gap-3.5">
        <Link
          href="/login"
          className="inline-flex items-center gap-[11px] rounded-full bg-[#7C5CFF] px-[26px] py-[15px] text-[15px] font-medium text-white shadow-[0_14px_42px_-12px_#7C5CFF] [transition:transform_.4s_cubic-bezier(.16,1,.3,1),box-shadow_.4s] hover:-translate-y-0.5 hover:shadow-[0_22px_54px_-12px_#7C5CFF]"
        >
          Entrar no painel <span className="font-mono">→</span>
        </Link>
      </div>

      <div data-rv data-d="400" className="relative mt-[52px] flex items-center gap-3.5">
        <div className="flex">
          {ARTISTAS.slice(0, 6).map((a) => (
            <div
              key={a.handle}
              className="-ml-[11px] h-[42px] w-[42px] overflow-hidden rounded-full border-2 border-[#07070C] bg-[#1a1a28] first:ml-0"
            >
              <AvatarArtista artista={a} textClass="text-[13px]" />
            </div>
          ))}
        </div>
        <span className="font-mono text-[12.5px] leading-none text-[#66647c]">+62 artistas</span>
      </div>
    </header>
  )
}

/* ── Marquee de plataformas conectadas ─────────────────────────────────────── */

function Plataformas() {
  return (
    <section id="plataformas" className="relative overflow-hidden border-y border-white/[0.06] bg-[#0A0A12] py-[clamp(46px,6vw,74px)]">
      <div className="mb-[34px] text-center font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.22em] text-[#5a5872]">
        conectado, sob autorização, a
      </div>
      <div className="marquee-mask">
        <div className="animate-marquee marquee-pause flex w-max">
          {[0, 1].map((metade) => (
            /* Conteúdo duplicado: a animação anda -50% e volta ao ponto de
               partida sem emenda (margens por item, nunca gap no container). */
            <div key={metade} aria-hidden={metade === 1} className="flex">
              {PLATAFORMAS.map((p) => (
                <div
                  key={p.nome}
                  className="mr-3.5 flex flex-none items-center gap-[11px] rounded-full border border-white/[0.09] bg-white/[0.022] px-[22px] py-[13px] transition-colors duration-[350ms] hover:border-white/20 hover:bg-white/5"
                >
                  <span
                    className="h-[9px] w-[9px] rounded-full"
                    style={{ background: p.cor, boxShadow: `0 0 12px ${p.cor}` }}
                  />
                  <span className="whitespace-nowrap text-[15px] font-medium tracking-[-0.015em] text-[#C9C6D8]">{p.nome}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Roster: grade de cards com placeholder/foto ───────────────────────────── */

function Roster() {
  return (
    <section id="roster" className="relative overflow-hidden px-[clamp(18px,3.4vw,52px)] py-[clamp(80px,11vw,150px)]">
      <div
        aria-hidden
        data-par="0.6"
        className="pointer-events-none absolute -right-[16%] top-[10%] h-[56vw] max-h-[800px] w-[56vw] max-w-[800px] rounded-full blur-[30px]"
        style={{ background: 'radial-gradient(circle,rgba(124,92,255,.17),rgba(124,92,255,0) 64%)' }}
      />
      <div className="relative mx-auto max-w-[1340px]">
        <div className="mb-[clamp(34px,4vw,56px)] flex flex-wrap items-end justify-between gap-[26px]">
          <div>
            <Eyebrow data-rv className="mb-5 text-[#B6A3FF]">
              o roster
            </Eyebrow>
            <h2 data-rv data-d="70" className="text-balance text-[clamp(34px,4.6vw,66px)] font-medium leading-none tracking-[-0.038em]">
              68 artistas. <span className="text-[#5a5872]">Um painel só.</span>
            </h2>
          </div>
          <p data-rv data-d="140" className="max-w-[34ch] text-pretty text-[15.5px] leading-relaxed text-[#8E8BA3]">
            Cada card puxa os números direto das contas conectadas. Sem planilha, sem print, sem esperar o fim do mês.
          </p>
        </div>

        <div className="grid gap-[clamp(10px,1.1vw,16px)] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
          {ARTISTAS.map((a, i) => (
            <div
              key={a.handle}
              data-rv
              data-d={String(i * 55)}
              className="relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121220] [transition:transform_.6s_cubic-bezier(.16,1,.3,1),border-color_.5s] hover:-translate-y-1.5 hover:border-[rgba(124,92,255,.45)]"
            >
              {a.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `linear-gradient(150deg, ${a.grad[0]}, ${a.grad[1]} 82%)` }}
                >
                  <span className="select-none font-mono text-[clamp(64px,6vw,92px)] font-medium text-white/[0.09]">
                    {a.nome.charAt(0)}
                  </span>
                </div>
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(180deg,rgba(7,7,12,0) 34%,rgba(7,7,12,.62) 62%,rgba(7,7,12,.94) 100%)' }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <Eyebrow className="text-[9.5px] tracking-[0.16em] text-[#B6A3FF]">{a.genero}</Eyebrow>
                <div className="mt-2 text-[17px] font-semibold tracking-[-0.02em] [text-shadow:0_2px_14px_rgba(0,0,0,.7)]">{a.nome}</div>
                <div className="mt-2 flex items-center gap-2 font-mono text-[11.5px] leading-none text-[#A5A2B8]">
                  <span>{a.streams} streams</span>
                  <span style={{ color: corDelta(a.delta) }}>{a.delta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Recursos: 3 blocos texto + mockup ─────────────────────────────────────── */

function Recursos() {
  return (
    <section id="recursos" className="relative overflow-hidden border-t border-white/[0.06] bg-[#0A0A12] px-[clamp(18px,3.4vw,52px)] pb-[clamp(90px,12vw,160px)] pt-[clamp(70px,9vw,120px)]">
      <div className="relative mx-auto max-w-[1340px]">
        <div className="mb-[clamp(56px,7vw,100px)] max-w-[44ch]">
          <Eyebrow data-rv className="mb-5 text-[#B6A3FF]">
            o que você acompanha
          </Eyebrow>
          <h2 data-rv data-d="70" className="text-balance text-[clamp(34px,4.6vw,66px)] font-medium leading-none tracking-[-0.038em]">
            Cada número que importa, no mesmo lugar
          </h2>
        </div>

        {/* 01 · métricas consolidadas */}
        <BlocoRecurso>
          <div>
            <Eyebrow data-rv className="mb-[18px] tracking-[0.18em] text-[#5a5872]">
              01 · métricas consolidadas
            </Eyebrow>
            <h3 data-rv data-d="70" className="text-balance text-[clamp(26px,2.9vw,42px)] font-medium leading-[1.06] tracking-[-0.032em]">
              Todos os artistas, ranqueados por número real
            </h3>
            <p data-rv data-d="130" className="mt-5 max-w-[42ch] text-pretty text-base leading-[1.65] text-[#8E8BA3]">
              Streams, views e seguidores lado a lado. Ordene por qualquer coluna e veja quem cresceu e quem travou nos últimos 28 dias.
            </p>
            <Link
              data-rv
              data-d="190"
              href="/login"
              className="mt-[26px] inline-flex items-center gap-[9px] text-[15px] font-medium text-[#B6A3FF] transition-[gap] duration-[350ms] hover:gap-[15px]"
            >
              Entrar no painel <span className="font-mono">→</span>
            </Link>
          </div>
          <MockTabela />
        </BlocoRecurso>

        {/* 02 · saúde do artista */}
        <BlocoRecurso>
          <div>
            <Eyebrow data-rv className="mb-[18px] tracking-[0.18em] text-[#5a5872]">
              02 · saúde do artista
            </Eyebrow>
            <h3 data-rv data-d="70" className="text-balance text-[clamp(26px,2.9vw,42px)] font-medium leading-[1.06] tracking-[-0.032em]">
              A saúde de cada artista num índice só
            </h3>
            <p data-rv data-d="130" className="mt-5 max-w-[42ch] text-pretty text-base leading-[1.65] text-[#8E8BA3]">
              Engajamento, crescimento, consistência, audiência e receita viram um número. Dá pra ver quem precisa de atenção antes de virar problema.
            </p>
          </div>
          <MockSaude />
        </BlocoRecurso>

        {/* 03 · receita */}
        <BlocoRecurso ultimo>
          <div>
            <Eyebrow data-rv className="mb-[18px] tracking-[0.18em] text-[#5a5872]">
              03 · receita
            </Eyebrow>
            <h3 data-rv data-d="70" className="text-balance text-[clamp(26px,2.9vw,42px)] font-medium leading-[1.06] tracking-[-0.032em]">
              O quanto entrou, de onde veio
            </h3>
            <p data-rv data-d="130" className="mt-5 max-w-[42ch] text-pretty text-base leading-[1.65] text-[#8E8BA3]">
              Receita importada do OneRPM e das plataformas, por artista e por mês. Com alertas quando algo foge do padrão.
            </p>
            <div data-rv data-d="190" className="mt-[26px] flex flex-wrap gap-2.5">
              {['receita por artista', 'split por plataforma', 'alertas'].map((tag) => (
                <span key={tag} className="rounded-full border border-white/[0.09] px-3.5 py-2 font-mono text-[11.5px] leading-none text-[#8E8BA3]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <MockReceita />
        </BlocoRecurso>
      </div>
    </section>
  )
}

function BlocoRecurso({ children, ultimo = false }: { children: React.ReactNode; ultimo?: boolean }) {
  return (
    <div
      className={cn(
        'grid items-center gap-[clamp(40px,5vw,90px)] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]',
        !ultimo && 'mb-[clamp(80px,10vw,150px)]',
      )}
    >
      {children}
    </div>
  )
}

/* Mockup 01: tabela de métricas consolidadas. */
function MockTabela() {
  return (
    <div data-par="0.9" className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#101019] shadow-[0_50px_110px_-46px_#000]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-[18px] py-4">
        <span className="text-[13.5px] font-medium">Métricas consolidadas</span>
        <span className="rounded-md bg-white/[0.04] px-2.5 py-[5px] font-mono text-[10.5px] leading-none text-[#5a5872]">68 artistas</span>
      </div>
      <div className="grid grid-cols-[22px_1fr_78px_70px] gap-3 border-b border-white/[0.05] px-[18px] py-[11px] font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.12em] text-[#4d4b61]">
        <span>#</span>
        <span>artista</span>
        <span className="text-right">streams</span>
        <span className="text-right">views</span>
      </div>
      {ARTISTAS.slice(0, 7).map((a, i) => (
        <div
          key={a.handle}
          className="grid grid-cols-[22px_1fr_78px_70px] items-center gap-3 border-b border-white/[0.04] px-[18px] py-[11px] transition-colors duration-300 hover:bg-white/[0.028]"
        >
          <span className="font-mono text-[11.5px] leading-none text-[#4d4b61]">{i + 1}</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="h-[26px] w-[26px] flex-none overflow-hidden rounded-full bg-[#1e1a33]">
              <AvatarArtista artista={a} textClass="text-[10px]" />
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{a.nome}</span>
          </span>
          <span className="text-right font-mono text-xs font-medium leading-[1.3]">
            {a.streams}
            <br />
            <span className="text-[10.5px] font-normal" style={{ color: corDelta(a.delta) }}>
              {a.delta}
            </span>
          </span>
          <span className="text-right font-mono text-xs font-medium leading-[1.3]">
            {VIEWS[i]}
            <br />
            <span className="text-[10.5px] font-normal" style={{ color: corDelta(VIEWS_DELTA[i]) }}>
              {VIEWS_DELTA[i]}
            </span>
          </span>
        </div>
      ))}
      <div className="flex justify-between px-[18px] py-3 font-mono text-[10.5px] leading-none text-[#4d4b61]">
        <span>últimos 28 dias · sincronizado há 2h</span>
        <span>1–7 de 68</span>
      </div>
    </div>
  )
}

/* Mockup 02: card de Health Score (anel 92 + pilares). */
function MockSaude() {
  return (
    <div data-par="1.1" className="rounded-[18px] border border-white/[0.09] bg-[#101019] p-[26px] shadow-[0_50px_110px_-46px_#000]">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="text-[13.5px] font-medium">Health Score</div>
          <div className="mt-1.5 font-mono text-[10.5px] leading-none text-[#5a5872]">últimos 30 dias</div>
        </div>
        <span className="rounded-full border border-[rgba(52,211,153,.22)] bg-[rgba(52,211,153,.1)] px-[11px] py-1.5 font-mono text-[10.5px] font-medium leading-none text-[#34D399]">
          Saudável
        </span>
      </div>
      <div className="mb-1.5 mt-6 flex items-center gap-[26px]">
        <div className="relative h-28 w-28 flex-none">
          <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#hg)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="326.7"
              strokeDashoffset="26"
            />
            <defs>
              <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7C5CFF" />
                <stop offset="1" stopColor="#34D399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[34px] font-medium leading-none tracking-[-0.03em]">92</div>
        </div>
        <div className="flex flex-1 flex-col gap-[11px]">
          {PILARES.map(([nome, valor]) => (
            <div key={nome} className="flex items-center gap-[11px]">
              <span className="w-[88px] flex-none text-xs text-[#8E8BA3]">{nome}</span>
              <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${valor}%`, background: 'linear-gradient(90deg,#7C5CFF,#38E0D6)' }}
                />
              </span>
              <span className="w-[22px] text-right font-mono text-[11.5px] font-medium leading-none">{valor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Mockup 03: receita do mês + chip de oportunidades. */
function MockReceita() {
  const split: [string, number, string][] = [
    ['Spotify', 44, '#34D399'],
    ['YouTube', 24, '#FF3B30'],
    ['Meta', 18, '#E1306C'],
    ['TikTok', 14, '#38E0D6'],
  ]
  return (
    <div data-par="0.8" className="flex flex-col gap-3.5">
      <div
        className="rounded-[18px] border border-[rgba(124,92,255,.24)] p-6 shadow-[0_44px_100px_-44px_#000]"
        style={{ background: 'linear-gradient(150deg,rgba(124,92,255,.16),rgba(16,16,25,.9) 52%)' }}
      >
        <Eyebrow className="text-[9.5px] tracking-[0.16em] text-[#B6A3FF]">receita do mês</Eyebrow>
        <div className="mt-3.5 flex items-baseline gap-3">
          <span className="font-mono text-[clamp(34px,3.6vw,48px)] font-medium leading-none tracking-[-0.035em]">R$ 24,5k</span>
          <span className="font-mono text-[13px] font-medium leading-none text-[#34D399]">+18,7%</span>
        </div>
        <div className="mt-5 flex h-[7px] gap-1 overflow-hidden rounded-full">
          {split.map(([nome, fatia, cor]) => (
            <span key={nome} style={{ flex: fatia, background: cor }} />
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-4 font-mono text-[11px] leading-none text-[#8E8BA3]">
          {split.map(([nome, fatia, cor]) => (
            <span key={nome} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: cor }} />
              {nome} {fatia}%
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-[13px] rounded-[15px] border border-[rgba(251,191,36,.22)] bg-[#101019] px-5 py-4">
        <span className="h-2 w-2 flex-none rounded-full bg-[#FBBF24] shadow-[0_0_12px_#FBBF24]" />
        <span className="flex-1 text-[13.5px] text-[#C9C6D8]">2 oportunidades detectadas neste mês</span>
        <span className="font-mono text-[11px] leading-none text-[#5a5872]">ver →</span>
      </div>
    </div>
  )
}

/* ── Banda de estatísticas ─────────────────────────────────────────────────── */

function Estatisticas() {
  return (
    <section className="relative border-t border-white/[0.06] px-[clamp(18px,3.4vw,52px)] py-[clamp(70px,9vw,120px)]">
      <div className="mx-auto grid max-w-[1340px] gap-[clamp(24px,3vw,44px)] [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
        {ESTATISTICAS.map((s) => (
          <div key={s.legenda} data-rv data-d={String(s.atraso)} className="border-l border-white/10 pl-[22px]">
            <div
              data-count={s.n}
              data-suffix={s.sufixo}
              className="font-mono text-[clamp(44px,5.4vw,76px)] font-medium leading-none tracking-[-0.05em] text-transparent"
              style={{
                backgroundImage: 'linear-gradient(160deg,#FFFFFF,#8E8BA3)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              {s.rotulo}
            </div>
            <div className="mt-3.5 text-[14.5px] text-[#8E8BA3]">{s.legenda}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Marquee de cards de artistas (rosto e número) ─────────────────────────── */

function CardsArtistas() {
  return (
    <section className="relative overflow-hidden pb-[clamp(80px,10vw,130px)] pt-[clamp(60px,8vw,100px)]">
      <div className="mx-auto mb-[clamp(34px,4vw,52px)] max-w-[1340px] px-[clamp(18px,3.4vw,52px)]">
        <Eyebrow data-rv className="mb-[18px] text-[#B6A3FF]">
          rosto e número
        </Eyebrow>
        <h2 data-rv data-d="70" className="max-w-[20ch] text-balance text-[clamp(30px,4vw,54px)] font-medium leading-[1.02] tracking-[-0.036em]">
          Do primeiro stream ao próximo marco
        </h2>
      </div>
      <div className="marquee-mask">
        <div className="animate-marquee-rev marquee-pause flex w-max">
          {[0, 1].map((metade) => (
            <div key={metade} aria-hidden={metade === 1} className="flex">
              {ARTISTAS.map((a) => (
                <CardArtista key={a.handle} artista={a} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CardArtista({ artista: a }: { artista: Artista }) {
  const corSaude = a.saude >= 80 ? '#34D399' : a.saude >= 65 ? '#FBBF24' : '#F87171'
  const bgSaude = a.saude >= 80 ? 'rgba(52,211,153,.11)' : a.saude >= 65 ? 'rgba(251,191,36,.11)' : 'rgba(248,113,113,.11)'
  return (
    <div className="mr-4 w-[290px] flex-none rounded-[18px] border border-white/[0.09] bg-[#101019] p-5 [transition:border-color_.45s,transform_.55s_cubic-bezier(.16,1,.3,1)] hover:-translate-y-[5px] hover:border-[rgba(124,92,255,.5)]">
      <div className="flex items-center gap-[13px]">
        <div className="h-12 w-12 flex-none overflow-hidden rounded-full bg-[#1e1a33]">
          <AvatarArtista artista={a} textClass="text-[15px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold tracking-[-0.018em]">{a.nome}</div>
          <div className="mt-[5px] font-mono text-[11px] leading-none text-[#5a5872]">{a.handle}</div>
        </div>
        <span
          className="flex-none rounded-full px-[9px] py-[5px] font-mono text-[10.5px] font-medium leading-none"
          style={{ color: corSaude, background: bgSaude }}
        >
          Saúde {a.saude}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div>
          <Eyebrow className="text-[9.5px] font-normal tracking-[0.14em] text-[#4d4b61]">streams · 28d</Eyebrow>
          <div className="mt-[9px] flex items-baseline gap-2">
            <span className="font-mono text-[21px] font-medium leading-none tracking-[-0.03em]">{a.streams}</span>
            <span className="font-mono text-[11.5px] leading-none" style={{ color: corDelta(a.delta) }}>
              {a.delta}
            </span>
          </div>
        </div>
        <svg viewBox="0 0 84 30" className="h-[30px] w-[84px] flex-none" aria-hidden>
          <polyline
            points={a.spark}
            fill="none"
            stroke={corDelta(a.delta)}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        </svg>
      </div>
    </div>
  )
}

/* ── CTA final + rodapé ────────────────────────────────────────────────────── */

function CtaFinal() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-[clamp(18px,3.4vw,52px)] py-[clamp(100px,14vw,190px)] text-center">
      <div aria-hidden className="pointer-events-none absolute -bottom-[46%] left-1/2 w-[110vw] max-w-[1500px] -translate-x-1/2">
        <div
          data-par="0.5"
          className="h-[80vw] max-h-[900px] rounded-full blur-[30px]"
          style={{ background: 'radial-gradient(ellipse,rgba(124,92,255,.38),rgba(124,92,255,0) 62%)' }}
        />
      </div>
      <div className="relative mx-auto max-w-[900px]">
        <h2 data-rv className="text-balance text-[clamp(38px,6.4vw,94px)] font-medium leading-[0.96] tracking-[-0.045em]">
          Mais clareza para{' '}
          <span
            className="text-transparent"
            style={{
              backgroundImage: 'linear-gradient(96deg,#B6A3FF,#38E0D6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            crescer mais rápido
          </span>
        </h2>
        <p data-rv data-d="90" className="mx-auto mt-[26px] max-w-[46ch] text-pretty text-[17px] leading-relaxed text-[#A5A2B8]">
          Saúde, audiência e receita juntas. Você decide com dado, não com achismo.
        </p>
        <div data-rv data-d="160" className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 rounded-full bg-[#7C5CFF] px-[34px] py-[18px] text-base font-medium text-white shadow-[0_18px_60px_-14px_#7C5CFF] [transition:transform_.4s_cubic-bezier(.16,1,.3,1),box-shadow_.4s] hover:-translate-y-[3px] hover:shadow-[0_28px_74px_-14px_#7C5CFF]"
          >
            Entrar no painel <span className="font-mono">→</span>
          </Link>
        </div>
        <div data-rv data-d="220" className="mt-6 font-mono text-[11.5px] leading-none text-[#4d4b61]">
          dados sob autorização do titular de cada conta
        </div>
      </div>
    </section>
  )
}

function Rodape() {
  return (
    <footer className="relative border-t border-white/[0.07] bg-[#0A0A12] px-[clamp(18px,3.4vw,52px)] py-[clamp(44px,5vw,64px)]">
      <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-6">
        <BrandLogo className="h-5 opacity-55" />
        <div className="flex flex-wrap items-center gap-[26px] text-[13.5px]">
          <Link href="/privacidade" className="text-[#66647c] transition-colors duration-300 hover:text-[#F3F2F7]">
            Política de Privacidade
          </Link>
          <Link href="/termos" className="text-[#66647c] transition-colors duration-300 hover:text-[#F3F2F7]">
            Termos de Uso
          </Link>
        </div>
        <div className="font-mono text-xs leading-none text-[#4d4b61]">© {ANO} Imagine Group</div>
      </div>
    </footer>
  )
}

/* ── Peças compartilhadas ──────────────────────────────────────────────────── */

/** Eyebrow mono/uppercase do design (10.5px, tracking .22em por padrão). */
function Eyebrow({
  children,
  className,
  ...resto
}: {
  children: React.ReactNode
  className?: string
  'data-rv'?: boolean
  'data-d'?: string
}) {
  return (
    <div
      {...resto}
      className={cn('font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.22em]', className)}
    >
      {children}
    </div>
  )
}

/**
 * Foto do artista, ou placeholder (gradiente + inicial) quando não houver.
 * Preenche 100% do contêiner (que define forma/tamanho e `overflow-hidden`).
 */
function AvatarArtista({ artista: a, textClass }: { artista: Artista; textClass?: string }) {
  if (a.foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.foto} alt="" className="h-full w-full object-cover" />
  }
  return (
    <span
      aria-hidden
      className={cn('flex h-full w-full select-none items-center justify-center font-mono font-medium text-white/60', textClass)}
      style={{ background: `linear-gradient(140deg, ${a.grad[0]}, ${a.grad[1]})` }}
    >
      {a.nome.charAt(0)}
    </span>
  )
}

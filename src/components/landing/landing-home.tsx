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

/* Logos servidas de /public/logos. A caixa de cada uma é normalizada pela
   "tinta" real do arquivo (bbox dos pixels opacos, medido no browser), pra
   todas aparecerem do mesmo corpo — sem isso TikTok (ocupa 62% do viewBox),
   Instagram (70%) e Meta (61%) saem visivelmente menores que YouTube/Spotify/
   Apple Music (100%). OneRPM é escura (feita p/ fundo claro) → invert. */
const PLATAFORMAS: { nome: string; logo: string; classeLogo?: string; anel: 1 | 2 }[] = [
  { nome: 'YouTube', logo: '/logos/youtube.svg', anel: 1 },
  { nome: 'Instagram', logo: '/logos/instagram.svg', classeLogo: 'h-[43px] w-[43px]', anel: 1 },
  { nome: 'Meta', logo: '/logos/meta.svg', classeLogo: 'h-[48px] w-[48px]', anel: 2 },
  { nome: 'TikTok', logo: '/logos/tiktok.svg', classeLogo: 'h-[48px] w-[48px]', anel: 1 },
  { nome: 'Spotify', logo: '/logos/spotify.svg', anel: 2 },
  { nome: 'Apple Music', logo: '/logos/applemusic.svg', anel: 2 },
  // Deezer e OneRPM trazem a wordmark dentro do arquivo (o símbolo em si fica
  // menor que a bbox), por isso ganham um corpo um pouco maior.
  { nome: 'Deezer', logo: '/logos/deezer.svg', classeLogo: 'h-[38px] w-[38px]', anel: 2 },
  { nome: 'OneRPM', logo: '/logos/onerpm.svg', classeLogo: 'h-[40px] w-[40px] brightness-0 invert', anel: 2 },
]

/* Uma METADE do marquee precisa ser mais larga que qualquer tela (senão sobra
   vão quando a faixa "vira") — repetimos a lista 4× por metade (~4800px). */
const FILA_PLATAFORMAS = Array.from({ length: 4 }, () => PLATAFORMAS).flat()

/* Anéis do sistema orbital (desktop). `inset` é a distância da borda do
   quadrado → raio = 50 - inset (em % do lado). Girar em sentidos opostos dá
   a leitura de "sistema" em vez de um carrossel circular. */
const ANEIS = [
  { inset: 20, duracao: '150s', reverso: false, giro: 0 },
  { inset: 4, duracao: '210s', reverso: true, giro: 36 },
] as const

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

/* Itens do menu pill flutuante (padrão do portfólio do Talis: pill no fim do
   hero que "gruda" no topo ao rolar). */
const MENU: [string, string][] = [
  ['Início', '#top'],
  ['Artistas', '#roster'],
  ['O que acompanha', '#recursos'],
  ['Integrações', '#plataformas'],
]

/* Folga do pill em relação ao topo quando pinado (o mesmo 48px do portfólio). */
const PILL_TOPO = 48

const ANO = new Date().getFullYear()

const corDelta = (delta: string) => (delta.startsWith('-') ? '#F87171' : '#34D399')

/* ── Motion (portado do protótipo) ─────────────────────────────────────────── */

function useMotionLanding() {
  const navRef = useRef<HTMLElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)
  const revealRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const nav = navRef.current
    const spacer = spacerRef.current
    const pill = pillRef.current
    const reveal = revealRef.current
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
    let alturaHero = 0
    /* Palco dos recursos (efeito "symphony"): seção alta com uma tela pinada
       onde os mockups atravessam de baixo pra cima em janelas de progresso. */
    const palcoSec = wrap.querySelector<HTMLElement>('[data-palco]')
    const palcoTela = wrap.querySelector<HTMLElement>('[data-palco-tela]')
    const palcoTitulo = wrap.querySelector<HTMLElement>('[data-palco-titulo]')
    let palcoTopo = 0
    let palcoAltura = 0
    let tituloEmbacado = false
    let voos: { el: HTMLElement; ini: number; fim: number; h: number }[] = []
    const remedir = () => {
      alturaHero = wrap.querySelector('header')?.offsetHeight ?? window.innerHeight
      if (palcoSec) {
        palcoTopo = palcoSec.getBoundingClientRect().top - wrap.getBoundingClientRect().top
        palcoAltura = palcoSec.offsetHeight
        voos = Array.from(wrap.querySelectorAll<HTMLElement>('[data-voo]')).map((el) => ({
          el,
          ini: parseFloat(el.dataset.ini || '0'),
          fim: parseFloat(el.dataset.fim || '1'),
          h: el.offsetHeight,
        }))
      }
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
      /* Altura do documento = quarto de scroll da cortina (+ altura do
         conteúdo quando ele está fixo por causa do hijack). */
      if (spacer) {
        const alturaCortina = reveal?.offsetHeight ?? 0
        spacer.style.height = `${Math.round((suave ? wrap.scrollHeight : 0) + alturaCortina)}px`
      }
      vh = window.innerHeight
    }
    remedir()

    let cur = window.scrollY || 0
    let navOn: boolean | null = null
    let pillY: number | null = null
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
      /* Palco dos recursos: pina a tela interna enquanto o scroll percorre a
         seção (pin manual só no hijack; sem ele o sticky de CSS resolve) e
         move cada card na sua janela de progresso — mais rápido que o scroll,
         cruzando por cima da headline, como no vídeo de referência. */
      if (palcoSec) {
        const faixa = Math.max(palcoAltura - vh, 1)
        const pin = Math.min(Math.max(cur - palcoTopo, 0), faixa)
        if (suave && palcoTela) palcoTela.style.transform = `translateY(${pin.toFixed(1)}px)`
        const p = pin / faixa
        let cruzando = false
        for (const v of voos) {
          const t = Math.min(Math.max((p - v.ini) / (v.fim - v.ini), 0), 1)
          if (t > 0.04 && t < 0.96) cruzando = true
          const y = vh * 1.04 - t * (vh * 1.04 + v.h + 60)
          v.el.style.transform = `translateY(${y.toFixed(1)}px)`
        }
        /* Headline embaça/apaga enquanto um voo cruza (a copy do lado do card
           fica legível); a transição de .5s no elemento suaviza o vai-e-vem. */
        if (palcoTitulo && cruzando !== tituloEmbacado) {
          tituloEmbacado = cruzando
          palcoTitulo.style.filter = cruzando ? 'blur(14px)' : ''
          palcoTitulo.style.opacity = cruzando ? '0.18' : ''
        }
      }
      /* Menu pill: "sticky manual" (sticky de CSS não funciona dentro do
         wrapper transformado). Nasce no fim do hero, sobe junto com o
         conteúdo e pina a PILL_TOPO px do topo — com a inércia do lerp. */
      if (pill) {
        const y = Math.max(PILL_TOPO, alturaHero - cur)
        if (y !== pillY) {
          pillY = y
          pill.style.transform = `translateY(${y.toFixed(1)}px)`
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
    pill?.addEventListener('click', aoClicarAncora)

    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
      ro.disconnect()
      timeouts.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', remedir)
      nav?.removeEventListener('click', aoClicarAncora)
      pill?.removeEventListener('click', aoClicarAncora)
      if (spacer) spacer.style.height = ''
      Object.assign(wrap.style, { position: '', top: '', left: '', width: '', transform: '' })
    }
  }, [])

  return { navRef, wrapRef, spacerRef, pillRef, revealRef }
}

/* ── Página ────────────────────────────────────────────────────────────────── */

export function LandingHome() {
  const { navRef, wrapRef, spacerRef, pillRef, revealRef } = useMotionLanding()

  return (
    <>
      {/* Menu pill flutuante (fora do wrapper: precisa ficar fixo enquanto o
          conteúdo anda por transform). A posição Y vem do rAF do hook. */}
      <MenuPill pillRef={pillRef} />

      {/* "Cortina" (padrão do portfólio: sticky bottom z-0 atrás do conteúdo
          z-10): CTA final + rodapé ficam FIXOS atrás de tudo, ocupando a tela;
          o wrapper opaco desliza por cima e revela no fim do scroll. Sticky de
          CSS não funciona sob o wrapper transformado, então aqui é `fixed` +
          espaço extra de scroll no spacer (funciona com e sem o hijack). */}
      <div ref={revealRef} className="fixed inset-x-0 bottom-0 z-0 flex h-[100svh] flex-col bg-[#07070C]">
        <CtaFinal />
        <Rodape />
      </div>

      <div ref={wrapRef} id="top" className="relative z-10 bg-[#07070C]">
        {/* Barra do topo DENTRO do wrapper: no desktop ela é `absolute` e some
            junto com o hero ao rolar (padrão do portfólio) — quem fica é o
            pill. No mobile (sem pill) ela segue fixa com o blur por JS. */}
        <Nav navRef={navRef} />
        <Hero />
        <Roster />
        <Plataformas />
        <Recursos />
        <Estatisticas />
        <CardsArtistas />
      </div>

      {/* Dá altura ao documento: o quarto de scroll da cortina (100svh; o JS
          ajusta pro valor exato) e, com o hijack, também a altura do wrapper. */}
      <div ref={spacerRef} aria-hidden className="h-[100svh]" />
    </>
  )
}

/* ── Nav fixa (fundo/blur ligados por JS ao rolar) ─────────────────────────── */

function Nav({ navRef }: { navRef: React.MutableRefObject<HTMLElement | null> }) {
  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 top-0 z-[60] flex items-center border-b border-transparent px-[clamp(18px,3.4vw,52px)] py-4 transition-[background,border-color,backdrop-filter] duration-[450ms] md:absolute"
    >
      {/* Só a marca: o acesso ao painel fica no CTA do hero, no pill do menu
          e no CTA final. */}
      <a href="#top" aria-label="Voltar ao topo" className="flex flex-none items-center">
        <BrandLogo className="h-[22px] opacity-95" priority />
      </a>
    </nav>
  )
}

/**
 * Menu pill flutuante (padrão do portfólio): nasce no fim do hero e, ao rolar,
 * pina a `PILL_TOPO`px do topo. O Y é aplicado pelo rAF de `useMotionLanding`
 * (sticky manual — sticky de CSS não funciona sob o wrapper transformado);
 * o `translate-y-[100svh]` é só o estado inicial pré-JS (fora da tela).
 * Escondido no mobile — lá a barra do topo continua fixa.
 */
function MenuPill({ pillRef }: { pillRef: React.MutableRefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={pillRef}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden translate-y-[100svh] justify-center md:flex"
    >
      <nav
        aria-label="Menu da página"
        className="pointer-events-auto flex items-center gap-[30px] rounded-full border border-white/10 bg-[#07070C]/70 px-9 py-[17px] text-[13.5px] tracking-[-0.01em] shadow-[0_18px_60px_-20px_rgba(0,0,0,.85)] backdrop-blur-[30px]"
      >
        {MENU.map(([rotulo, href]) => (
          <a key={href} href={href} className="text-[#8E8BA3] transition-colors duration-300 hover:text-[#F3F2F7]">
            {rotulo}
          </a>
        ))}
        <span aria-hidden className="h-4 w-px bg-white/10" />
        <Link href="/login" className="text-[#B6A3FF] transition-colors duration-300 hover:text-white">
          Entrar
        </Link>
      </nav>
    </div>
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
          data-count="90"
          data-prefix="+"
          data-suffix="M"
          className="animate-sheen pr-[0.06em] font-mono text-[clamp(84px,17.5vw,250px)] font-medium leading-[0.86] tracking-[-0.06em] text-transparent"
          style={{
            /* Gradiente CÍCLICO (1ª cor = última): o sheen anda por repetição
               do background — se as pontas não casam, a emenda aparece como um
               corte seco varrendo o texto. */
            backgroundImage:
              'linear-gradient(96deg,#B6A3FF,#7C5CFF 26%,#38E0D6 52%,#FFFFFF 76%,#B6A3FF 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
          }}
        >
          +90M
        </div>
      </div>
      <div data-rv data-d="150" className="relative mt-1.5 font-mono text-[12.5px] uppercase leading-none tracking-[0.14em] text-[#8E8BA3]">
        pessoas ouvindo os artistas da imagine
      </div>

      <h1 data-rv data-d="220" className="relative mt-11 max-w-[19ch] text-balance text-[clamp(30px,4.2vw,58px)] font-medium leading-[1.02] tracking-[-0.035em]">
        Toda essa carreira cabe <span className="text-[#B6A3FF]">num só painel</span>
      </h1>
      <div data-rv data-d="340" className="relative mt-[44px] flex flex-wrap items-center justify-center gap-3.5">
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
        <span className="font-mono text-[12.5px] leading-none text-[#66647c]">+80 artistas</span>
      </div>
    </header>
  )
}

/* ── Plataformas: sistema orbital no desktop, marquee no mobile ───────────── */

function Plataformas() {
  return (
    <section
      id="plataformas"
      className="relative flex flex-col items-center justify-center overflow-hidden py-[clamp(46px,6vw,74px)] md:min-h-[calc(min(540px,58vw)+130px)]"
    >
      {/* Cenário: o sistema orbital fica ATRÁS (z-0) e o texto na frente. Não
          é `aria-hidden` de propósito — os nomes das plataformas precisam
          continuar sendo texto de verdade (App Review e leitores de tela). */}
      <SistemaOrbital />

      <div className="relative z-10 px-6 text-center">
        <div className="mb-6 font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.22em] text-[#5a5872]">
          integrações
        </div>
        {/* Largura calibrada pra quebrar em DUAS linhas no desktop (o `ch` é
            medido na fonte do próprio h2). No mobile a fonte cai e o texto
            quebra sozinho em mais linhas. */}
        <h2 className="mx-auto max-w-[24ch] text-balance text-[clamp(30px,4.3vw,58px)] font-medium leading-[1.06] tracking-[-0.038em] [text-shadow:0_4px_30px_rgba(10,10,18,0.9)]">
          Criamos um universo onde estamos todos <span className="text-[#B6A3FF]">conectados</span>
        </h2>
      </div>

      <div className="marquee-mask mt-10 md:hidden">
        {/* A animação anda -50% (uma metade) por ciclo → velocidade = largura
            da metade / duração. Metade ~4790px em 190s ≈ 25px/s (o ritmo do
            design original; a duração padrão da classe seria rápida demais). */}
        <div className="animate-marquee marquee-pause flex w-max" style={{ animationDuration: '190s' }}>
          {[0, 1].map((metade) => (
            /* Conteúdo duplicado: a animação anda -50% e volta ao ponto de
               partida sem emenda (margens por item, nunca gap no container). */
            <div key={metade} aria-hidden={metade === 1} className="flex">
              {FILA_PLATAFORMAS.map((p, i) => (
                /* Sem pill: logo + nome soltos sobre o fundo da seção. A
                   margem direita substitui o padding que o pill dava. */
                <div
                  key={`${p.nome}-${i}`}
                  className="mr-[clamp(34px,3.4vw,52px)] flex flex-none items-center gap-3.5 opacity-80 transition-opacity duration-[350ms] hover:opacity-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.logo}
                    alt=""
                    loading="lazy"
                    className={cn('flex-none object-contain', p.classeLogo || 'h-[30px] w-[30px]')}
                  />
                  <span className="whitespace-nowrap text-[17px] font-medium tracking-[-0.015em] text-[#C9C6D8]">{p.nome}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Sistema orbital das plataformas (só desktop — no mobile a seção usa o
 * marquee). Cada anel é um plano que gira; dentro dele cada marca roda no
 * sentido contrário, na MESMA duração, pra continuar em pé. A setinha da logo
 * da Imagine é o satélite, numa trilha própria entre os dois anéis.
 *
 * Camadas de cada marca (a ordem importa, os transforms se compõem):
 * giro inicial → plano que gira → posição na trilha → contra-giro do plano →
 * contra-giro inicial. Soma das rotações no conteúdo = 0, então ele nunca
 * deita; o que sobra é a translação ao longo do círculo.
 */
function SistemaOrbital() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden items-center justify-center md:flex">
      <div className="relative aspect-square w-[min(540px,58vw)]">
        <div
          aria-hidden
          className="absolute inset-[16%] rounded-full blur-[70px]"
          style={{ background: 'radial-gradient(circle,rgba(124,92,255,.32),rgba(124,92,255,0) 68%)' }}
        />

        {/* Trilhas */}
        {ANEIS.map((a) => (
          <div key={a.inset} aria-hidden className="absolute rounded-full border border-white/[0.055]" style={{ inset: `${a.inset}%` }} />
        ))}
        <div aria-hidden className="absolute inset-[12%] rounded-full border border-dashed border-[#7C5CFF]/25" />

        {/* Véu no miolo: quem passa por trás do texto some suavemente, então a
            headline nunca disputa legibilidade com uma logo. */}
        <div
          aria-hidden
          className="absolute inset-[14%] z-[1]"
          style={{
            background:
              'radial-gradient(closest-side,rgba(10,10,18,.94),rgba(10,10,18,.72) 58%,rgba(10,10,18,0) 100%)',
          }}
        />

        {/* Satélite: a seta da Imagine */}
        <div className="absolute inset-[12%] animate-orbita" style={{ animationDuration: '26s' }}>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="animate-orbita-rev" style={{ animationDuration: '26s' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/seta-imagine.png"
                alt=""
                className="h-[26px] w-auto brightness-0 invert drop-shadow-[0_0_16px_rgba(124,92,255,0.95)]"
              />
            </div>
          </div>
        </div>

        {/* Marcas nas trilhas */}
        {ANEIS.map((anel, iAnel) => {
          const doAnel = PLATAFORMAS.filter((p) => p.anel === iAnel + 1)
          return doAnel.map((p, i) => {
            const ang = anel.giro + (360 / doAnel.length) * i
            return (
              <div key={p.nome} className="absolute" style={{ inset: `${anel.inset}%`, transform: `rotate(${ang}deg)` }}>
                <div
                  className={cn('absolute inset-0', anel.reverso ? 'animate-orbita-rev' : 'animate-orbita')}
                  style={{ animationDuration: anel.duracao }}
                >
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div
                      className={cn(anel.reverso ? 'animate-orbita' : 'animate-orbita-rev')}
                      style={{ animationDuration: anel.duracao }}
                    >
                      <div
                        className="flex flex-col items-center gap-2.5 opacity-85"
                        style={{ transform: `rotate(${-ang}deg)` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.logo} alt="" className={cn('object-contain', p.classeLogo || 'h-[30px] w-[30px]')} />
                        <span className="whitespace-nowrap text-[13.5px] font-medium tracking-[-0.015em] text-[#C9C6D8]">
                          {p.nome}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        })}
      </div>
    </div>
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
        <div className="mb-[clamp(34px,4vw,56px)]">
          <Eyebrow data-rv className="mb-5 text-[#B6A3FF]">
            o roster
          </Eyebrow>
          <h2 data-rv data-d="70" className="text-balance text-[clamp(34px,4.6vw,66px)] font-medium leading-none tracking-[-0.038em]">
            +80 artistas. <span className="text-[#5a5872]">Um painel só.</span>
          </h2>
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
                {/* Sem variação aqui de propósito: a grade vai receber os
                    artistas reais e expor queda/crescimento por artista numa
                    página pública não pega bem. */}
                <div className="mt-2 font-mono text-[11.5px] leading-none text-[#A5A2B8]">
                  {a.streams} streams
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Recursos: palco pinado com os mockups atravessando (efeito "symphony") ── */

/**
 * Réplica do efeito do symphony-project.webflow.io: a seção tem 300svh; a
 * tela interna fica pinada (sticky no scroll nativo; sob o hijack o pin é
 * manual, no rAF do hook) enquanto os três mockups sobem MAIS RÁPIDO que o
 * scroll, cruzando por cima da headline em faixas alternadas (esq → dir →
 * centro). A janela de progresso de cada card vem de `data-ini`/`data-fim`;
 * terminada a travessia, o scroll segue e a próxima seção chega por cima.
 * Sem border-t: a seção de plataformas logo acima já traz o border-b.
 */
function Recursos() {
  return (
    <section id="recursos" data-palco className="relative h-[300svh]">
      <div data-palco-tela className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Headline pinada. Enquanto um voo cruza a tela, o rAF aplica blur +
            transparência aqui (a copy ao lado dos cards fica legível); nos
            intervalos ela volta nítida. */}
        <div
          data-palco-titulo
          className="flex h-full flex-col items-center justify-center px-[clamp(18px,3.4vw,52px)] text-center transition-[filter,opacity] duration-500"
        >
          <Eyebrow data-rv className="mb-5 text-[#B6A3FF]">
            o que você acompanha
          </Eyebrow>
          <h2 data-rv data-d="70" className="max-w-[18ch] text-balance text-[clamp(34px,4.6vw,66px)] font-medium leading-none tracking-[-0.038em]">
            Cada número que importa, no mesmo lugar
          </h2>
        </div>

        {/* Voos: cada um leva o mockup + a copy do lado (copy sempre voltada
            pro centro da tela). Absolutos no topo da tela pinada; o rAF traduz
            o progresso da janela em translateY (de +104svh até sair por cima).
            O translate-y-[100svh] é só o estado inicial pré-JS (escondido).
            Sem translate-x de classe aqui — o JS sobrescreve o transform
            inteiro (por isso o 3º centraliza por margem negativa). */}
        <div data-voo data-ini="0.02" data-fim="0.48" className="absolute left-[4vw] top-0 w-[min(1020px,92vw)] translate-y-[100svh]">
          <div className="grid items-center gap-[clamp(20px,3vw,48px)] md:grid-cols-[minmax(0,560px)_minmax(260px,1fr)]">
            <MockTabela />
            <CopyRecurso bloco={DETALHES[0]} />
          </div>
        </div>
        <div data-voo data-ini="0.28" data-fim="0.74" className="absolute right-[4vw] top-0 w-[min(920px,92vw)] translate-y-[100svh]">
          <div className="grid items-center gap-[clamp(20px,3vw,48px)] md:grid-cols-[minmax(260px,1fr)_minmax(0,460px)]">
            <div className="order-1 md:order-2">
              <MockSaude />
            </div>
            <CopyRecurso bloco={DETALHES[1]} className="order-2 md:order-1" />
          </div>
        </div>
        <div
          data-voo
          data-ini="0.54"
          data-fim="0.96"
          className="absolute left-1/2 top-0 ml-[calc(min(460px,46vw)*-1)] w-[min(920px,92vw)] translate-y-[100svh]"
        >
          <div className="grid items-center gap-[clamp(20px,3vw,48px)] md:grid-cols-[minmax(0,460px)_minmax(260px,1fr)]">
            <MockReceita />
            <CopyRecurso bloco={DETALHES[2]} />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Copy dos recursos no estilo "case" do symphony (referência do usuário):
 * título branco + linha de apoio cinza no mesmo corpo, células de estatística
 * com borda fina (número em destaque, label mono maiúscula) e o parágrafo
 * como citação, com as duas barrinhas de aspas. Complementa o palco — os
 * mockups voam lá em cima; aqui fica a explicação de cada um.
 */
const DETALHES: {
  titulo: string
  sub: string
  stats: [string, string][]
  texto: string
}[] = [
  {
    titulo: 'Todos os artistas, ranqueados por número real',
    sub: '01 · Métricas consolidadas',
    stats: [
      ['+80', 'artistas no painel'],
      ['28d', 'janela de comparação'],
    ],
    texto:
      'Streams, views e seguidores lado a lado. Ordene por qualquer coluna e veja quem cresceu e quem travou nos últimos 28 dias.',
  },
  {
    titulo: 'A saúde de cada artista num índice só',
    sub: '02 · Health Score',
    stats: [
      ['5', 'pilares no índice'],
      ['0–100', 'escala única'],
    ],
    texto:
      'Engajamento, crescimento, consistência, audiência e receita viram um número. Dá pra ver quem precisa de atenção antes de virar problema.',
  },
  {
    titulo: 'O quanto entrou, de onde veio',
    sub: '03 · Receita',
    stats: [
      ['22', 'plataformas somadas'],
      ['R$ · US$', 'moeda original'],
    ],
    texto:
      'Receita importada do OneRPM e das plataformas, por artista e por mês. Com alertas quando algo foge do padrão.',
  },
]

/** Um bloco de copy no estilo case, usado ao lado de cada mockup em voo. */
function CopyRecurso({ bloco: b, className }: { bloco: (typeof DETALHES)[number]; className?: string }) {
  return (
    <div className={className}>
      <h3 className="text-balance text-[clamp(21px,1.8vw,26px)] font-medium leading-[1.12] tracking-[-0.028em]">
        {b.titulo}
      </h3>
      <div className="mt-1 text-[clamp(17px,1.4vw,20px)] font-medium tracking-[-0.024em] text-[#5a5872]">{b.sub}</div>
      <div className="mt-6 grid grid-cols-2 divide-x divide-white/[0.08] rounded-xl border border-white/[0.09] bg-[#07070C]/60">
        {b.stats.map(([numero, rotulo]) => (
          <div key={rotulo} className="px-4 py-[18px]">
            <div className="font-mono text-[22px] font-medium leading-none tracking-[-0.02em] text-[#B6A3FF]">{numero}</div>
            <div className="mt-2.5 font-mono text-[9.5px] uppercase leading-[1.5] tracking-[0.14em] text-[#5a5872]">{rotulo}</div>
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-7 flex gap-1.5">
        <span className="h-4 w-1.5 -skew-x-[14deg] rounded-[1px] bg-[#7C5CFF]" />
        <span className="h-4 w-1.5 -skew-x-[14deg] rounded-[1px] bg-[#B6A3FF]" />
      </div>
      <p className="mt-3.5 max-w-[46ch] text-pretty text-[15px] leading-[1.7] text-[#8E8BA3]">{b.texto}</p>
    </div>
  )
}

/* Mockup 01: tabela de métricas consolidadas. */
function MockTabela() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#101019] shadow-[0_50px_110px_-46px_#000]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-[18px] py-4">
        <span className="text-[13.5px] font-medium">Métricas consolidadas</span>
        <span className="rounded-md bg-white/[0.04] px-2.5 py-[5px] font-mono text-[10.5px] leading-none text-[#5a5872]">+80 artistas</span>
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
        <span>1–7 de 80</span>
      </div>
    </div>
  )
}

/* Mockup 02: card de Health Score (anel 92 + pilares). */
function MockSaude() {
  return (
    <div className="rounded-[18px] border border-white/[0.09] bg-[#101019] p-[26px] shadow-[0_50px_110px_-46px_#000]">
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
    <div className="flex flex-col gap-3.5">
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
    <section className="relative px-[clamp(18px,3.4vw,52px)] py-[clamp(70px,9vw,120px)]">
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
        {/* Metade ~4900px em 150s ≈ 33px/s (ritmo do design original). */}
        <div className="animate-marquee-rev marquee-pause flex w-max" style={{ animationDuration: '150s' }}>
          {[0, 1].map((metade) => (
            /* 2× os artistas por metade (~4900px): metade sempre mais larga
               que a tela, senão sobra vão quando a faixa "vira". */
            <div key={metade} aria-hidden={metade === 1} className="flex">
              {[...ARTISTAS, ...ARTISTAS].map((a, i) => (
                <CardArtista key={`${a.handle}-${i}`} artista={a} />
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

/**
 * CTA final — vive na "cortina" (bloco fixo atrás do conteúdo), então:
 * `flex-1` centraliza dentro do 100svh (com o rodapé embaixo), sem os reveals
 * `data-rv`/parallax (o observer/rAF só varre o wrapper; aqui a entrada É a
 * própria cortina sendo revelada).
 */
function CtaFinal() {
  return (
    <section className="relative flex flex-1 items-center justify-center px-[clamp(18px,3.4vw,52px)] py-16 text-center">
      {/* Sem `overflow-hidden` na seção: o brilho seria cortado pela borda dela
          e o corte apareceria como uma linha reta em cima do rodapé. Aqui ele
          desce do topo e se apaga sozinho antes do fim. */}
      <div aria-hidden className="pointer-events-none absolute -top-[38%] left-1/2 w-[120vw] max-w-[1600px] -translate-x-1/2">
        <div
          className="h-[72vw] max-h-[860px] rounded-full blur-[40px]"
          style={{ background: 'radial-gradient(ellipse,rgba(124,92,255,.38),rgba(124,92,255,0) 62%)' }}
        />
      </div>
      <div className="relative mx-auto max-w-[900px]">
        <h2 className="text-balance text-[clamp(38px,6.4vw,94px)] font-medium leading-[0.96] tracking-[-0.045em]">
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
        <p className="mx-auto mt-[26px] max-w-[46ch] text-pretty text-[17px] leading-relaxed text-[#A5A2B8]">
          Saúde, audiência e receita juntas. Você decide com dado, não com achismo.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 rounded-full bg-[#7C5CFF] px-[34px] py-[18px] text-base font-medium text-white shadow-[0_18px_60px_-14px_#7C5CFF] [transition:transform_.4s_cubic-bezier(.16,1,.3,1),box-shadow_.4s] hover:-translate-y-[3px] hover:shadow-[0_28px_74px_-14px_#7C5CFF]"
          >
            Entrar no painel <span className="font-mono">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function Rodape() {
  return (
    <footer className="relative px-[clamp(18px,3.4vw,52px)] py-[clamp(44px,5vw,64px)]">
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

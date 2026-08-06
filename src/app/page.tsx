import type { Metadata } from 'next'
import { Familjen_Grotesk } from 'next/font/google'
import { LandingHome } from '@/components/landing/landing-home'

/**
 * Landing pública do painel (rota `/`).
 *
 * `/` é uma página pública (sem auth): descreve o produto e leva ao login.
 * Revisores de App Review (ex.: TikTok) batem no Website URL e precisam ver o
 * que o produto é + links para as políticas. As rotas privadas seguem
 * protegidas pelo `AuthGuard`.
 *
 * Visual: redesign de ago/2026 feito no Claude Design ("Home Imagine") —
 * dark #07070C, accent roxo #7C5CFF, headlines em Familjen Grotesk (carregada
 * aqui, só nesta rota) e números em JetBrains Mono (fonte mono global). Todo o
 * corpo + motion vive no client component `LandingHome`.
 */

const grotesk = Familjen_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Painel de Artistas — Imagine',
  description:
    'Plataforma da Imagine e dos seus artistas para acompanhar métricas e receita, consolidando dados de YouTube, Instagram, TikTok e OneRPM mediante autorização do titular de cada conta.',
}

export default function LandingPage() {
  return (
    <main
      className={`${grotesk.className} min-h-screen overflow-x-clip bg-[#07070C] text-[#F3F2F7] antialiased selection:bg-[#7C5CFF] selection:text-white`}
    >
      <LandingHome />
    </main>
  )
}

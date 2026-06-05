import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toString()
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`
  // Valores pequenos (ex.: micro-royalties da OneRPM) mostram centavos.
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatVariation(n: number): { text: string; color: string; arrow: string } {
  const arrow = n > 0 ? '↑' : n < 0 ? '↓' : '—'
  const text = `${arrow} ${Math.abs(n)}%`
  let color = 'text-ink-400'
  if (n > 5) color = 'text-emerald-400'
  else if (n < -5) color = 'text-red-400'
  else if (n < 0) color = 'text-amber-400'
  return { text, color, arrow }
}

export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-violet-400'
  if (score >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export function getHealthGradient(score: number): string {
  if (score >= 80) return 'from-violet-500 to-emerald-400'
  if (score >= 60) return 'from-violet-500 to-violet-300'
  if (score >= 40) return 'from-amber-500 to-amber-300'
  return 'from-red-500 to-orange-400'
}

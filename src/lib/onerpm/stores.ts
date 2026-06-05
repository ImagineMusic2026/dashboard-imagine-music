import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'

/**
 * Normalização do campo "Store" da OneRPM.
 *
 * A OneRPM manda muitas variações da mesma plataforma — "Spotify Ad Supported",
 * "Facebook UGC Consumption", "Facebook AI Consumption", "Youtube Premium" etc.
 * Pro painel, tudo isso precisa virar UMA plataforma canônica (com cor e ícone).
 */

export interface PlataformaCanonica {
  plataforma: string
  corKey: string
  iconeTipo: PlataformaTipo
}

const REGRAS: { teste: (s: string) => boolean; canon: PlataformaCanonica }[] = [
  { teste: (s) => s.includes('spotify'), canon: { plataforma: 'Spotify', corKey: 'emerald', iconeTipo: 'spotify' } },
  { teste: (s) => s.includes('apple'), canon: { plataforma: 'Apple Music', corKey: 'pink', iconeTipo: 'apple-music' } },
  { teste: (s) => s.includes('youtube'), canon: { plataforma: 'YouTube', corKey: 'red', iconeTipo: 'youtube' } },
  { teste: (s) => s.includes('deezer'), canon: { plataforma: 'Deezer', corKey: 'violet', iconeTipo: 'deezer' } },
  {
    teste: (s) => s.includes('facebook') || s.includes('instagram') || s.includes('meta'),
    canon: { plataforma: 'Meta', corKey: 'blue', iconeTipo: 'meta' },
  },
  { teste: (s) => s.includes('tiktok'), canon: { plataforma: 'TikTok', corKey: 'cyan', iconeTipo: 'tiktok' } },
  { teste: (s) => s.includes('amazon'), canon: { plataforma: 'Amazon Music', corKey: 'amber', iconeTipo: 'generica' } },
  { teste: (s) => s.includes('audiomack'), canon: { plataforma: 'Audiomack', corKey: 'gray', iconeTipo: 'generica' } },
]

export function normalizarStore(storeRaw: string): PlataformaCanonica {
  const s = (storeRaw ?? '').trim().toLowerCase()
  if (!s) return { plataforma: 'Desconhecida', corKey: 'gray', iconeTipo: 'generica' }

  for (const r of REGRAS) {
    if (r.teste(s)) return r.canon
  }

  // Loja não mapeada: mantém o nome original, ícone genérico.
  return { plataforma: storeRaw.trim().replace(/\s+/g, ' '), corKey: 'gray', iconeTipo: 'generica' }
}

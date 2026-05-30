import type { ReceitaPlataforma } from '@/types'

type MetricasPorArtista = {
  instagram: { seguidores: number; engajamento: number; cadencia: string; crescimento7d: number }
  spotify: { ouvintesMensais: number; faixas: number; topRegioes: string; crescimento30d: number }
  youtube: { inscritos: number; viewsMes: number; avgWatch: string; crescimento7d: number }
  tiktok: {
    seguidores: number
    engajamento: number
    viewsAudio: number
    crescimento48h: number
    viral: boolean
  }
}

export const metricasPlataforma: Record<string, MetricasPorArtista> = {
  a2: {
    instagram: {
      seguidores: 142000,
      engajamento: 7.8,
      cadencia: '3×/sem',
      crescimento7d: 4.2,
    },
    spotify: {
      ouvintesMensais: 187000,
      faixas: 8,
      topRegioes: 'SP, BA',
      crescimento30d: 24,
    },
    youtube: {
      inscritos: 38200,
      viewsMes: 412000,
      avgWatch: '2:14',
      crescimento7d: 1.8,
    },
    tiktok: {
      seguidores: 185000,
      engajamento: 14.2,
      viewsAudio: 2400000,
      crescimento48h: 340,
      viral: true,
    },
  },
}

export const receitaPorPlataforma: Record<string, ReceitaPlataforma[]> = {
  a2: [
    {
      plataforma: 'Spotify',
      cor: 'emerald',
      streams: 847000,
      receita: 4872,
      variacao: 28,
      percentualTotal: 56,
    },
    {
      plataforma: 'Apple Music',
      cor: 'pink',
      streams: 312000,
      receita: 2088,
      variacao: 18,
      percentualTotal: 24,
    },
    {
      plataforma: 'YouTube Music',
      cor: 'red',
      streams: 198000,
      receita: 1131,
      variacao: 41,
      percentualTotal: 13,
    },
    {
      plataforma: 'Deezer',
      cor: 'violet',
      streams: 87000,
      receita: 435,
      variacao: 6,
      percentualTotal: 5,
    },
    {
      plataforma: 'Outras 9 plataformas',
      cor: 'gray',
      streams: 42000,
      receita: 174,
      variacao: 0,
      percentualTotal: 2,
    },
  ],
}

type HistoricoEvento = {
  data: string
  hora: string | null
  titulo: string
  cor: 'emerald' | 'violet' | 'amber' | 'ink'
}

export const historicoRecente: Record<string, HistoricoEvento[]> = {
  a2: [
    {
      data: '07/05',
      hora: '06h',
      titulo: 'Crescimento de seguidores no TikTok detectado · viralização',
      cor: 'emerald',
    },
    {
      data: '28/04',
      hora: null,
      titulo: 'Release de "Madrugada" (single) · Spotify, YouTube, Apple Music',
      cor: 'violet',
    },
    {
      data: '22/04',
      hora: null,
      titulo: 'Show em Salvador, BA · Casa Vintage · público estimado 800',
      cor: 'amber',
    },
    {
      data: '15/04',
      hora: null,
      titulo: 'Atualização de gestor: Carla Pinheiro',
      cor: 'ink',
    },
  ],
}

type AcaoSugerida = {
  icone: 'TrendingUp' | 'Calendar' | 'Music'
  titulo: string
  descricao: string
}

export const acoesSugeridas: Record<string, AcaoSugerida[]> = {
  a2: [
    {
      icone: 'TrendingUp',
      titulo: 'Capitalizar viralização do TikTok',
      descricao:
        'Postar reel no IG com áudio "Madrugada" nas próximas 24h. Janela ótima: 19h-21h.',
    },
    {
      icone: 'Calendar',
      titulo: 'Acelerar booking de shows',
      descricao:
        'Aumento de demanda esperado. Entrar em contato com produtores em SSA, FSA e Recife.',
    },
    {
      icone: 'Music',
      titulo: 'Antecipar release do próximo single',
      descricao:
        'Janela de atenção máxima nos próximos 14 dias. Aproveitar momentum.',
    },
  ],
}

export const evolucaoHealthScore: Record<string, { mes: string; score: number }[]> = {
  a2: [
    { mes: 'fev', score: 68 },
    { mes: 'mar', score: 76 },
    { mes: 'abr', score: 85 },
    { mes: 'mai', score: 91 },
  ],
}

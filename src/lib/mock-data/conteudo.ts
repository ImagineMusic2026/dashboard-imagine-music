export interface PostDestaque {
  id: string
  artistaId: string
  titulo: string
  plataforma: 'Instagram' | 'TikTok' | 'YouTube'
  ha: string
  metrica: string
  metricaLabel: string
}

export const topPerformers: PostDestaque[] = [
  {
    id: 'p1',
    artistaId: 'a2',
    titulo: 'Áudio de "Madrugada" virou trend!',
    plataforma: 'TikTok',
    ha: 'há 2h',
    metrica: '240k',
    metricaLabel: 'views',
  },
  {
    id: 'p2',
    artistaId: 'a1',
    titulo: 'Bastidores do clipe novo',
    plataforma: 'Instagram',
    ha: 'há 6h',
    metrica: '84k',
    metricaLabel: 'engajamento',
  },
  {
    id: 'p3',
    artistaId: 'a3',
    titulo: '"Forró da Lua" entrou na playlist!',
    plataforma: 'Instagram',
    ha: 'há 1d',
    metrica: '42k',
    metricaLabel: 'engajamento',
  },
  {
    id: 'p4',
    artistaId: 'a4',
    titulo: 'Festa Junina chegando 🎉',
    plataforma: 'Instagram',
    ha: 'há 1d',
    metrica: '28k',
    metricaLabel: 'engajamento',
  },
  {
    id: 'p5',
    artistaId: 'a5',
    titulo: 'Spoiler do single novo',
    plataforma: 'Instagram',
    ha: 'há 2d',
    metrica: '18k',
    metricaLabel: 'engajamento',
  },
]

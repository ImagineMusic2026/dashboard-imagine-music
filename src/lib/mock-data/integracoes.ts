export interface IntegracaoStatus {
  ativas: number
  pendentes: number
  semConta?: number
  recusaram?: number
  total: number
}

export interface IntegracaoSocial {
  id: string
  tipo: 'meta' | 'instagram' | 'tiktok' | 'spotify_artists' | 'youtube'
  nome: string
  descricao: string
  status: 'ativo' | 'parcial' | 'erro'
  badge?: string
  badgeColor?: 'emerald' | 'amber' | 'cyan'
  contasAutorizadas: IntegracaoStatus
  frequencia: string
  ultimaSinc: string
  alerta?: string
  isComplemento?: boolean
  notaComplemento?: string
}

export const integracoesEngajamento: IntegracaoSocial[] = [
  {
    id: 'meta',
    tipo: 'meta',
    nome: 'Meta / Facebook',
    descricao: 'Páginas e perfis · alcance, curtidas, eventos',
    status: 'ativo',
    badge: 'CONECTADO',
    badgeColor: 'emerald',
    contasAutorizadas: { ativas: 94, pendentes: 26, semConta: 7, total: 127 },
    frequencia: '6h',
    ultimaSinc: '1h',
  },
  {
    id: 'instagram',
    tipo: 'instagram',
    nome: 'Instagram',
    descricao: 'Meta Graph · seguidores, alcance, engajamento',
    status: 'ativo',
    badge: 'CONECTADO',
    badgeColor: 'emerald',
    contasAutorizadas: { ativas: 112, pendentes: 11, recusaram: 4, total: 127 },
    frequencia: '6h',
    ultimaSinc: '32min',
  },
  {
    id: 'tiktok',
    tipo: 'tiktok',
    nome: 'TikTok',
    descricao: 'Display API · viralização, alta volatilidade',
    status: 'parcial',
    badge: 'PARCIAL',
    badgeColor: 'amber',
    contasAutorizadas: { ativas: 36, pendentes: 82, recusaram: 9, total: 127 },
    frequencia: '6h',
    ultimaSinc: '45min',
    alerta: 'Cobertura baixa',
  },
]

export const integracoesComplementares: IntegracaoSocial[] = [
  {
    id: 'spotify_artists',
    tipo: 'spotify_artists',
    nome: 'Spotify for Artists',
    descricao:
      'Adiciona demografia, top cidades e salvos em playlists — dados que o relatório DDEX não traz',
    status: 'ativo',
    badge: 'COMPLEMENTA ONERPM',
    badgeColor: 'cyan',
    contasAutorizadas: { ativas: 96, pendentes: 0, total: 127 },
    frequencia: '24h',
    ultimaSinc: '2h',
    isComplemento: true,
    notaComplemento: 'Streams e receita já vêm via OneRPM',
  },
  {
    id: 'youtube',
    tipo: 'youtube',
    nome: 'YouTube Data API',
    descricao:
      'Acompanha o canal completo do artista — vlogs, bastidores, podcasts. YouTube Music já vem via OneRPM',
    status: 'ativo',
    badge: 'CANAL NÃO-MUSICAL',
    badgeColor: 'cyan',
    contasAutorizadas: { ativas: 68, pendentes: 0, total: 89 },
    frequencia: '12h',
    ultimaSinc: '4h',
    isComplemento: true,
    notaComplemento: 'Streams musicais já vêm via OneRPM',
  },
]

export const oneRpmStats = {
  ultimaSinc: '14min',
  frequenciaSinc: '6h',
  faixasMapeadas: 1847,
  receita30d: 84200,
  variacaoReceita: 12,
  historicoMeses: 36,
  desdeData: 'mai/2023',
}

export const oneRpmPlataformas = [
  'Spotify',
  'Apple Music',
  'YouTube Music',
  'Deezer',
  'Amazon Music',
  'TikTok',
]

export const oneRpmLogs = [
  {
    hora: '14:32',
    status: 'ok',
    mensagem: 'DDEX_DSR_2026-04.zip recebido — 423MB · 1.847 faixas processadas em 11s',
  },
  {
    hora: '08:15',
    status: 'ok',
    mensagem: 'Tentativa de sincronização — sem novos relatórios disponíveis',
  },
  {
    hora: '02:00',
    status: 'ok',
    mensagem: 'Sincronização noturna concluída — 0 conflitos detectados',
  },
]

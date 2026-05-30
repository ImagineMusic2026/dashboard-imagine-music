import type { Alerta } from '@/types'

export const alertas: Alerta[] = [
  {
    id: 'al1', artistaId: 'a9', // Rai Almeida
    severidade: 'critico',
    categoria: 'queda_engajamento',
    titulo: 'Rai Almeida',
    descricao: 'Engajamento no Instagram caiu -28% em 7 dias vs. média do artista (90d)',
    acaoSugerida: 'Investigar',
    lido: false, resolvido: false,
    criadoHa: 'há 2h',
  },
  {
    id: 'al2', artistaId: 'a8', // Dudu Veiga
    severidade: 'critico',
    categoria: 'queda_streams',
    titulo: 'Dudu Veiga',
    descricao: 'Ouvintes mensais no Spotify caíram -22% em 14 dias',
    acaoSugerida: 'Investigar',
    lido: false, resolvido: false,
    criadoHa: 'há 5h',
  },
  {
    id: 'al3', artistaId: 'a2', // Lorena Matos
    severidade: 'oportunidade',
    categoria: 'viralizacao',
    titulo: 'Lorena Matos',
    descricao: 'Crescimento de seguidores no TikTok +340% nas últimas 48h',
    acaoSugerida: 'Aproveitar',
    lido: false, resolvido: false,
    criadoHa: 'há 6h',
  },
  {
    id: 'al4', artistaId: 'a7', // João Neto e Caio
    severidade: 'atencao',
    categoria: 'sem_postar',
    titulo: 'João Neto e Caio',
    descricao: 'Sem postar no Instagram há 9 dias · cadência habitual: 3×/semana',
    acaoSugerida: 'Notificar',
    lido: false, resolvido: false,
    criadoHa: 'há 12h',
  },
  {
    id: 'al5', artistaId: 'a6', // Mari Xavier
    severidade: 'operacional',
    categoria: 'contrato_vencendo',
    titulo: 'Mari Xavier',
    descricao: 'Contrato de agenciamento expira em 30 dias',
    acaoSugerida: 'Renovar',
    lido: false, resolvido: false,
    criadoHa: 'há 1d',
  },
  {
    id: 'al6', artistaId: 'a3', // Trio do Caju
    severidade: 'oportunidade',
    categoria: 'playlist_editorial',
    titulo: 'Trio do Caju',
    descricao: 'Faixa "Forró da Lua" entrou na playlist editorial Spotify "Forró Sextou"',
    acaoSugerida: 'Comemorar',
    lido: false, resolvido: false,
    criadoHa: 'há 1d',
  },
  {
    id: 'al7', artistaId: 'a4', // Pedro Reis
    severidade: 'atencao',
    categoria: 'queda_alcance',
    titulo: 'Pedro Reis',
    descricao: 'Alcance médio dos posts caiu 18% nas últimas 2 semanas',
    acaoSugerida: 'Investigar',
    lido: true, resolvido: false,
    criadoHa: 'há 2d',
  },
  {
    id: 'al8', artistaId: 'a1', // Flávia Andrade
    severidade: 'oportunidade',
    categoria: 'crescimento_seguidores',
    titulo: 'Flávia Andrade',
    descricao: 'Crescimento de seguidores no Instagram acelerou: +12k em 7 dias (média histórica: 4k)',
    acaoSugerida: 'Aproveitar',
    lido: true, resolvido: false,
    criadoHa: 'há 3d',
  },
  {
    id: 'al9', artistaId: 'a5', // Camila Brito
    severidade: 'operacional',
    categoria: 'release_programado',
    titulo: 'Camila Brito',
    descricao: 'Release programado pra 15/05 · single "Madrugada na Cidade"',
    acaoSugerida: 'Preparar',
    lido: true, resolvido: false,
    criadoHa: 'há 4d',
  },
  {
    id: 'al10', artistaId: 'a2', // Lorena Matos
    severidade: 'atencao',
    categoria: 'comentarios_negativos',
    titulo: 'Lorena Matos',
    descricao: 'Aumento de comentários negativos no último post (15% vs. média histórica de 4%)',
    acaoSugerida: 'Revisar',
    lido: true, resolvido: false,
    criadoHa: 'há 5d',
  },
  {
    id: 'al11', artistaId: 'a8', // Dudu Veiga
    severidade: 'critico',
    categoria: 'sem_postar_critico',
    titulo: 'Dudu Veiga',
    descricao: 'Sem postar há 21 dias · cadência habitual: 4×/semana',
    acaoSugerida: 'Notificar',
    lido: false, resolvido: false,
    criadoHa: 'há 6d',
  },
]

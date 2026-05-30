export type EventoTipo = 'release' | 'show' | 'contrato' | 'reuniao'

export interface EventoAgenda {
  id: string
  data: { dia: string; mes: string }
  tipo: EventoTipo
  artistaId: string
  titulo: string
  subtitulo: string
}

export const proximosEventos: EventoAgenda[] = [
  {
    id: 'e1',
    data: { dia: '15', mes: 'mai' },
    tipo: 'release',
    artistaId: 'a5',
    titulo: '"Madrugada na Cidade"',
    subtitulo: 'Camila Brito · single · Spotify, Apple Music, YouTube Music',
  },
  {
    id: 'e2',
    data: { dia: '18', mes: 'mai' },
    tipo: 'show',
    artistaId: 'a3',
    titulo: 'Forró da Madrugada',
    subtitulo: 'Trio do Caju · Salvador, BA · público estimado 2.500',
  },
  {
    id: 'e3',
    data: { dia: '20', mes: 'mai' },
    tipo: 'reuniao',
    artistaId: 'a2',
    titulo: 'Plano de aproveitamento',
    subtitulo: 'Lorena Matos · viralização no TikTok · 14h',
  },
  {
    id: 'e4',
    data: { dia: '22', mes: 'mai' },
    tipo: 'contrato',
    artistaId: 'a6',
    titulo: 'Renovação de agenciamento',
    subtitulo: 'Mari Xavier · contrato 2026-2028',
  },
  {
    id: 'e5',
    data: { dia: '25', mes: 'mai' },
    tipo: 'release',
    artistaId: 'a1',
    titulo: '"Coração Baiano"',
    subtitulo: 'Flávia Andrade · single · todas as plataformas',
  },
  {
    id: 'e6',
    data: { dia: '28', mes: 'mai' },
    tipo: 'show',
    artistaId: 'a4',
    titulo: 'Festa Junina Mossoró',
    subtitulo: 'Pedro Reis · Mossoró, RN · arena 5.000',
  },
  {
    id: 'e7',
    data: { dia: '02', mes: 'jun' },
    tipo: 'release',
    artistaId: 'a2',
    titulo: '"Madrugada Remix"',
    subtitulo: 'Lorena Matos · single · todas as plataformas',
  },
  {
    id: 'e8',
    data: { dia: '05', mes: 'jun' },
    tipo: 'contrato',
    artistaId: 'a5',
    titulo: 'Patrocínio com Texas Seguros',
    subtitulo: 'Camila Brito · campanha publicitária 6 meses',
  },
]

export const marcosSemana = {
  releasesProgramados: 0,
  showsConfirmados: 1,
  reunioes: 3,
  contratosVencendo: 1,
  proximoEvento: '07 mai · 15h · Reunião com Lorena Matos',
  intervalo: '07 - 13 mai',
}

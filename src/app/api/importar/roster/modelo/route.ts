import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { exigirPermissao } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Modelo .xlsx da planilha de cadastro (redes sociais) — o formato que o
 * importador espera. Aba 1 "Artistas" com o cabeçalho + linhas de exemplo
 * (só a aba 1 é lida na importação); aba 2 com as instruções.
 */
export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth

  const wb = XLSX.utils.book_new()

  const artistas = XLSX.utils.aoa_to_sheet([
    ['Artista', 'Spotify', 'YouTube', 'Instagram', 'TikTok'],
    [
      'Exemplo Com Links (apague esta linha)',
      'https://open.spotify.com/artist/4gzpq5DPGxSnKTe4SA8HAU',
      'https://youtube.com/@canaldoartista',
      'https://instagram.com/perfil.do.artista',
      'https://tiktok.com/@perfil.do.artista',
    ],
    [
      'Exemplo Com Arroba (apague esta linha)',
      'https://open.spotify.com/artist/1URnnhqYAYcrqrcwql10ft',
      '@canaldoartista',
      '@perfil.do.artista',
      '@perfil.do.artista',
    ],
  ])
  artistas['!cols'] = [{ wch: 34 }, { wch: 56 }, { wch: 38 }, { wch: 36 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(wb, artistas, 'Artistas')

  const instrucoes = XLSX.utils.aoa_to_sheet(
    [
      'Como preencher a planilha de cadastro',
      '',
      '• Só a PRIMEIRA aba ("Artistas") é lida — mantenha os dados nela.',
      '• Mantenha a linha de cabeçalho com os nomes das plataformas; a ordem das colunas é livre.',
      '• A primeira coluna que não é de plataforma vira o NOME do artista.',
      '• Spotify: use o link do PERFIL DE ARTISTA (open.spotify.com/artist/...). Link de álbum/faixa não traz o ID.',
      '• YouTube: link do canal (youtube.com/@handle ou /channel/...) ou só o @handle.',
      '• Instagram e TikTok: link do perfil ou só o @.',
      '• Célula vazia = a rede não é alterada no painel (nada é apagado numa reimportação).',
      '• Se um artista já existir com OUTRA conta cadastrada, o painel pede confirmação (manter ou trocar) antes de gravar.',
      '• Apague as linhas de exemplo antes de importar.',
    ].map((linha) => [linha])
  )
  instrucoes['!cols'] = [{ wch: 110 }]
  XLSX.utils.book_append_sheet(wb, instrucoes, 'Instruções')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-cadastro-artistas.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}

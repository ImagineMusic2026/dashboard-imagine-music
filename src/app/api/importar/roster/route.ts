import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { RosterParseError, lerRoster } from '@/lib/roster/parse'
import { listarCadastros, salvarRoster } from '@/lib/roster/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAMANHO_MAX = 25 * 1024 * 1024 // 25MB

/**
 * Importação do cadastro (roster) de artistas a partir do .xlsx de redes sociais.
 *  - POST: parseia e faz upsert dos artistas (merge — preserva receita).
 *  - GET : devolve o último cadastro importado.
 *
 * Exige a permissão `importar` (admin por padrão; o admin pode delegar a um membro).
 */
export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth
  try {
    const cadastros = await listarCadastros(20)
    return NextResponse.json({ cadastros })
  } catch (e) {
    console.error('[api/importar/roster GET]', e)
    return NextResponse.json({ error: 'Não foi possível carregar os cadastros.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'O arquivo está vazio.' }, { status: 400 })
  }
  if (file.size > TAMANHO_MAX) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx. 25MB).' }, { status: 413 })
  }
  if (!/\.(xlsx|xls)$/i.test(file.name || '')) {
    return NextResponse.json({ error: 'Envie a planilha .xlsx do cadastro de artistas.' }, { status: 415 })
  }

  let buf: Buffer
  try {
    buf = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Não consegui ler o conteúdo do arquivo.' }, { status: 400 })
  }

  let parsed
  try {
    parsed = lerRoster(buf)
  } catch (e) {
    if (e instanceof RosterParseError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/importar/roster parse]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha.' }, { status: 500 })
  }

  try {
    const res = await salvarRoster(parsed, {
      arquivoNome: file.name || 'roster.xlsx',
      tamanhoBytes: file.size,
      uid: auth.uid,
      email: auth.email,
    })
    return NextResponse.json({
      ok: true,
      cadastroId: res.cadastroId,
      gravados: res.gravados,
      resumo: {
        totais: parsed.totais,
        avisos: parsed.avisos,
        artistas: parsed.artistas,
      },
    })
  } catch (e) {
    console.error('[api/importar/roster save]', e)
    return NextResponse.json({ error: 'A planilha foi lida, mas falhou ao salvar no banco.' }, { status: 500 })
  }
}

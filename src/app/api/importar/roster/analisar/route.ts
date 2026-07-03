import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { RosterParseError, lerRoster } from '@/lib/roster/parse'
import { analisarRoster } from '@/lib/roster/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAMANHO_MAX = 25 * 1024 * 1024 // 25MB
// Mesmo teto da fase 2 (/confirmar) — barrar aqui evita analisar uma planilha
// que a confirmação recusaria depois.
const MAX_ARTISTAS = 2000

/**
 * Fase 1 da importação do cadastro: parseia o .xlsx e COMPARA com o que já
 * existe no painel, sem gravar nada. Devolve a análise (novos / iguais /
 * atualizações / conflitos) pro usuário revisar antes de confirmar na fase 2
 * (`/api/importar/roster/confirmar`).
 */
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
    console.error('[api/importar/roster/analisar parse]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha.' }, { status: 500 })
  }

  if (parsed.artistas.length > MAX_ARTISTAS) {
    return NextResponse.json(
      { error: `A planilha tem ${parsed.artistas.length} artistas — o máximo é ${MAX_ARTISTAS}.` },
      { status: 413 }
    )
  }

  try {
    const analise = await analisarRoster(parsed)
    return NextResponse.json({ ok: true, analise, avisos: parsed.avisos })
  } catch (e) {
    console.error('[api/importar/roster/analisar diff]', e)
    return NextResponse.json(
      { error: 'A planilha foi lida, mas falhou ao comparar com o cadastro atual.' },
      { status: 500 }
    )
  }
}

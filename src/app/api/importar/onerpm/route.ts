import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { OneRpmParseError, parseOneRpm } from '@/lib/onerpm/parse'
import { listarImportacoes, salvarImportacao } from '@/lib/onerpm/firestore'

// firebase-admin + xlsx precisam do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Planilhas da OneRPM são pequenas (KB). O ZIP DDEX gigante é outra rota (futuro).
const TAMANHO_MAX = 25 * 1024 * 1024 // 25MB

/**
 * Importação de relatório de vendas da OneRPM.
 *  - POST: recebe o .xlsx (multipart), parseia e grava no Firestore.
 *  - GET : lista as importações recentes.
 *
 * Exige a permissão `importar` (admin por padrão; o admin pode delegar a um membro).
 */
export async function GET(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth

  try {
    const importacoes = await listarImportacoes(20)
    return NextResponse.json({ importacoes })
  } catch (e) {
    console.error('[api/importar/onerpm GET]', e)
    return NextResponse.json({ error: 'Não foi possível carregar as importações.' }, { status: 500 })
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
    return NextResponse.json(
      { error: 'Arquivo muito grande (máx. 25MB para planilhas).' },
      { status: 413 }
    )
  }

  const nome = file.name || 'onerpm.xlsx'
  if (!/\.(xlsx|xls)$/i.test(nome)) {
    return NextResponse.json(
      { error: 'Formato não suportado nesta rota. Envie o .xlsx exportado da OneRPM.' },
      { status: 415 }
    )
  }

  let buf: Buffer
  try {
    buf = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Não consegui ler o conteúdo do arquivo.' }, { status: 400 })
  }

  let agg
  try {
    agg = parseOneRpm(buf)
  } catch (e) {
    if (e instanceof OneRpmParseError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[api/importar/onerpm parse]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha.' }, { status: 500 })
  }

  try {
    const res = await salvarImportacao(agg, {
      arquivoNome: nome,
      tamanhoBytes: file.size,
      uid: auth.uid,
      email: auth.email,
    })
    return NextResponse.json({
      ok: true,
      importId: res.importId,
      artistaSlug: res.artistaSlug,
      resumo: {
        artistaNome: agg.artistaNome,
        artistaSlug: agg.artistaSlug,
        label: agg.label,
        periodo: agg.periodo,
        moedas: agg.moedas,
        totais: agg.totais,
        totalBRL: res.totalBRL,
        porPlataforma: agg.porPlataforma,
        porFaixa: agg.porFaixa.slice(0, 10),
        porTerritorio: agg.porTerritorio.slice(0, 10),
        avisos: agg.avisos,
      },
    })
  } catch (e) {
    console.error('[api/importar/onerpm save]', e)
    return NextResponse.json(
      { error: 'A planilha foi lida, mas falhou ao salvar no banco. Tente de novo.' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { NAO_ATRIBUIDO } from '@/lib/onerpm/aggregate'
import { listarImportacoes, salvarLote } from '@/lib/onerpm/firestore'
import type { OneRpmLote } from '@/lib/onerpm/types'

// firebase-admin precisa do runtime Node (não funciona no Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Importação de relatório de vendas da OneRPM.
 *  - POST: recebe o LOTE já agregado (JSON) e grava no Firestore.
 *  - GET : lista as importações recentes.
 *
 * O .xlsx do selo tem ~15MB e ~120k linhas: não passa no limite de 4,5MB de corpo
 * de requisição da Vercel, nem no tempo de uma função serverless. Quem lê a planilha
 * é o browser (`parse.worker.ts`); aqui chega só o agregado, na casa dos KB.
 *
 * Exige a permissão `importar` (admin por padrão; o admin pode delegar a um membro).
 */

/** Corpo agregado é pequeno; o teto só protege contra abuso. */
const TAMANHO_MAX = 8 * 1024 * 1024 // 8MB

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

interface Corpo {
  arquivoNome: string
  tamanhoBytes: number
  lote: OneRpmLote
}

/**
 * O lote vem do cliente, então não confiamos na forma dele. Isto não é validação
 * de segurança (a rota já é admin-only) — é pra falhar com mensagem clara em vez
 * de gravar lixo no Firestore.
 */
function validar(corpo: unknown): { ok: true; dados: Corpo } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Envio inválido.' }
  const c = corpo as Partial<Corpo>
  const lote = c.lote

  if (!lote || typeof lote !== 'object' || !Array.isArray(lote.artistas)) {
    return { ok: false, erro: 'Envio inválido: lote ausente.' }
  }
  if (!lote.artistas.length) {
    return { ok: false, erro: 'Nenhum artista foi identificado na planilha.' }
  }
  if (!lote.totais || typeof lote.totais.linhas !== 'number') {
    return { ok: false, erro: 'Envio inválido: totais ausentes.' }
  }

  for (const a of lote.artistas) {
    if (!a?.artistaSlug || !a?.artistaNome || !a?.totais || !Array.isArray(a.porPlataforma)) {
      return { ok: false, erro: 'Envio inválido: um dos artistas veio incompleto.' }
    }
    // O bucket de sobras nunca pode virar um artista com receita.
    if (a.artistaNome === NAO_ATRIBUIDO) {
      return { ok: false, erro: 'Envio inválido: linhas não atribuídas vieram como artista.' }
    }
    // O Admin SDK rejeita `undefined`; um cliente antigo não manda o repasse.
    a.repassePorMoeda = a.repassePorMoeda ?? {}
  }
  lote.pagoTerceirosPorMoeda = lote.pagoTerceirosPorMoeda ?? {}

  return {
    ok: true,
    dados: {
      arquivoNome: typeof c.arquivoNome === 'string' && c.arquivoNome ? c.arquivoNome : 'onerpm.xlsx',
      tamanhoBytes: typeof c.tamanhoBytes === 'number' ? c.tamanhoBytes : 0,
      lote,
    },
  }
}

export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth

  const tamanho = Number(req.headers.get('content-length') ?? 0)
  if (tamanho > TAMANHO_MAX) {
    return NextResponse.json({ error: 'Agregado grande demais.' }, { status: 413 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  const v = validar(corpo)
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 422 })
  const { arquivoNome, tamanhoBytes, lote } = v.dados

  try {
    const res = await salvarLote(lote, {
      arquivoNome,
      tamanhoBytes,
      uid: auth.uid,
      email: auth.email,
    })
    return NextResponse.json({
      ok: true,
      loteId: res.loteId,
      resumo: {
        label: lote.label,
        periodo: lote.periodo,
        moedas: lote.moedas,
        totais: lote.totais,
        totalBRL: res.totalBRL,
        artistas: res.artistas,
        pagoTerceirosPorMoeda: lote.pagoTerceirosPorMoeda,
        naoAtribuido: lote.naoAtribuido
          ? { linhas: lote.naoAtribuido.totais.linhas, streams: lote.naoAtribuido.totais.streams }
          : null,
        // `res.avisos` só existe no servidor: reconciliação com o roster.
        avisos: [...lote.avisos, ...res.avisos],
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

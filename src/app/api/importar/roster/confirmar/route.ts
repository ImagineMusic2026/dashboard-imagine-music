import { NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/server-auth'
import { slugify } from '@/lib/onerpm/aggregate'
import { extrairInstagram, extrairSpotify, extrairTiktok, extrairYoutube } from '@/lib/roster/extrair'
import { resumirRoster } from '@/lib/roster/parse'
import { salvarRoster } from '@/lib/roster/firestore'
import type { DecisaoConflito, RedeKey, RedeSocial, RosterArtist } from '@/lib/roster/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ARTISTAS = 2000

const EXTRATORES: Record<RedeKey, (u: string) => RedeSocial | null> = {
  spotify: extrairSpotify,
  youtube: extrairYoutube,
  instagram: extrairInstagram,
  tiktok: extrairTiktok,
}

function urlDe(v: unknown): string {
  if (!v || typeof v !== 'object') return ''
  const u = (v as { url?: unknown }).url
  return typeof u === 'string' ? u.trim() : ''
}

/**
 * Fase 2 da importação do cadastro: recebe a lista analisada + as decisões de
 * conflito ("manter" o que está no painel ou "trocar" pelo da planilha) e aí
 * sim grava. Só nome e URLs são aceitos do cliente — slug, id e handle são
 * SEMPRE re-derivados aqui (mesmos extratores do parse), então o payload não
 * consegue forjar vínculos.
 */
export async function POST(req: Request) {
  const auth = await exigirPermissao(req, 'importar')
  if (auth instanceof NextResponse) return auth

  let body: {
    arquivoNome?: unknown
    tamanhoBytes?: unknown
    artistas?: unknown
    decisoes?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 })
  }

  if (!Array.isArray(body.artistas) || body.artistas.length === 0) {
    return NextResponse.json({ error: 'Nenhum artista pra importar.' }, { status: 400 })
  }
  if (body.artistas.length > MAX_ARTISTAS) {
    return NextResponse.json({ error: 'Lista de artistas grande demais.' }, { status: 413 })
  }

  const decisoes = (body.decisoes ?? {}) as Record<string, Partial<Record<RedeKey, DecisaoConflito>>>

  let mantidos = 0
  let trocados = 0
  const artistas: RosterArtist[] = []
  for (const item of body.artistas as Record<string, unknown>[]) {
    const nome = typeof item?.nome === 'string' ? item.nome.trim() : ''
    if (!nome) continue
    const slug = slugify(nome)
    if (!slug) continue

    const decisao = decisoes[slug] ?? {}
    const redes: Record<RedeKey, RedeSocial | null> = {
      spotify: null,
      youtube: null,
      instagram: null,
      tiktok: null,
    }
    for (const rede of Object.keys(EXTRATORES) as RedeKey[]) {
      if (decisao[rede] === 'manter') {
        // Usuário escolheu preservar a conta do painel: a rede sai do merge
        // (redes ausentes não são tocadas no salvar).
        mantidos++
        continue
      }
      if (decisao[rede] === 'trocar') trocados++
      const url = urlDe(item[rede])
      redes[rede] = url ? EXTRATORES[rede](url) : null
    }

    const avisos: string[] = []
    if (redes.spotify && redes.spotify.url && !redes.spotify.id) {
      avisos.push('Link do Spotify não é de artista (provável álbum) — sem ID.')
    }

    artistas.push({ nome, slug, ...redes, avisos })
  }

  if (!artistas.length) {
    return NextResponse.json({ error: 'Nenhum artista válido pra importar.' }, { status: 422 })
  }

  const resumo = resumirRoster(artistas)

  try {
    const res = await salvarRoster(resumo, {
      arquivoNome: typeof body.arquivoNome === 'string' && body.arquivoNome ? body.arquivoNome : 'roster.xlsx',
      tamanhoBytes: typeof body.tamanhoBytes === 'number' && body.tamanhoBytes >= 0 ? body.tamanhoBytes : 0,
      uid: auth.uid,
      email: auth.email,
      ...(mantidos || trocados ? { conflitos: { mantidos, trocados } } : {}),
    })
    return NextResponse.json({
      ok: true,
      cadastroId: res.cadastroId,
      gravados: res.gravados,
      resumo: {
        totais: resumo.totais,
        avisos: resumo.avisos,
        artistas: resumo.artistas,
      },
    })
  } catch (e) {
    console.error('[api/importar/roster/confirmar save]', e)
    return NextResponse.json({ error: 'A revisão foi concluída, mas falhou ao salvar no banco.' }, { status: 500 })
  }
}

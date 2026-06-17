import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { slugify } from '../onerpm/aggregate'
import { extrairInstagram, extrairSpotify, extrairTiktok, extrairYoutube } from './extrair'
import type { RedeSocial, RosterParseResult } from './types'

/**
 * Persistência do cadastro de artistas (⚠️ só servidor — Admin SDK).
 *
 * Faz UPSERT em `artistas/{slug}` com `merge: true`, então NÃO sobrescreve os
 * campos de receita da OneRPM já existentes (ex.: no doc do Rock Salles). Grava
 * também um resumo do cadastro em `cadastros/{id}` (histórico/auditoria).
 */

const ARTISTAS = 'artistas'
const CADASTROS = 'cadastros'

export interface RosterMeta {
  arquivoNome: string
  tamanhoBytes: number
  uid: string
  email: string
}

export interface CadastroResumo {
  id: string
  arquivoNome: string
  tamanhoBytes: number
  total: number
  comSpotifyId: number
  comYoutube: number
  comInstagram: number
  comTiktok: number
  criadoEmISO: string | null
  criadoPorEmail: string
}

export async function salvarRoster(
  res: RosterParseResult,
  meta: RosterMeta
): Promise<{ cadastroId: string; gravados: number }> {
  const agora = admin.firestore.FieldValue.serverTimestamp()
  const batch = adminDb.batch()

  let gravados = 0
  for (const a of res.artistas) {
    if (!a.slug) continue
    const ref = adminDb.collection(ARTISTAS).doc(a.slug)
    batch.set(
      ref,
      {
        nome: a.nome,
        slug: a.slug,
        fonteCadastro: 'roster',
        redes: {
          spotify: a.spotify ?? null,
          youtube: a.youtube ?? null,
          instagram: a.instagram ?? null,
          tiktok: a.tiktok ?? null,
        },
        cadastroAtualizadoEm: agora,
      },
      { merge: true }
    )
    gravados++
  }

  const cadastroRef = adminDb.collection(CADASTROS).doc()
  batch.set(cadastroRef, {
    fonte: 'roster-xlsx',
    arquivoNome: meta.arquivoNome,
    tamanhoBytes: meta.tamanhoBytes,
    totais: res.totais,
    avisos: res.avisos,
    artistas: res.artistas.map((a) => a.slug),
    criadoEm: agora,
    criadoPorUid: meta.uid,
    criadoPorEmail: meta.email,
  })

  await batch.commit()
  return { cadastroId: cadastroRef.id, gravados }
}

/** Erro de validação do cadastro manual (ex.: nome ausente). */
export class ArtistaInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArtistaInputError'
  }
}

export interface NovoArtistaInput {
  nome: string
  genero?: string | null
  spotifyUrl?: string | null
  youtubeUrl?: string | null
  instagramUrl?: string | null
  tiktokUrl?: string | null
}

export interface ArtistaManualResultado {
  slug: string
  nome: string
  genero: string | null
  /** True se já existia um artista com esse slug (foi atualizado, não criado). */
  jaExistia: boolean
  redes: {
    spotify: RedeSocial | null
    youtube: RedeSocial | null
    instagram: RedeSocial | null
    tiktok: RedeSocial | null
  }
  avisos: string[]
}

/**
 * Cadastro MANUAL de um artista (UPSERT em `artistas/{slug}`). Mesmo modelo do
 * roster, porém um por vez e a partir das URLs digitadas. Só inclui no merge as
 * redes informadas — assim NÃO apaga redes/receita já existentes caso o slug
 * coincida com um artista que já veio da planilha.
 */
export async function salvarArtistaManual(
  input: NovoArtistaInput,
  meta: { uid: string; email: string }
): Promise<ArtistaManualResultado> {
  const nome = (input.nome ?? '').trim()
  if (!nome) throw new ArtistaInputError('Informe o nome do artista.')
  const slug = slugify(nome)
  if (!slug) throw new ArtistaInputError('O nome precisa ter ao menos uma letra ou número.')
  const genero = (input.genero ?? '').trim() || null

  const spotify = input.spotifyUrl ? extrairSpotify(input.spotifyUrl) : null
  const youtube = input.youtubeUrl ? extrairYoutube(input.youtubeUrl) : null
  const instagram = input.instagramUrl ? extrairInstagram(input.instagramUrl) : null
  const tiktok = input.tiktokUrl ? extrairTiktok(input.tiktokUrl) : null

  const avisos: string[] = []
  if (spotify && spotify.url && !spotify.id) {
    avisos.push('O link do Spotify não parece ser de artista (provável álbum/faixa) — salvei sem o ID.')
  }

  const ref = adminDb.collection(ARTISTAS).doc(slug)
  const snap = await ref.get()
  const jaExistia = snap.exists

  // Só as redes informadas entram no merge (o deep merge preserva as demais).
  const redesParaSalvar: Record<string, RedeSocial> = {}
  if (spotify) redesParaSalvar.spotify = spotify
  if (youtube) redesParaSalvar.youtube = youtube
  if (instagram) redesParaSalvar.instagram = instagram
  if (tiktok) redesParaSalvar.tiktok = tiktok

  const agora = admin.firestore.FieldValue.serverTimestamp()
  const data: Record<string, unknown> = {
    nome,
    slug,
    cadastroAtualizadoEm: agora,
    cadastroPorEmail: meta.email,
  }
  if (genero) data.genero = genero
  if (Object.keys(redesParaSalvar).length) data.redes = redesParaSalvar
  if (!jaExistia) {
    data.fonteCadastro = 'manual'
    data.criadoEm = agora
    data.criadoPorUid = meta.uid
    data.criadoPorEmail = meta.email
  }

  await ref.set(data, { merge: true })

  return { slug, nome, genero, jaExistia, redes: { spotify, youtube, instagram, tiktok }, avisos }
}

export async function listarCadastros(max = 20): Promise<CadastroResumo[]> {
  const snap = await adminDb.collection(CADASTROS).orderBy('criadoEm', 'desc').limit(max).get()
  return snap.docs.map((d) => {
    const x = d.data()
    const ts = x.criadoEm as admin.firestore.Timestamp | undefined
    const t = x.totais ?? {}
    return {
      id: d.id,
      arquivoNome: x.arquivoNome ?? '',
      tamanhoBytes: x.tamanhoBytes ?? 0,
      total: t.total ?? 0,
      comSpotifyId: t.comSpotifyId ?? 0,
      comYoutube: t.comYoutube ?? 0,
      comInstagram: t.comInstagram ?? 0,
      comTiktok: t.comTiktok ?? 0,
      criadoEmISO: ts ? ts.toDate().toISOString() : null,
      criadoPorEmail: x.criadoPorEmail ?? '',
    }
  })
}

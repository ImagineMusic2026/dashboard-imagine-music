import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { slugify } from '../onerpm/aggregate'
import { extrairInstagram, extrairSpotify, extrairTiktok, extrairYoutube } from './extrair'
import type { RedeSocial, RosterArtist, RosterParseResult } from './types'

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

/** Mantém o id resolvido quando a planilha traz a MESMA conta sem id. */
function combinarRedeRoster(atual: RedeSocial | null, nova: RedeSocial): RedeSocial {
  if (nova.id) return nova // id já veio resolvido da própria URL (ex.: Spotify /artist/<id>)
  if (atual?.id && mesmaIdentidade(atual, nova)) {
    return { url: nova.url, id: atual.id, handle: nova.handle } // preserva o id vinculado
  }
  return nova // conta nova ou trocada -> id null (o "descobrir" re-resolve)
}

/**
 * Mescla as redes da planilha com as já gravadas, preservando os ids resolvidos
 * (igUserId/channelId/artistId). Redes ausentes na planilha NÃO são tocadas.
 */
function mesclarRedesRoster(
  atuais: Record<string, RedeSocial | null | undefined>,
  a: RosterArtist,
): Record<string, RedeSocial> {
  const out: Record<string, RedeSocial> = {}
  for (const net of ['spotify', 'youtube', 'instagram', 'tiktok'] as const) {
    const nova = a[net]
    if (!nova) continue
    out[net] = combinarRedeRoster(atuais[net] ?? null, nova)
  }
  return out
}

export async function salvarRoster(
  res: RosterParseResult,
  meta: RosterMeta
): Promise<{ cadastroId: string; gravados: number }> {
  const agora = admin.firestore.FieldValue.serverTimestamp()
  const validos = res.artistas.filter((a) => a.slug)

  // Lê os docs existentes pra PRESERVAR os ids já resolvidos. A planilha só traz
  // @/URL (id null), então gravar o id da planilha apagaria o vínculo — um
  // re-import zeraria igUserId/channelId/artistId de todo mundo.
  const refs = validos.map((a) => adminDb.collection(ARTISTAS).doc(a.slug))
  const snaps = refs.length ? await adminDb.getAll(...refs) : []
  const redesExistentes = new Map<string, Record<string, RedeSocial | null | undefined>>()
  for (const s of snaps) {
    const redes = (s.exists ? (s.data()?.redes ?? {}) : {}) as Record<
      string,
      RedeSocial | null | undefined
    >
    redesExistentes.set(s.id, redes)
  }

  const batch = adminDb.batch()
  let gravados = 0
  for (const a of validos) {
    const ref = adminDb.collection(ARTISTAS).doc(a.slug)
    const redes = mesclarRedesRoster(redesExistentes.get(a.slug) ?? {}, a)
    const data: Record<string, unknown> = {
      nome: a.nome,
      slug: a.slug,
      fonteCadastro: 'roster',
      cadastroAtualizadoEm: agora,
    }
    if (Object.keys(redes).length) data.redes = redes
    batch.set(ref, data, { merge: true })
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

/** Mesma rede social — compara id, depois handle, depois url. */
function mesmaIdentidade(a: RedeSocial, b: RedeSocial): boolean {
  if (a.id && b.id) return a.id === b.id
  if (a.handle && b.handle) return a.handle.toLowerCase() === b.handle.toLowerCase()
  return Boolean(a.url && b.url && a.url === b.url)
}

export interface AtualizarArtistaInput {
  slug: string
  nome: string
  genero?: string | null
  spotifyUrl?: string | null
  youtubeUrl?: string | null
  instagramUrl?: string | null
  tiktokUrl?: string | null
}

/**
 * Edição de um artista JÁ cadastrado. Ao contrário do upsert de criação, aqui a
 * ausência de uma rede REMOVE o vínculo (`FieldValue.delete`), e trocar a URL
 * faz o `id` (channelId/artistId) sair junto — assim o "descobrir" re-mapeia o
 * canal/perfil. URL idêntica à atual é preservada (mantém o id já resolvido).
 *
 * O slug (id do doc) é ESTÁVEL: renomear o artista não muda o slug nem quebra os
 * vínculos por slug (metricas-sociais, receitas, youtube-tokens).
 */
export async function atualizarArtistaManual(
  input: AtualizarArtistaInput,
  meta: { uid: string; email: string }
): Promise<ArtistaManualResultado> {
  const slug = (input.slug ?? '').trim()
  if (!slug) throw new ArtistaInputError('Artista inválido.')

  const ref = adminDb.collection(ARTISTAS).doc(slug)
  const snap = await ref.get()
  if (!snap.exists) throw new ArtistaInputError('Artista não encontrado.')

  const nome = (input.nome ?? '').trim()
  if (!nome) throw new ArtistaInputError('Informe o nome do artista.')
  const genero = (input.genero ?? '').trim() || null

  const atuais = (snap.data()?.redes ?? {}) as Record<string, RedeSocial | null | undefined>

  const specs: {
    key: 'spotify' | 'youtube' | 'instagram' | 'tiktok'
    url?: string | null
    extrair: (u: string) => RedeSocial | null
  }[] = [
    { key: 'spotify', url: input.spotifyUrl, extrair: extrairSpotify },
    { key: 'youtube', url: input.youtubeUrl, extrair: extrairYoutube },
    { key: 'instagram', url: input.instagramUrl, extrair: extrairInstagram },
    { key: 'tiktok', url: input.tiktokUrl, extrair: extrairTiktok },
  ]

  const agora = admin.firestore.FieldValue.serverTimestamp()
  const updates: Record<string, unknown> = {
    nome,
    genero: genero ?? admin.firestore.FieldValue.delete(),
    cadastroAtualizadoEm: agora,
    cadastroPorEmail: meta.email,
  }

  const redes: ArtistaManualResultado['redes'] = { spotify: null, youtube: null, instagram: null, tiktok: null }

  for (const { key, url, extrair } of specs) {
    const u = (url ?? '').trim()
    const atual = atuais[key] ?? null
    if (!u) {
      // Esvaziou o campo -> remove o vínculo da rede.
      if (atual) updates[`redes.${key}`] = admin.firestore.FieldValue.delete()
      continue
    }
    const nova = extrair(u)
    if (!nova) {
      if (atual) updates[`redes.${key}`] = admin.firestore.FieldValue.delete()
      continue
    }
    // Mesma identidade (id/handle/url) -> preserva (mantém o id já resolvido).
    if (atual && mesmaIdentidade(atual, nova)) {
      redes[key] = atual
      continue
    }
    updates[`redes.${key}`] = nova
    redes[key] = nova
  }

  const avisos: string[] = []
  if (redes.spotify && redes.spotify.url && !redes.spotify.id) {
    avisos.push('O link do Spotify não parece ser de artista (provável álbum/faixa) — salvei sem o ID.')
  }

  await ref.update(updates)

  return { slug, nome, genero, jaExistia: true, redes, avisos }
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

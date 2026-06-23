import { adminDb } from '@/lib/firebase-admin'
import type {
  HistoricoDiaDoc,
  HistoricoTikTokDiaDoc,
  HistoricoYouTubeDiaDoc,
  InstagramSnapshot,
  IntegracaoMetaDoc,
  IntegracaoTikTokDoc,
  IntegracaoYouTubeDoc,
  MetricasSociaisDoc,
  TikTokSnapshot,
  TikTokTokenDoc,
  YouTubeSnapshot,
  YouTubeTokenDoc,
} from './types'

/**
 * Escrita server-side (Admin SDK) das métricas sociais e do vínculo de contas.
 * As regras do Firestore bloqueiam escrita no client — tudo passa por aqui,
 * chamado pelas rotas de /api/integracoes/meta.
 */

/** Referência de artista para descoberta/sincronização (lida via Admin SDK). */
export interface ArtistaInstagramRef {
  slug: string
  nome: string
  /** Handle ou URL do Instagram cadastrado. */
  handle: string | null
  /** IG User ID já vinculado (se houver). */
  igUserId: string | null
}

/** Lê todos os artistas com os dados de Instagram relevantes (Admin SDK). */
export async function listarArtistasInstagram(): Promise<ArtistaInstagramRef[]> {
  const snap = await adminDb.collection('artistas').get()
  return snap.docs.map((d) => {
    const data = d.data() as {
      nome?: string
      redes?: { instagram?: { id?: string | null; handle?: string | null; url?: string | null } }
    }
    const ig = data.redes?.instagram ?? null
    return {
      slug: d.id,
      nome: data.nome ?? d.id,
      handle: ig?.handle ?? ig?.url ?? null,
      igUserId: ig?.id ?? null,
    }
  })
}

/**
 * Grava o IG User ID em `artistas/{slug}.redes.instagram.id`. O merge profundo
 * do Firestore preserva url/handle e as demais redes.
 */
export async function salvarVinculoInstagram(slug: string, igUserId: string): Promise<void> {
  await adminDb
    .doc(`artistas/${slug}`)
    .set({ redes: { instagram: { id: igUserId } } }, { merge: true })
}

/** Salva o snapshot mais recente do Instagram + o ponto diário de histórico. */
export async function salvarSnapshotInstagram(
  slug: string,
  snapshot: InstagramSnapshot,
  dia: string,
): Promise<void> {
  const ref = adminDb.doc(`metricas-sociais/${slug}`)

  // Carimba a medição anterior de cada post (pra calcular crescimento depois).
  const antesSnap = await ref.get()
  const igAntes = antesSnap.exists ? (antesSnap.data() as MetricasSociaisDoc).instagram ?? null : null
  if (igAntes?.postsRecentes?.length && snapshot.postsRecentes?.length) {
    const porId = new Map(igAntes.postsRecentes.map((p) => [p.id, p]))
    for (const p of snapshot.postsRecentes) {
      const a = porId.get(p.id)
      if (!a) continue
      p.curtidasAntes = a.curtidas
      p.comentariosAntes = a.comentarios
      p.medidoAntesEm = igAntes.coletadoEm
    }
  }
  if (igAntes) {
    snapshot.seguidoresAntes = igAntes.seguidores
    snapshot.seguidoresAntesEm = igAntes.coletadoEm
  }

  const doc: MetricasSociaisDoc = {
    slug,
    instagram: snapshot,
    atualizadoEm: snapshot.coletadoEm,
  }
  await ref.set(doc, { merge: true })

  const hist: HistoricoDiaDoc = {
    dia,
    seguidores: snapshot.seguidores,
    alcance: snapshot.alcance,
    visualizacoes: snapshot.visualizacoes,
    interacoesTotais: snapshot.interacoesTotais,
    coletadoEm: snapshot.coletadoEm,
  }
  await ref.collection('historico').doc(dia).set(hist, { merge: true })
}

/** Atualiza (merge) o status da integração em `integracoes/meta`. */
export async function gravarStatusMeta(status: Partial<IntegracaoMetaDoc>): Promise<void> {
  await adminDb.doc('integracoes/meta').set(status, { merge: true })
}

/* ───────────────────────────── TikTok ───────────────────────────── */

/** Referência de artista para a integração TikTok (lida via Admin SDK). */
export interface ArtistaTikTokRef {
  slug: string
  nome: string
  /** Handle/URL do TikTok cadastrado (informativo). */
  handle: string | null
  /** open_id já vinculado (se houver). */
  openId: string | null
}

/** Lê todos os artistas com os dados de TikTok relevantes (Admin SDK). */
export async function listarArtistasTikTok(): Promise<ArtistaTikTokRef[]> {
  const snap = await adminDb.collection('artistas').get()
  return snap.docs.map((d) => {
    const data = d.data() as {
      nome?: string
      redes?: { tiktok?: { id?: string | null; handle?: string | null; url?: string | null } }
    }
    const tt = data.redes?.tiktok ?? null
    return {
      slug: d.id,
      nome: data.nome ?? d.id,
      handle: tt?.handle ?? tt?.url ?? null,
      openId: tt?.id ?? null,
    }
  })
}

/**
 * Grava o vínculo do TikTok em `artistas/{slug}.redes.tiktok`. Como o artista
 * autorizou ESTA conta, o username é a fonte de verdade — gravamos id, handle e
 * url (perfil público). O merge profundo preserva as demais redes.
 */
export async function salvarVinculoTikTok(
  slug: string,
  openId: string,
  username?: string | null,
): Promise<void> {
  const tiktok: Record<string, string> = { id: openId }
  if (username) {
    tiktok.handle = username
    tiktok.url = `https://www.tiktok.com/@${username}`
  }
  await adminDb.doc(`artistas/${slug}`).set({ redes: { tiktok } }, { merge: true })
}

/** Grava (merge) os tokens OAuth do artista em `tiktok-tokens/{slug}`. SERVER-ONLY. */
export async function salvarTokenTikTok(token: TikTokTokenDoc): Promise<void> {
  await adminDb.doc(`tiktok-tokens/${token.slug}`).set(token, { merge: true })
}

/** Lê os tokens de um artista (server). null se não autorizado. */
export async function getTokenTikTok(slug: string): Promise<TikTokTokenDoc | null> {
  const s = await adminDb.doc(`tiktok-tokens/${slug}`).get()
  return s.exists ? (s.data() as TikTokTokenDoc) : null
}

/** Lista todos os tokens guardados (para a sincronização em lote). */
export async function listarTokensTikTok(): Promise<TikTokTokenDoc[]> {
  const snap = await adminDb.collection('tiktok-tokens').get()
  return snap.docs.map((d) => d.data() as TikTokTokenDoc)
}

/** Remove o vínculo (tokens) do TikTok de um artista. */
export async function removerTokenTikTok(slug: string): Promise<void> {
  await adminDb.doc(`tiktok-tokens/${slug}`).delete()
}

/** Salva o snapshot mais recente do TikTok + o ponto diário de histórico. */
export async function salvarSnapshotTikTok(
  slug: string,
  snapshot: TikTokSnapshot,
  dia: string,
): Promise<void> {
  const ref = adminDb.doc(`metricas-sociais/${slug}`)
  const doc: Partial<MetricasSociaisDoc> = {
    slug,
    tiktok: snapshot,
    atualizadoEm: snapshot.coletadoEm,
  }
  await ref.set(doc, { merge: true })

  const hist: HistoricoTikTokDiaDoc = {
    dia,
    seguidores: snapshot.seguidores,
    curtidas: snapshot.curtidas,
    videos: snapshot.videos,
    viewsRecentes: snapshot.viewsRecentes,
    coletadoEm: snapshot.coletadoEm,
  }
  await ref.collection('historico-tiktok').doc(dia).set(hist, { merge: true })
}

/** Atualiza (merge) o status da integração em `integracoes/tiktok`. */
export async function gravarStatusTikTok(status: Partial<IntegracaoTikTokDoc>): Promise<void> {
  await adminDb.doc('integracoes/tiktok').set(status, { merge: true })
}

/* ───────────────────────────── YouTube ───────────────────────────── */

/** Referência de artista para a integração YouTube (lida via Admin SDK). */
export interface ArtistaYouTubeRef {
  slug: string
  nome: string
  /** Handle/URL do YouTube cadastrado (usado para resolver o channelId). */
  handle: string | null
  /** Channel ID já vinculado (se houver). */
  channelId: string | null
}

/** Lê todos os artistas com os dados de YouTube relevantes (Admin SDK). */
export async function listarArtistasYouTube(): Promise<ArtistaYouTubeRef[]> {
  const snap = await adminDb.collection('artistas').get()
  return snap.docs.map((d) => {
    const data = d.data() as {
      nome?: string
      redes?: { youtube?: { id?: string | null; handle?: string | null; url?: string | null } }
    }
    const yt = data.redes?.youtube ?? null
    return {
      slug: d.id,
      nome: data.nome ?? d.id,
      handle: yt?.url ?? yt?.handle ?? null,
      channelId: yt?.id ?? null,
    }
  })
}

/**
 * Grava o channelId em `artistas/{slug}.redes.youtube.id`. Por padrão preserva
 * url/handle do cadastro (descoberta só resolve o id); passe `handle` para
 * também gravar handle/url (ex.: no callback, com o canal autorizado).
 */
export async function salvarVinculoYouTube(
  slug: string,
  channelId: string,
  handle?: string | null,
): Promise<void> {
  const youtube: Record<string, string> = { id: channelId }
  if (handle) {
    youtube.handle = handle
    youtube.url = `https://www.youtube.com/@${handle}`
  }
  await adminDb.doc(`artistas/${slug}`).set({ redes: { youtube } }, { merge: true })
}

/** Grava (merge) os tokens OAuth do artista em `youtube-tokens/{slug}`. SERVER-ONLY. */
export async function salvarTokenYouTube(token: YouTubeTokenDoc): Promise<void> {
  await adminDb.doc(`youtube-tokens/${token.slug}`).set(token, { merge: true })
}

/** Lê os tokens de um artista (server). null se não autorizado. */
export async function getTokenYouTube(slug: string): Promise<YouTubeTokenDoc | null> {
  const s = await adminDb.doc(`youtube-tokens/${slug}`).get()
  return s.exists ? (s.data() as YouTubeTokenDoc) : null
}

/** Lista todos os tokens guardados (para a sincronização em lote). */
export async function listarTokensYouTube(): Promise<YouTubeTokenDoc[]> {
  const snap = await adminDb.collection('youtube-tokens').get()
  return snap.docs.map((d) => d.data() as YouTubeTokenDoc)
}

/** Remove o vínculo (tokens) do YouTube de um artista. */
export async function removerTokenYouTube(slug: string): Promise<void> {
  await adminDb.doc(`youtube-tokens/${slug}`).delete()
}

/**
 * Zera a camada Analytics no snapshot do artista (mantém a pública). Usado ao
 * desconectar o OAuth, pra os dados privados não ficarem presos no card.
 */
export async function limparAnalyticsYouTube(slug: string): Promise<void> {
  await adminDb.doc(`metricas-sociais/${slug}`).set({ youtube: { analytics: null } }, { merge: true })
}

/** Salva o snapshot mais recente do YouTube + o ponto diário de histórico. */
export async function salvarSnapshotYouTube(
  slug: string,
  snapshot: YouTubeSnapshot,
  dia: string,
): Promise<void> {
  const ref = adminDb.doc(`metricas-sociais/${slug}`)

  // Carimba a medição anterior de cada vídeo (pra calcular crescimento depois).
  const antesSnap = await ref.get()
  const ytAntes = antesSnap.exists ? (antesSnap.data() as MetricasSociaisDoc).youtube ?? null : null
  if (ytAntes?.videosRecentes?.length && snapshot.videosRecentes?.length) {
    const porId = new Map(ytAntes.videosRecentes.map((v) => [v.id, v]))
    for (const v of snapshot.videosRecentes) {
      const a = porId.get(v.id)
      if (!a) continue
      v.viewsAntes = a.views
      v.curtidasAntes = a.curtidas
      v.comentariosAntes = a.comentarios
      v.medidoAntesEm = ytAntes.coletadoEm
    }
  }
  if (ytAntes) {
    snapshot.inscritosAntes = ytAntes.inscritos
    snapshot.inscritosAntesEm = ytAntes.coletadoEm
  }

  const doc: Partial<MetricasSociaisDoc> = {
    slug,
    youtube: snapshot,
    atualizadoEm: snapshot.coletadoEm,
  }
  await ref.set(doc, { merge: true })

  const hist: HistoricoYouTubeDiaDoc = {
    dia,
    inscritos: snapshot.inscritos,
    viewsTotais: snapshot.viewsTotais,
    viewsRecentes: snapshot.viewsRecentes,
    minutosExibidos: snapshot.analytics?.minutosExibidos ?? null,
    coletadoEm: snapshot.coletadoEm,
  }
  await ref.collection('historico-youtube').doc(dia).set(hist, { merge: true })
}

/** Atualiza (merge) o status da integração em `integracoes/youtube`. */
export async function gravarStatusYouTube(status: Partial<IntegracaoYouTubeDoc>): Promise<void> {
  await adminDb.doc('integracoes/youtube').set(status, { merge: true })
}

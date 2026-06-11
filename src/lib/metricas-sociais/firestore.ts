import { adminDb } from '@/lib/firebase-admin'
import type {
  HistoricoDiaDoc,
  InstagramSnapshot,
  IntegracaoMetaDoc,
  MetricasSociaisDoc,
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

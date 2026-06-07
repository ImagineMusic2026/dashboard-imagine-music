import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import type { RosterParseResult } from './types'

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

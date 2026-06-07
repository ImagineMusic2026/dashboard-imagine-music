import admin from 'firebase-admin'
import { adminDb } from '@/lib/firebase-admin'
import { importIdDe } from './aggregate'
import { onerpmConfig } from './config'
import { receitaPorPlataformaDisplay, totalReceitaBRL } from './display'
import type { OneRpmAggregate } from './types'

/**
 * Persistência da importação da OneRPM (⚠️ só servidor — usa o Admin SDK).
 *
 * Grava em três coleções, numa transação em lote:
 *  - `importacoes/{id}`  -> histórico completo (metadados + agregado cru) — admin
 *  - `receitas/{slug}`   -> receita pronta p/ o perfil — SÓ ADMIN lê
 *  - `artistas/{slug}`   -> garante o cadastro do artista (nome/label) — público
 *
 * A receita (dado sensível) fica numa coleção SEPARADA de `artistas` de propósito:
 * assim o marketing pode ver a lista/cadastro sem ver receita (regras do Firestore).
 * Guardamos os valores ORIGINAIS por moeda, então a exibição (base net/gross e
 * câmbio) pode ser recalculada sem reimportar.
 */

const IMPORTACOES = 'importacoes'
const ARTISTAS = 'artistas'
const RECEITAS = 'receitas'

export interface ImportMeta {
  arquivoNome: string
  tamanhoBytes: number
  uid: string
  email: string
}

export interface ImportacaoResumo {
  id: string
  arquivoNome: string
  tamanhoBytes: number
  fonte: 'onerpm'
  artistaNome: string
  artistaSlug: string
  status: 'processado' | 'erro'
  linhas: number
  streams: number
  totalBRL: number
  moedas: string[]
  periodo: OneRpmAggregate['periodo']
  avisos: string[]
  criadoEmISO: string | null
  criadoPorEmail: string
}

export async function salvarImportacao(
  agg: OneRpmAggregate,
  meta: ImportMeta
): Promise<{ importId: string; artistaSlug: string; totalBRL: number }> {
  const receitaPorPlataforma = receitaPorPlataformaDisplay(agg)
  const totalBRL = totalReceitaBRL(agg)
  const agora = admin.firestore.FieldValue.serverTimestamp()

  // ID determinístico (artista + período): reimportar o mesmo período sobrescreve,
  // em vez de criar um registro duplicado.
  const importRef = adminDb.collection(IMPORTACOES).doc(importIdDe(agg))
  const artistaRef = adminDb.collection(ARTISTAS).doc(agg.artistaSlug)
  const receitaRef = adminDb.collection(RECEITAS).doc(agg.artistaSlug)

  const batch = adminDb.batch()

  batch.set(importRef, {
    fonte: 'onerpm',
    arquivoNome: meta.arquivoNome,
    tamanhoBytes: meta.tamanhoBytes,
    artistaNome: agg.artistaNome,
    artistaSlug: agg.artistaSlug,
    label: agg.label,
    status: 'processado',
    linhas: agg.totais.linhas,
    streams: agg.totais.streams,
    moedas: agg.moedas,
    periodo: agg.periodo,
    totais: agg.totais,
    totalBRL,
    avisos: agg.avisos,
    configUsada: onerpmConfig,
    agregado: agg, // resumo completo (poucos KB) p/ histórico/recálculo
    criadoEm: agora,
    criadoPorUid: meta.uid,
    criadoPorEmail: meta.email,
  })

  // Cadastro (NÃO sensível): só garante que o artista existe na lista pública.
  batch.set(
    artistaRef,
    { nome: agg.artistaNome, slug: agg.artistaSlug, label: agg.label, atualizadoEm: agora },
    { merge: true }
  )

  // Receita (SENSÍVEL): coleção separada, admin-only.
  batch.set(receitaRef, {
    slug: agg.artistaSlug,
    nome: agg.artistaNome,
    label: agg.label,
    fonte: 'onerpm',
    receitaPorPlataforma, // já no formato que o painel exibe
    totais: agg.totais,
    totalBRL,
    streams: agg.totais.streams,
    moedas: agg.moedas,
    periodo: agg.periodo,
    configUsada: onerpmConfig,
    ultimaImportacaoId: importRef.id,
    atualizadoEm: agora,
  })

  await batch.commit()
  return { importId: importRef.id, artistaSlug: agg.artistaSlug, totalBRL }
}

export async function listarImportacoes(max = 20): Promise<ImportacaoResumo[]> {
  const snap = await adminDb.collection(IMPORTACOES).orderBy('criadoEm', 'desc').limit(max).get()
  return snap.docs.map((d) => {
    const x = d.data()
    const ts = x.criadoEm as admin.firestore.Timestamp | undefined
    return {
      id: d.id,
      arquivoNome: x.arquivoNome ?? '',
      tamanhoBytes: x.tamanhoBytes ?? 0,
      fonte: 'onerpm',
      artistaNome: x.artistaNome ?? '',
      artistaSlug: x.artistaSlug ?? '',
      status: x.status ?? 'processado',
      linhas: x.linhas ?? 0,
      streams: x.streams ?? 0,
      totalBRL: x.totalBRL ?? 0,
      moedas: x.moedas ?? [],
      periodo: x.periodo ?? { transactionMonths: [], accountedFrom: null, accountedTo: null },
      avisos: x.avisos ?? [],
      criadoEmISO: ts ? ts.toDate().toISOString() : null,
      criadoPorEmail: x.criadoPorEmail ?? '',
    }
  })
}

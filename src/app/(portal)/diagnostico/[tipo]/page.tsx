'use client'

import { notFound } from 'next/navigation'
import { DiagnosticoForm } from '@/components/portal/diagnostico-form'
import { ehTipoValido } from '@/lib/diagnostico/perguntas'

/**
 * Questionário de estruturação no portal do artista. Fica sob `(portal)`, então o
 * PortalGuard já garante que só artista logado chega aqui; as regras do Firestore
 * garantem que ele só escreve no próprio slug.
 */
export default function DiagnosticoPage({ params }: { params: { tipo: string } }) {
  if (!ehTipoValido(params.tipo)) notFound()
  return <DiagnosticoForm tipo={params.tipo} />
}

'use client'

import { notFound } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { DiagnosticoForm } from '@/components/diagnostico/diagnostico-form'
import { ehTipoValido } from '@/lib/diagnostico/perguntas'

/**
 * Questionário de estruturação no portal do artista. Fica sob `(portal)`, então o
 * PortalGuard já garante que só artista logado chega aqui (e só depois que o perfil
 * carregou); as regras do Firestore garantem que ele só escreve no próprio slug.
 *
 * O mesmo formulário serve a equipe no painel, por outra rota — ver
 * `/artistas/[id]/questionario/[tipo]`.
 */
export default function DiagnosticoPage({ params }: { params: { tipo: string } }) {
  const { appUser } = useAuth()
  if (!ehTipoValido(params.tipo)) notFound()
  return <DiagnosticoForm tipo={params.tipo} slug={appUser?.artistaSlug ?? null} modo="artista" />
}

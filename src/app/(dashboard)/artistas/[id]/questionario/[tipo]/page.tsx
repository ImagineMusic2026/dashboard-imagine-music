'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PermissaoGate, SemAcesso } from '@/components/auth/permissao-gate'
import { DiagnosticoForm } from '@/components/diagnostico/diagnostico-form'
import { getArtista } from '@/lib/artistas/client'
import { ehTipoValido } from '@/lib/diagnostico/perguntas'

/**
 * A EQUIPE preenchendo o questionário de estruturação de um artista — o mesmo
 * formulário do portal, no painel. Existe porque boa parte das respostas chega por
 * fora (reunião, WhatsApp, o formulário antigo) e antes só o artista logado
 * conseguia registrar.
 *
 * Página própria, e não um modal: são ~20 campos de texto longo com autosave, e o
 * endereço fica compartilhável dentro da equipe.
 *
 * O nome do artista é carregado antes do formulário de propósito — no painel se
 * preenche por VÁRIOS artistas, e errar de quem é o questionário é um estrago que
 * ninguém percebe na hora.
 */
export default function QuestionarioDoArtistaPage({ params }: { params: { id: string; tipo: string } }) {
  const [nome, setNome] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getArtista(params.id)
      .then((a) => vivo && setNome(a?.nome ?? params.id))
      .catch(() => vivo && setNome(params.id))
    return () => {
      vivo = false
    }
  }, [params.id])

  if (!ehTipoValido(params.tipo)) notFound()

  return (
    <PermissaoGate cap="editarArtistas" restrito={<SemAcesso titulo="Questionário de estruturação" />}>
      <div className="max-w-3xl mx-auto animate-fade-in">
        {nome === null ? (
          <div className="flex items-center gap-2 text-sm text-ink-400 py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <DiagnosticoForm tipo={params.tipo} slug={params.id} modo="equipe" artistaNome={nome} />
        )}
      </div>
    </PermissaoGate>
  )
}

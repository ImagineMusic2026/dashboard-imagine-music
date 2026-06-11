'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { getArtista } from '@/lib/artistas/client'
import { PerfilArtistaReal } from '@/components/artistas/perfil-artista-real'
import { VincularRedesCard } from '@/components/portal/vincular-redes-card'

/**
 * Portal do artista: mostra SOMENTE o perfil dele (o slug vem do próprio login,
 * em appUser.artistaSlug). O PortalGuard garante que só artista chega aqui; as
 * regras do Firestore garantem que ele só consegue ler o próprio slug.
 */
export default function MeuPerfilPage() {
  const { appUser } = useAuth()
  const slug = appUser?.artistaSlug ?? null

  const [nome, setNome] = useState('')
  const [igHandle, setIgHandle] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let vivo = true
    getArtista(slug)
      .then((a) => {
        if (!vivo || !a) return
        setNome(a.nome)
        setIgHandle(a.redes?.instagram?.handle ?? null)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [slug])

  if (!slug) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Perfil ainda não vinculado</h1>
        <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">
          Seu login ainda não está ligado a um perfil de artista. Fale com a equipe da Imagine pra
          concluir a configuração.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VincularRedesCard nome={nome || appUser?.nome || 'Artista'} igHandle={igHandle} />
      <PerfilArtistaReal slug={slug} mostrarVoltar={false} />
    </div>
  )
}

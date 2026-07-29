'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { getArtista } from '@/lib/artistas/client'
import { getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import { PerfilArtistaReal } from '@/components/artistas/perfil-artista-real'
import { VincularRedesCard } from '@/components/portal/vincular-redes-card'
import { DiagnosticoCard } from '@/components/portal/diagnostico-card'

/**
 * Portal do artista: mostra SOMENTE o perfil dele (o slug vem do próprio login,
 * em appUser.artistaSlug). O PortalGuard garante que só artista chega aqui; as
 * regras do Firestore garantem que ele só consegue ler o próprio slug.
 *
 * O CTA de vincular redes só aparece pra quem AINDA não vinculou (pedido da
 * cliente): quem já concedeu o acesso não vê a caixa.
 */
export default function MeuPerfilPage() {
  const { appUser } = useAuth()
  const slug = appUser?.artistaSlug ?? null

  const [nome, setNome] = useState('')
  const [igHandle, setIgHandle] = useState<string | null>(null)
  // `null` enquanto checa — o CTA de vincular não pisca pra quem já vinculou.
  const [faltaVincular, setFaltaVincular] = useState<boolean | null>(null)

  useEffect(() => {
    if (!slug) return
    let vivo = true
    Promise.all([getArtista(slug), getMetricasSociaisCached(slug).catch(() => null)])
      .then(([a, m]) => {
        if (!vivo) return
        if (a) {
          setNome(a.nome)
          setIgHandle(a.redes?.instagram?.handle ?? null)
        }
        // Já concedeu o acesso? A descoberta grava o IG User ID no cadastro e o
        // sync passa a trazer o snapshot — qualquer um dos dois já significa
        // "vinculado" (editar a URL do Instagram no painel zera o id até o
        // próximo "Descobrir contas", e aí é o snapshot que segura).
        setFaltaVincular(!(a?.redes?.instagram?.id || m?.instagram))
      })
      // Falhou a leitura do cadastro: mostra o CTA, como era antes.
      .catch(() => vivo && setFaltaVincular(true))
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
      {faltaVincular && (
        <VincularRedesCard nome={nome || appUser?.nome || 'Artista'} igHandle={igHandle} />
      )}
      <DiagnosticoCard slug={slug} />
      <PerfilArtistaReal slug={slug} mostrarVoltar={false} />
    </div>
  )
}

import { PerfilArtistaReal } from '@/components/artistas/perfil-artista-real'

interface Props {
  params: { id: string }
}

/**
 * Perfil do artista — sempre o perfil REAL (lê o cadastro + métricas do Firestore
 * pelo slug). A rota é dinâmica: cada artista renderiza sob demanda.
 */
export default function PerfilArtistaPage({ params }: Props) {
  return <PerfilArtistaReal slug={params.id} />
}

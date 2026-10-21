'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { ehArtista, ehColaborador, ehStaff, rotaInicial, rotaPermitida } from '@/lib/permissions'

/**
 * Protege as rotas do dashboard:
 * - sem usuário autenticado → manda pro /login;
 * - usuário com acesso desativado (`ativo: false`) → desloga e manda pro /login;
 * - artista → portal dele;
 * - colaborador fora das áreas dele → manda pra primeira área liberada, SEM montar
 *   a página pedida (ela dispararia leituras que as regras negariam de qualquer
 *   jeito, e mostraria a casca de uma tela que não é dele);
 * - enquanto o Firebase resolve o estado de auth, mostra um loader (evita "flash"
 *   de conteúdo protegido).
 *
 * Obs.: esta é a barreira de UX. A proteção de verdade está no servidor — a
 * credencial é desabilitada no Firebase Auth e as regras do Firestore checam `ativo`
 * e recortam o que o colaborador lê.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, appUser, role, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const inativo = appUser?.ativo === false
  const artista = ehArtista(role)
  const colaborador = ehColaborador(role)
  const inicial = rotaInicial(appUser)
  const foraDaArea = colaborador && !!inicial && !rotaPermitida(appUser, pathname)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (inativo) {
      signOut(auth).finally(() => router.replace('/login?desativado=1'))
      return
    }
    // Artista não acessa o painel da equipe — redireciona pro portal dele.
    if (artista) {
      router.replace('/meu-perfil')
      return
    }
    if (foraDaArea && inicial) router.replace(inicial)
  }, [loading, user, inativo, artista, foraDaArea, inicial, router])

  if (loading || !user || inativo || artista || foraDaArea) return <Carregando />

  // Logado, mas sem perfil legível. Não desloga: logo depois de aceitar um
  // convite o perfil pode chegar um instante depois, e recarregar resolve.
  if (!appUser) {
    return (
      <Aviso
        titulo="Não consegui carregar seu perfil"
        texto="Tente de novo. Se continuar, fale com um admin da Imagine."
        tentarDeNovo
      />
    )
  }

  if (colaborador && !inicial) {
    return (
      <Aviso
        titulo="Nenhuma área liberada para você ainda"
        texto="Fale com um admin da Imagine para liberar o seu acesso."
      />
    )
  }

  // Papel que o painel não conhece: nada a mostrar, e não vale cair no painel
  // da equipe por omissão.
  if (!ehStaff(role) && !colaborador) {
    return <Aviso titulo="Sem acesso" texto="Este login não tem acesso ao painel." />
  }

  return <>{children}</>
}

function Carregando() {
  return (
    <div className="min-h-screen bg-bg-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-amber-400 grid place-items-center text-bg-950 font-bold text-xl animate-pulse">
          i
        </div>
        <span className="text-sm text-ink-500">Carregando…</span>
      </div>
    </div>
  )
}

function Aviso({
  titulo,
  texto,
  tentarDeNovo = false,
}: {
  titulo: string
  texto: string
  tentarDeNovo?: boolean
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-bg-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-900 p-6 text-center">
        <h1 className="text-base font-semibold text-ink-100">{titulo}</h1>
        <p className="mt-2 text-sm text-ink-400">{texto}</p>
        <div className="mt-6 flex justify-center gap-2">
          {tentarDeNovo && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar de novo
            </Button>
          )}
          <Button onClick={() => signOut(auth).finally(() => router.replace('/login'))}>Sair</Button>
        </div>
      </div>
    </div>
  )
}

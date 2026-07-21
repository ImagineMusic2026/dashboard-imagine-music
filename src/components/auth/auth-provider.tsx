'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getAppUser, setFavorito, type AppUser, type Capacidade, type Role } from '@/lib/users'
import { temPermissao } from '@/lib/permissions'

type AuthContextValue = {
  user: User | null
  appUser: AppUser | null
  role: Role | null
  /** Permissão efetiva do usuário logado (override por pessoa ou padrão do papel). */
  pode: (cap: Capacidade) => boolean
  /** Slugs favoritados por ESTA pessoa (lista pessoal). */
  favoritos: Set<string>
  ehFavorito: (slug: string) => boolean
  /** Favorita/desfavorita otimista — atualiza a UI na hora e persiste no Firestore. */
  alternarFavorito: (slug: string) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  appUser: null,
  role: null,
  pode: () => false,
  favoritos: new Set(),
  ehFavorito: () => false,
  alternarFavorito: () => {},
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Semeia os favoritos a partir do perfil carregado (e limpa no logout).
  useEffect(() => {
    setFavoritos(new Set(appUser?.favoritos ?? []))
  }, [appUser])

  function alternarFavorito(slug: string) {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const eraFavorito = favoritos.has(slug)
    // Otimista: mexe na UI já; se o Firestore recusar, desfaz.
    setFavoritos((prev) => {
      const proximo = new Set(prev)
      if (eraFavorito) proximo.delete(slug)
      else proximo.add(slug)
      return proximo
    })
    setFavorito(uid, slug, !eraFavorito).catch(() => {
      setFavoritos((prev) => {
        const proximo = new Set(prev)
        if (eraFavorito) proximo.add(slug)
        else proximo.delete(slug)
        return proximo
      })
    })
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          setAppUser(await getAppUser(u.uid))
        } catch (err) {
          // Provável enquanto as regras do Firestore não liberam /users ou o doc não existe.
          console.warn(
            '[auth] Não foi possível carregar o perfil no Firestore — confira as regras de /users e se o documento do usuário existe.',
            err
          )
          setAppUser(null)
        }
      } else {
        setAppUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        role: appUser?.role ?? null,
        pode: (cap) => temPermissao(appUser, cap),
        favoritos,
        ehFavorito: (slug) => favoritos.has(slug),
        alternarFavorito,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

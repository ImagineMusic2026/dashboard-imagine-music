'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getAppUser, type AppUser, type Role } from '@/lib/users'

type AuthContextValue = {
  user: User | null
  appUser: AppUser | null
  role: Role | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  appUser: null,
  role: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

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
    <AuthContext.Provider value={{ user, appUser, role: appUser?.role ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

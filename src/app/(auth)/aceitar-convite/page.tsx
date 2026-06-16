'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getConvite, marcarConviteAceito, type Convite } from '@/lib/invites'
import { roleMeta } from '@/lib/users'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/shared/logo'

function mensagemErro(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/email-already-in-use':
        return 'Já existe uma conta com esse e-mail. Faça login normalmente.'
      case 'auth/weak-password':
        return 'A senha precisa ter ao menos 6 caracteres.'
      case 'permission-denied':
        return 'Não foi possível concluir — convite inválido ou regras do Firestore não publicadas.'
    }
  }
  return 'Não foi possível concluir o cadastro. Tente novamente.'
}

function Marca() {
  return <BrandLogo className="h-8 mb-8" />
}

function AceitarConviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [convite, setConvite] = useState<Convite | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setCarregando(false)
      return
    }
    getConvite(token)
      .then((c) => setConvite(c && c.status === 'pendente' ? c : null))
      .catch((e) => {
        console.error(e)
        setConvite(null)
      })
      .finally(() => setCarregando(false))
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando || !convite || !token) return
    setErro(null)
    if (senha.length < 6) {
      setErro('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.')
      return
    }
    setEnviando(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, convite.email, senha)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: convite.email,
        nome: convite.nome,
        role: convite.role,
        ativo: true,
        conviteToken: token,
        // Só para artista: amarra o login ao slug do artista (validado nas regras).
        ...(convite.artistaSlug ? { artistaSlug: convite.artistaSlug } : {}),
      })
      await marcarConviteAceito(token)
      router.push('/home')
    } catch (err) {
      console.error(err)
      setErro(mensagemErro(err))
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="w-full flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-ink-500" />
      </div>
    )
  }

  if (!convite) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <Marca />
          <h1 className="text-2xl font-bold text-ink-100 mb-2">Convite inválido</h1>
          <p className="text-ink-400 text-sm mb-6">
            Este convite não existe, expirou ou já foi utilizado.
          </p>
          <Link
            href="/login"
            className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    )
  }

  const meta = roleMeta[convite.role] ?? roleMeta.marketing

  return (
    <div className="w-full flex items-center justify-center p-8">
      <div className="w-full max-w-md animate-fade-in">
        <Marca />

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-ink-100 mb-2">Você foi convidado(a)</h1>
          <p className="text-ink-400 text-sm">
            Crie sua senha para acessar o Painel de Artistas da Imagine.
          </p>
        </div>

        <div className="flex items-center justify-between bg-bg-900 border border-bg-700/50 rounded-lg px-4 py-3 mb-4">
          <div className="min-w-0">
            <div className="text-[11px] text-ink-500 uppercase tracking-wider">Conta</div>
            <div className="text-sm text-ink-100 num truncate">{convite.email}</div>
          </div>
          <span
            className={cn(
              'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border',
              meta.classe
            )}
          >
            {meta.label.toUpperCase()}
          </span>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-ink-300 mb-1.5">
              Criar senha
            </label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-bg-900 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="block text-sm font-medium text-ink-300 mb-1.5">
              Confirmar senha
            </label>
            <input
              id="confirmar"
              type="password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repita a senha"
              className="w-full bg-bg-900 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            aria-busy={enviando}
            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {enviando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              <>
                Criar conta e entrar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AceitarConvitePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-ink-500" />
        </div>
      }
    >
      <AceitarConviteInner />
    </Suspense>
  )
}

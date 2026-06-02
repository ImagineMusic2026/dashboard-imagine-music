'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

const EMAIL_KEY = 'painel:email'
const LEMBRAR_KEY = 'painel:lembrar'

function mensagemErro(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mail ou senha incorretos.'
      case 'auth/invalid-email':
        return 'E-mail inválido.'
      case 'auth/user-disabled':
        return 'Esta conta foi desativada.'
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua internet.'
    }
  }
  return 'Não foi possível entrar. Tente novamente.'
}

function mensagemReset(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-email':
        return 'E-mail inválido.'
      case 'auth/user-not-found':
        return 'Não encontramos uma conta com esse e-mail.'
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos.'
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua internet.'
    }
  }
  return 'Não foi possível enviar o e-mail. Tente novamente.'
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrar, setLembrar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [enviandoReset, setEnviandoReset] = useState(false)
  const [avisoAcesso, setAvisoAcesso] = useState(false)

  // Recupera a preferência e o e-mail lembrado (localStorage só existe no cliente).
  useEffect(() => {
    const lembrarSalvo = localStorage.getItem(LEMBRAR_KEY)
    const prefere = lembrarSalvo === null ? true : lembrarSalvo === 'true'
    setLembrar(prefere)
    const emailSalvo = localStorage.getItem(EMAIL_KEY)
    if (emailSalvo) setEmail(emailSalvo)
    if (new URLSearchParams(window.location.search).get('desativado') === '1') {
      setAvisoAcesso(true)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setErro(null)
    setResetMsg(null)
    setLoading(true)
    try {
      // Marcado: continua logado ao fechar o navegador. Desmarcado: só nesta sessão.
      try {
        await setPersistence(
          auth,
          lembrar ? browserLocalPersistence : browserSessionPersistence
        )
      } catch {
        /* se falhar, segue com a persistência padrão */
      }

      await signInWithEmailAndPassword(auth, email, senha)

      if (lembrar) {
        localStorage.setItem(EMAIL_KEY, email)
        localStorage.setItem(LEMBRAR_KEY, 'true')
      } else {
        localStorage.removeItem(EMAIL_KEY)
        localStorage.setItem(LEMBRAR_KEY, 'false')
      }

      router.push('/home')
    } catch (err) {
      setErro(mensagemErro(err))
      setLoading(false)
    }
  }

  async function handleResetSenha() {
    if (enviandoReset) return
    setErro(null)
    setResetMsg(null)
    const alvo = email.trim()
    if (!alvo) {
      setResetMsg({ ok: false, texto: 'Digite seu e-mail no campo acima para receber o link.' })
      return
    }
    setEnviandoReset(true)
    try {
      await sendPasswordResetEmail(auth, alvo)
      setResetMsg({
        ok: true,
        texto: `Enviamos um link de redefinição para ${alvo}. Confira sua caixa de entrada e o spam.`,
      })
    } catch (err) {
      setResetMsg({ ok: false, texto: mensagemReset(err) })
    } finally {
      setEnviandoReset(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {avisoAcesso && (
        <div
          role="alert"
          className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5"
        >
          Seu acesso foi desativado. Procure um administrador da Imagine.
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-300 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@somosimagine.com.br"
          className="w-full bg-bg-900 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="senha" className="block text-sm font-medium text-ink-300">
            Senha
          </label>
          <button
            type="button"
            onClick={handleResetSenha}
            disabled={enviandoReset}
            className="text-violet-400 text-xs hover:text-violet-300 transition-colors disabled:opacity-60"
          >
            {enviandoReset ? 'Enviando...' : 'Esqueci minha senha'}
          </button>
        </div>
        <div className="relative">
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? 'text' : 'password'}
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-bg-900 border border-bg-700/50 rounded-lg px-4 py-2.5 pr-11 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200 transition-colors"
          >
            {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 w-fit cursor-pointer select-none">
        <input
          type="checkbox"
          checked={lembrar}
          onChange={(e) => setLembrar(e.target.checked)}
          className="w-4 h-4 rounded border-bg-700 bg-bg-900 accent-violet-500 focus:ring-2 focus:ring-violet-500/30"
        />
        <span className="text-sm text-ink-300">Lembrar de mim</span>
      </label>

      {erro && (
        <div
          role="alert"
          className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
        >
          {erro}
        </div>
      )}

      {resetMsg && (
        <div
          role="status"
          className={`text-sm rounded-lg px-4 py-2.5 border ${
            resetMsg.ok
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}
        >
          {resetMsg.texto}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}

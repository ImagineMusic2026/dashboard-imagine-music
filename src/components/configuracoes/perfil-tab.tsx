'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Info, RefreshCw } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { useAuth } from '@/components/auth/auth-provider'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { roleMeta } from '@/lib/users'
import { cn } from '@/lib/utils'

function mensagemErro(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Senha atual incorreta.'
      case 'auth/weak-password':
        return 'A nova senha é muito fraca. Use pelo menos 6 caracteres.'
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua internet.'
      case 'auth/requires-recent-login':
        return 'Por segurança, saia e entre de novo antes de alterar a senha.'
    }
  }
  return 'Não foi possível alterar a senha. Tente novamente.'
}

/** Aba "Perfil" das Configurações: dados da conta e troca da própria senha. */
export function PerfilTab() {
  const { user, appUser, role } = useAuth()

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const meta = role ? roleMeta[role] : null
  const nome = appUser?.nome || user?.email?.split('@')[0] || ''
  const iniciais = nome
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (salvando || !user?.email) return
    setErro(null)
    setSucesso(false)

    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }
    if (novaSenha === senhaAtual) {
      setErro('A nova senha precisa ser diferente da atual.')
      return
    }

    setSalvando(true)
    try {
      // Confirma a senha atual antes de trocar (o Firebase exige login recente).
      const credencial = EmailAuthProvider.credential(user.email, senhaAtual)
      await reauthenticateWithCredential(user, credencial)
      await updatePassword(user, novaSenha)
      setSucesso(true)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmar('')
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="font-bold text-ink-100">Sua conta</div>
          <div className="text-[12px] text-ink-500">Dados de acesso ao painel.</div>
        </div>

        <div className="p-4 flex items-center gap-3 sm:gap-4">
          <AvatarFallback
            iniciais={iniciais}
            gradient={meta?.gradient ?? 'from-violet-500 to-fuchsia-500'}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-ink-100 truncate capitalize">{nome}</div>
            <div className="text-[12px] text-ink-500 num truncate">{user?.email}</div>
          </div>
          {meta && (
            <span
              className={cn('text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border', meta.classe)}
            >
              {meta.label.toUpperCase()}
            </span>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-start gap-2.5 text-[12px] text-ink-400 bg-bg-800/60 border border-bg-700/30 rounded-lg px-3.5 py-2.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-500" />
            <span>
              O e-mail de acesso não pode ser alterado. Para usar outro e-mail, peça a um
              administrador para remover este acesso e enviar um novo convite para o e-mail
              desejado.
            </span>
          </div>
        </div>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="font-bold text-ink-100">Alterar senha</div>
          <div className="text-[12px] text-ink-500">
            Confirme a senha atual e escolha uma nova com pelo menos 6 caracteres.
          </div>
        </div>

        <form className="p-5 space-y-4" onSubmit={handleSubmit}>
          <CampoSenha
            id="senha-atual"
            label="Senha atual"
            value={senhaAtual}
            onChange={setSenhaAtual}
            autoComplete="current-password"
          />
          <CampoSenha
            id="nova-senha"
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
          />
          <CampoSenha
            id="confirmar-senha"
            label="Confirmar nova senha"
            value={confirmar}
            onChange={setConfirmar}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
          />

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}
          {sucesso && (
            <div
              role="status"
              className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5"
            >
              Senha alterada com sucesso. Use a nova senha no próximo login.
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            aria-busy={salvando}
            className="w-full sm:w-auto bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Alterando...
              </>
            ) : (
              'Alterar senha'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

/** Input de senha com botão de mostrar/ocultar, no padrão dos formulários de auth. */
function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••',
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
}) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={mostrar ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 pr-11 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200 transition-colors"
        >
          {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

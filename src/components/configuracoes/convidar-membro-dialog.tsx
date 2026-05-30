'use client'

import { useState, type FormEvent } from 'react'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/components/auth/auth-provider'
import { copiarTexto } from '@/lib/clipboard'
import { criarConvite } from '@/lib/invites'
import { enviarEmailConvite } from '@/lib/email'
import { roleMeta, type Role } from '@/lib/users'
import { cn } from '@/lib/utils'

function mensagemErro(err: unknown): string {
  if (err instanceof FirebaseError && err.code === 'permission-denied') {
    return 'Sem permissão para convidar. Confirme que seu usuário é admin e que as regras do Firestore estão publicadas.'
  }
  return 'Não foi possível criar o convite. Tente novamente.'
}

type Props = {
  onClose: () => void
  onConcluido: () => void
}

export function ConvidarMembroDialog({ onClose, onConcluido }: Props) {
  const { user, appUser } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('marketing')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [link, setLink] = useState<string | null>(null)
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando || !user) return
    setErro(null)
    setEnviando(true)
    try {
      const convite = await criarConvite({ email, nome, role, criadoPor: user.uid })
      const url = `${window.location.origin}/aceitar-convite?token=${convite.token}`
      setLink(url)

      try {
        await enviarEmailConvite({
          toEmail: convite.email,
          toNome: convite.nome,
          inviteLink: url,
          role: convite.role,
          fromNome: appUser?.nome ?? user.email ?? 'Equipe Imagine',
        })
        setEmailEnviado(true)
      } catch (emailErr) {
        // Convite já existe; só não conseguimos mandar o e-mail (EmailJS ainda não configurado, etc.)
        console.warn('[convite] e-mail não enviado:', emailErr)
        setEmailEnviado(false)
      }
    } catch (err) {
      console.error(err)
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function copiarLink() {
    if (!link) return
    if (await copiarTexto(link)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  const sucesso = link !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40">
          <div className="font-bold text-ink-100">
            {sucesso ? 'Convite criado' : 'Convidar membro'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sucesso ? (
          <div className="p-5 space-y-4">
            <div
              className={cn(
                'text-sm rounded-lg px-4 py-2.5 border',
                emailEnviado
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              )}
            >
              {emailEnviado
                ? `E-mail de convite enviado para ${email}.`
                : 'Convite criado, mas não consegui enviar o e-mail automaticamente. Copie o link abaixo e envie manualmente.'}
            </div>

            <div>
              <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-1.5">
                Link do convite
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link ?? ''}
                  className="flex-1 bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2 text-xs text-ink-300 num truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copiarLink}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors"
                >
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onConcluido}
              className="w-full bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Concluir
            </button>
          </div>
        ) : (
          <form className="p-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="conv-nome" className="block text-sm font-medium text-ink-300 mb-1.5">
                Nome
              </label>
              <input
                id="conv-nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do convidado"
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label htmlFor="conv-email" className="block text-sm font-medium text-ink-300 mb-1.5">
                E-mail
              </label>
              <input
                id="conv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@somosimagine.com.br"
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <div className="block text-sm font-medium text-ink-300 mb-1.5">Papel</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(roleMeta) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-semibold border transition-colors',
                      role === r
                        ? roleMeta[r].classe
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800'
                    )}
                  >
                    {roleMeta[r].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-500 mt-2">
                {role === 'admin'
                  ? 'Acesso total — vê tudo e gerencia o time.'
                  : 'Acesso parcial — sem dados sensíveis de receita.'}
              </p>
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
              {enviando && <RefreshCw className="w-4 h-4 animate-spin" />}
              {enviando ? 'Criando convite...' : 'Criar convite e enviar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

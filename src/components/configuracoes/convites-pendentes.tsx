'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { useAuth } from '@/components/auth/auth-provider'
import { copiarTexto } from '@/lib/clipboard'
import { deleteConvite, listarConvitesPendentes, type Convite } from '@/lib/invites'
import { roleMeta } from '@/lib/users'
import { cn } from '@/lib/utils'

function iniciaisDe(nome: string, email: string): string {
  const base = nome?.trim() || email
  return base
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ConvitesPendentes({ modo }: { modo?: 'time' | 'artistas' }) {
  const { role, loading: authLoading } = useAuth()
  const ehAdmin = role === 'admin'

  const [convites, setConvites] = useState<Convite[] | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (authLoading) return
    if (!ehAdmin) {
      setConvites([])
      return
    }
    setConvites(null)
    listarConvitesPendentes()
      .then(setConvites)
      .catch((e) => {
        console.error(e)
        setConvites([])
      })
  }, [authLoading, ehAdmin])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Recarrega quando um convite é criado em outro componente (ex.: modal de convite).
  useEffect(() => {
    const handler = () => carregar()
    window.addEventListener('convite:atualizado', handler)
    return () => window.removeEventListener('convite:atualizado', handler)
  }, [carregar])

  async function copiarLink(token: string) {
    const url = `${window.location.origin}/aceitar-convite?token=${token}`
    if (await copiarTexto(url)) {
      setCopiado(token)
      setTimeout(() => setCopiado(null), 1500)
    } else {
      // Último recurso: mostra o link para cópia manual.
      window.prompt('Copie o link do convite:', url)
    }
  }

  async function cancelar(token: string) {
    setCancelando(token)
    try {
      await deleteConvite(token)
      setConvites((c) => (c ?? []).filter((x) => x.token !== token))
    } catch (e) {
      console.error(e)
    } finally {
      setCancelando(null)
    }
  }

  // Cada aba mostra só os convites do seu domínio (equipe vs portal de artista).
  const filtrados =
    convites === null
      ? null
      : convites.filter((c) =>
          modo === 'artistas' ? c.role === 'artista' : modo === 'time' ? c.role !== 'artista' : true,
        )
  const total = filtrados?.length ?? 0

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
        <div>
          <div className="font-bold text-ink-100">Convites pendentes</div>
          {filtrados !== null && total > 0 && (
            <div className="text-[12px] text-ink-500">{total} aguardando aceite</div>
          )}
        </div>
        {ehAdmin && (
          <button
            type="button"
            onClick={carregar}
            aria-label="Atualizar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtrados === null ? (
        <div className="flex items-center justify-center gap-2 text-ink-500 text-sm py-8">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Carregando convites…
        </div>
      ) : total === 0 ? (
        <div className="text-ink-500 text-sm text-center py-8">Nenhum convite pendente</div>
      ) : (
        <div className="divide-y divide-bg-700/30">
          {filtrados.map((c) => {
            const meta = roleMeta[c.role] ?? roleMeta.marketing
            return (
              <div
                key={c.token}
                className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-bg-800/30 transition-colors"
              >
                <AvatarFallback
                  iniciais={iniciaisDe(c.nome, c.email)}
                  gradient={meta.gradient}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink-100 truncate capitalize">
                    {c.nome || c.email.split('@')[0]}
                  </div>
                  <div className="text-[12px] text-ink-500 num truncate">{c.email}</div>
                </div>
                <span className="hidden sm:inline-block text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/25">
                  PENDENTE
                </span>
                <span
                  className={cn(
                    'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border',
                    meta.classe
                  )}
                >
                  {meta.label.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => copiarLink(c.token)}
                  title="Copiar link do convite"
                  className="p-1.5 rounded-md hover:bg-bg-700 text-ink-400 transition-colors"
                >
                  {copiado === c.token ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => cancelar(c.token)}
                  disabled={cancelando === c.token}
                  title="Cancelar convite"
                  className="p-1.5 rounded-md hover:bg-red-500/15 text-ink-400 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {cancelando === c.token ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

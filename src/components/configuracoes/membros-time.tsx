'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { useAuth } from '@/components/auth/auth-provider'
import { ConvidarMembroDialog } from '@/components/configuracoes/convidar-membro-dialog'
import { MembroAcoes } from '@/components/configuracoes/membro-acoes'
import { listAppUsers, roleMeta, type AppUser } from '@/lib/users'
import { cn } from '@/lib/utils'

function iniciaisDe(u: AppUser): string {
  const base = u.nome?.trim() || u.email
  return base
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function MembrosTime() {
  const { role, user } = useAuth()
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dialogAberto, setDialogAberto] = useState(false)

  const recarregar = useCallback(() => {
    setUsers(null)
    setErro(null)
    listAppUsers()
      .then(setUsers)
      .catch((e: unknown) => {
        console.error(e)
        const code = (e as { code?: string })?.code
        setErro(
          code === 'permission-denied'
            ? 'Sem acesso ao Firestore ainda. Publique as regras de segurança e crie seu usuário admin para ver os membros.'
            : 'Não foi possível carregar os membros do time.'
        )
        setUsers([])
      })
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const total = users?.length ?? 0
  const ehAdmin = role === 'admin'

  return (
    <>
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
          <div>
            <div className="font-bold text-ink-100">Membros do time</div>
            <div className="text-[12px] text-ink-500">
              {users === null ? 'Carregando…' : `${total} ${total === 1 ? 'ativo' : 'ativos'}`}
            </div>
          </div>
          {ehAdmin && (
            <button
              type="button"
              onClick={() => setDialogAberto(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Convidar membro
            </button>
          )}
        </div>

        {users === null ? (
          <div className="flex items-center justify-center gap-2 text-ink-500 text-sm py-10">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando membros…
          </div>
        ) : erro ? (
          <div className="text-amber-400/90 text-sm text-center py-8 px-6 leading-relaxed">
            {erro}
          </div>
        ) : users.length === 0 ? (
          <div className="text-ink-500 text-sm text-center py-10 px-6">
            Nenhum membro ainda. Convide o primeiro membro do time.
          </div>
        ) : (
          <div className="divide-y divide-bg-700/30">
            {users.map((u) => {
              const meta = roleMeta[u.role] ?? roleMeta.marketing
              return (
                <div
                  key={u.uid}
                  className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors"
                >
                  <AvatarFallback iniciais={iniciaisDe(u)} gradient={meta.gradient} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-ink-100 truncate capitalize">
                      {u.nome || u.email.split('@')[0]}
                    </div>
                    <div className="text-[12px] text-ink-500 num truncate">{u.email}</div>
                  </div>
                  {u.ativo === false && (
                    <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border bg-bg-700 text-ink-400 border-bg-600">
                      INATIVO
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border',
                      meta.classe
                    )}
                  >
                    {meta.label.toUpperCase()}
                  </span>
                  {ehAdmin &&
                    (u.uid === user?.uid ? (
                      <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border bg-bg-700/40 text-ink-400 border-bg-600/60">
                        VOCÊ
                      </span>
                    ) : (
                      <MembroAcoes membro={u} onMudar={recarregar} />
                    ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dialogAberto && (
        <ConvidarMembroDialog
          onClose={() => setDialogAberto(false)}
          onConcluido={() => {
            setDialogAberto(false)
            recarregar()
            window.dispatchEvent(new Event('convite:atualizado'))
          }}
        />
      )}
    </>
  )
}

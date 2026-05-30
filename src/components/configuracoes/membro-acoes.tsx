'use client'

import { MoreHorizontal, Power, Shield, UserMinus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { removerAppUser, setUserAtivo, updateUserRole, type AppUser } from '@/lib/users'

/** Menu de ações (•••) de um membro do time — visível apenas para admin. */
export function MembroAcoes({
  membro,
  onMudar,
}: {
  membro: AppUser
  onMudar: () => void
}) {
  const ativo = membro.ativo !== false

  async function executar(fn: () => Promise<void>) {
    try {
      await fn()
      onMudar()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mais opções"
        className="p-1.5 rounded-md hover:bg-bg-700 text-ink-400 transition-colors outline-none"
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-52 bg-bg-800 border border-bg-700/60 text-ink-200 shadow-xl ring-0 origin-top-right duration-150 ease-out data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[open]:slide-in-from-top-1 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95"
      >
        <DropdownMenuItem
          className="gap-2 px-2 py-1.5 text-ink-200 focus:bg-bg-700 focus:text-ink-100 cursor-pointer"
          onClick={() =>
            executar(() =>
              updateUserRole(membro.uid, membro.role === 'admin' ? 'marketing' : 'admin')
            )
          }
        >
          <Shield className="w-4 h-4" />
          {membro.role === 'admin' ? 'Tornar Marketing' : 'Tornar Admin'}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2 px-2 py-1.5 text-ink-200 focus:bg-bg-700 focus:text-ink-100 cursor-pointer"
          onClick={() => executar(() => setUserAtivo(membro.uid, !ativo))}
        >
          <Power className="w-4 h-4" />
          {ativo ? 'Desativar acesso' : 'Reativar acesso'}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-bg-700/60" />

        <DropdownMenuItem
          variant="destructive"
          className="gap-2 px-2 py-1.5 text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
          onClick={() => {
            if (window.confirm(`Remover ${membro.nome || membro.email} do time?`)) {
              executar(() => removerAppUser(membro.uid))
            }
          }}
        >
          <UserMinus className="w-4 h-4" />
          Remover do time
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

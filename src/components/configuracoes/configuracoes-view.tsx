'use client'

import { useState } from 'react'
import { MembrosTime } from '@/components/configuracoes/membros-time'
import { ConvitesPendentes } from '@/components/configuracoes/convites-pendentes'
import { MatrizPermissoes } from '@/components/configuracoes/matriz-permissoes'
import { NotificacoesPrefs } from '@/components/configuracoes/notificacoes-prefs'
import { cn } from '@/lib/utils'

type Aba = 'time' | 'artistas' | 'permissoes' | 'notificacoes'

const ABAS: { key: Aba; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'artistas', label: 'Artistas' },
  { key: 'permissoes', label: 'Permissões' },
  { key: 'notificacoes', label: 'Notificações' },
]

export function ConfiguracoesView() {
  const [aba, setAba] = useState<Aba>('time')

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-ink-100">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="lg:col-span-1">
          <nav className="bg-bg-900 border border-bg-700/40 rounded-xl p-2 flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:sticky lg:top-24">
            {ABAS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setAba(item.key)}
                className={cn(
                  'shrink-0 lg:w-full text-left whitespace-nowrap px-3 py-2 rounded-lg text-sm transition-colors border',
                  aba === item.key
                    ? 'bg-violet-500/10 text-violet-400 font-semibold border-violet-500/20'
                    : 'text-ink-300 hover:bg-bg-800 border-transparent',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="lg:col-span-2 space-y-4">
          {aba === 'time' && (
            <>
              <MembrosTime modo="time" />
              <ConvitesPendentes modo="time" />
            </>
          )}
          {aba === 'artistas' && (
            <>
              <MembrosTime modo="artistas" />
              <ConvitesPendentes modo="artistas" />
            </>
          )}
          {aba === 'permissoes' && <MatrizPermissoes />}
          {aba === 'notificacoes' && <NotificacoesPrefs />}
        </div>
      </div>
    </div>
  )
}

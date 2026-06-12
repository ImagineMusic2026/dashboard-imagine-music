'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Bell, SlidersHorizontal } from 'lucide-react'
import { MembrosTime } from '@/components/configuracoes/membros-time'
import { ConvitesPendentes } from '@/components/configuracoes/convites-pendentes'
import { MatrizPermissoes } from '@/components/configuracoes/matriz-permissoes'
import { cn } from '@/lib/utils'

type Aba = 'time' | 'permissoes' | 'notificacoes' | 'preferencias'

const ABAS: { key: Aba | 'integracoes'; label: string; link?: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'permissoes', label: 'Permissões' },
  { key: 'notificacoes', label: 'Notificações' },
  { key: 'integracoes', label: 'Integrações', link: '/integracoes' },
  { key: 'preferencias', label: 'Preferências' },
]

export function ConfiguracoesView() {
  const [aba, setAba] = useState<Aba>('time')

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-ink-100">Configurações</h1>

      <div className="grid grid-cols-3 gap-6">
        <aside className="col-span-1">
          <nav className="bg-bg-900 border border-bg-700/40 rounded-xl p-2 sticky top-24 space-y-1">
            {ABAS.map((item) =>
              item.link ? (
                <Link
                  key={item.key}
                  href={item.link}
                  className="block px-3 py-2 rounded-lg text-sm text-ink-300 hover:bg-bg-800 border border-transparent transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setAba(item.key as Aba)}
                  className={cn(
                    'w-full text-left block px-3 py-2 rounded-lg text-sm transition-colors border',
                    aba === item.key
                      ? 'bg-violet-500/10 text-violet-400 font-semibold border-violet-500/20'
                      : 'text-ink-300 hover:bg-bg-800 border-transparent',
                  )}
                >
                  {item.label}
                </button>
              ),
            )}
          </nav>
        </aside>

        <div className="col-span-2 space-y-4">
          {aba === 'time' && (
            <>
              <MembrosTime />
              <ConvitesPendentes />
            </>
          )}
          {aba === 'permissoes' && <MatrizPermissoes />}
          {aba === 'notificacoes' && (
            <EmBreve
              icone={<Bell className="w-5 h-5" />}
              titulo="Notificações"
              descricao="Configurar quais eventos notificam a equipe e por qual canal. Entra junto com a feature de Alertas."
            />
          )}
          {aba === 'preferencias' && (
            <EmBreve
              icone={<SlidersHorizontal className="w-5 h-5" />}
              titulo="Preferências"
              descricao="Preferências de exibição do painel (tema, idioma, formato de data)."
            />
          )}
        </div>
      </div>
    </div>
  )
}

function EmBreve({
  icone,
  titulo,
  descricao,
}: {
  icone: ReactNode
  titulo: string
  descricao: string
}) {
  return (
    <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-bg-800 grid place-items-center mx-auto mb-3 text-ink-500">
        {icone}
      </div>
      <div className="font-bold text-ink-200">{titulo}</div>
      <p className="text-[13px] text-ink-400 mt-1 max-w-sm mx-auto">{descricao}</p>
      <span className="inline-block mt-3 text-[10px] tracking-wider font-bold text-ink-500 bg-bg-800 border border-bg-700/50 rounded-full px-2.5 py-1 uppercase">
        Em breve
      </span>
    </div>
  )
}

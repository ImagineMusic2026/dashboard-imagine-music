'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { ConfigQuadroTab } from '@/components/atividades/config-quadro'
import { MembrosTime } from '@/components/configuracoes/membros-time'
import { ConvitesPendentes } from '@/components/configuracoes/convites-pendentes'
import { MatrizPermissoes } from '@/components/configuracoes/matriz-permissoes'
import { NotificacoesPrefs } from '@/components/configuracoes/notificacoes-prefs'
import { PerfilTab } from '@/components/configuracoes/perfil-tab'
import { ehStaff } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type Aba = 'time' | 'artistas' | 'permissoes' | 'quadro' | 'notificacoes' | 'perfil'

const ABAS: { key: Aba; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'artistas', label: 'Artistas' },
  { key: 'permissoes', label: 'Permissões' },
  { key: 'quadro', label: 'Quadro de atividades' },
  { key: 'notificacoes', label: 'Notificações' },
  { key: 'perfil', label: 'Perfil' },
]

const ABAS_VALIDAS = new Set(ABAS.map((a) => a.key))

export function ConfiguracoesView() {
  const { role } = useAuth()
  const [aba, setAba] = useState<Aba>('time')
  // O colaborador só cuida do próprio perfil: as outras abas são o time, os
  // logins de artista, a matriz e a configuração do quadro inteiro. Uma aba
  // pedida fora disso (ex.: `?aba=time`) cai na primeira que ele tem.
  const abas = ehStaff(role) ? ABAS : ABAS.filter((a) => a.key === 'perfil')
  const abaAtual = abas.some((a) => a.key === aba) ? aba : abas[0].key

  // `?aba=quadro` abre direto na configuração do quadro — é o link que o botão
  // "Configurar quadro" da tela de Atividades usa. Lido de `window` e não de
  // `useSearchParams` de propósito: aquele exigiria um limite de Suspense em
  // volta da página inteira só para ler um parâmetro opcional.
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('aba')
    if (pedida && ABAS_VALIDAS.has(pedida as Aba)) setAba(pedida as Aba)
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-ink-100">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="lg:col-span-1">
          <nav className="bg-bg-900 border border-bg-700/40 rounded-xl p-2 flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:sticky lg:top-24">
            {abas.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setAba(item.key)}
                className={cn(
                  'shrink-0 lg:w-full text-left whitespace-nowrap px-3 py-2 rounded-lg text-sm transition-colors border',
                  abaAtual === item.key
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
          {abaAtual === 'time' && (
            <>
              <MembrosTime modo="time" />
              <ConvitesPendentes modo="time" />
            </>
          )}
          {abaAtual === 'artistas' && (
            <>
              <MembrosTime modo="artistas" />
              <ConvitesPendentes modo="artistas" />
            </>
          )}
          {abaAtual === 'permissoes' && <MatrizPermissoes />}
          {abaAtual === 'quadro' && <ConfigQuadroTab />}
          {abaAtual === 'notificacoes' && <NotificacoesPrefs />}
          {abaAtual === 'perfil' && <PerfilTab />}
        </div>
      </div>
    </div>
  )
}

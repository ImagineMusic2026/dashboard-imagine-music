import { MembrosTime } from '@/components/configuracoes/membros-time'
import { ConvitesPendentes } from '@/components/configuracoes/convites-pendentes'
import { cn } from '@/lib/utils'

const secoes = [
  { key: 'time', label: 'Time', ativo: true },
  { key: 'permissoes', label: 'Permissões', ativo: false },
  { key: 'notificacoes', label: 'Notificações', ativo: false },
  { key: 'plano', label: 'Plano e cobrança', ativo: false },
  { key: 'integracoes', label: 'Integrações', ativo: false, link: '/integracoes' },
  { key: 'preferencias', label: 'Preferências', ativo: false },
]

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Configurações</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <aside className="col-span-1">
          <nav className="bg-bg-900 border border-bg-700/40 rounded-xl p-2 sticky top-24">
            {secoes.map((sec) => (
              <a
                key={sec.key}
                href={sec.link ?? '#'}
                className={cn(
                  'block px-3 py-2 rounded-lg text-sm transition-colors',
                  sec.ativo
                    ? 'bg-violet-500/10 text-violet-400 font-semibold border border-violet-500/20'
                    : 'text-ink-300 hover:bg-bg-800 border border-transparent'
                )}
              >
                {sec.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="col-span-2 space-y-4">
          <MembrosTime />
          <ConvitesPendentes />
        </div>
      </div>
    </div>
  )
}

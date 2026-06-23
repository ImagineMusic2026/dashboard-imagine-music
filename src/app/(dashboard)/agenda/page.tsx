import { AgendaView } from '@/components/agenda/agenda-view'
import { PermissaoGate, SemAcesso } from '@/components/auth/permissao-gate'

export default function AgendaPage() {
  return (
    <PermissaoGate cap="agenda" restrito={<SemAcesso titulo="Agenda" />}>
      <div className="animate-fade-in">
        <AgendaView />
      </div>
    </PermissaoGate>
  )
}

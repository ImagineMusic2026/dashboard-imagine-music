import { AtividadesBoard } from '@/components/atividades/atividades-board'
import { PermissaoGate, SemAcesso } from '@/components/auth/permissao-gate'

export default function AtividadesPage() {
  return (
    <PermissaoGate cap="atividades" restrito={<SemAcesso titulo="Atividades" />}>
      <div className="animate-fade-in">
        <AtividadesBoard />
      </div>
    </PermissaoGate>
  )
}

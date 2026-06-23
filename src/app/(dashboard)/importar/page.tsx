import { DollarSign, Users2 } from 'lucide-react'
import { ImportadorOneRpm } from '@/components/importar/importador-onerpm'
import { ImportadorRoster } from '@/components/importar/importador-roster'
import { PermissaoGate, SemAcesso } from '@/components/auth/permissao-gate'

export default function ImportarPage() {
  return (
    <PermissaoGate cap="importar" restrito={<SemAcesso titulo="Importar dados" />}>
    <div className="space-y-10 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Importar dados</h1>
        <p className="text-sm text-ink-400 mt-1">
          Receita (OneRPM) e cadastro de artistas (redes sociais) — direto das planilhas.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold tracking-wider text-ink-300 uppercase">Receita · OneRPM</h2>
        </div>
        <ImportadorOneRpm />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users2 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wider text-ink-300 uppercase">
            Cadastro de artistas · redes sociais
          </h2>
        </div>
        <ImportadorRoster />
      </section>
    </div>
    </PermissaoGate>
  )
}

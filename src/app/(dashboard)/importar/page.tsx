import { ImportadorOneRpm } from '@/components/importar/importador-onerpm'

export default function ImportarPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Importar dados</h1>
        <p className="text-sm text-ink-400 mt-1">
          Carregue o relatório de vendas da OneRPM (.xlsx) — streams e receita por faixa, loja e país.
        </p>
      </div>

      <ImportadorOneRpm />
    </div>
  )
}

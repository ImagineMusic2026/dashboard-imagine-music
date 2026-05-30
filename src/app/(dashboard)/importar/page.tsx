import {
  Edit3,
  FileText,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusImport = 'PROCESSADO' | 'PROCESSANDO' | 'ERRO'

const importacoes: {
  id: string
  nome: string
  tamanho: string
  detalhes: string
  data: string
  ha: string
  tipo: 'ddex' | 'csv'
  status: StatusImport
}[] = [
  {
    id: 'i1',
    nome: 'DDEX_DSR_2026-04.zip',
    tamanho: '423MB',
    detalhes: '1.847 faixas',
    data: '02/05/2026 02:14',
    ha: 'há 2h',
    tipo: 'ddex',
    status: 'PROCESSADO',
  },
  {
    id: 'i2',
    nome: 'metricas_radio_abril.xlsx',
    tamanho: '8KB',
    detalhes: '24 entradas',
    data: '06/05/2026 10:21',
    ha: 'há 1d',
    tipo: 'csv',
    status: 'PROCESSADO',
  },
  {
    id: 'i3',
    nome: 'DDEX_DSR_2026-03.zip',
    tamanho: '412MB',
    detalhes: '1.823 faixas',
    data: '02/04/2026 02:14',
    ha: 'há 1mês',
    tipo: 'ddex',
    status: 'PROCESSADO',
  },
  {
    id: 'i4',
    nome: 'cadastro_novos_artistas.csv',
    tamanho: '12KB',
    detalhes: '4 artistas',
    data: '14/04/2026 16:48',
    ha: 'há 1mês',
    tipo: 'csv',
    status: 'PROCESSADO',
  },
  {
    id: 'i5',
    nome: 'DDEX_DSR_2026-02.zip',
    tamanho: '398MB',
    detalhes: '1.802 faixas',
    data: '02/03/2026 02:14',
    ha: 'há 2mês',
    tipo: 'ddex',
    status: 'PROCESSADO',
  },
]

const statusBadgeMap: Record<StatusImport, string> = {
  PROCESSADO: 'bg-emerald-500/15 text-emerald-400',
  PROCESSANDO: 'bg-amber-500/15 text-amber-400',
  ERRO: 'bg-red-500/15 text-red-400',
}

export default function ImportarPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Importar dados</h1>
        <p className="text-sm text-ink-400 mt-1">
          Carregue relatórios DDEX, planilhas CSV/XLSX ou conecte uma nova fonte
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500/10 to-bg-900 border border-amber-500/30 rounded-xl p-6 flex flex-col">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 grid place-items-center mb-4">
            <FileText className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 inline-block w-fit mb-3">
            RECOMENDADO
          </span>
          <h3 className="font-bold text-lg text-ink-100">Relatório DDEX</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            Arquivo zipado direto do OneRPM com dados de streaming e receita de todas as
            plataformas
          </p>
          <ul className="text-[11px] text-ink-500 mt-3 space-y-1">
            <li>✓ DSR Flat-File (.txt, .csv)</li>
            <li>✓ DDEX XML (.xml)</li>
            <li>✓ ZIP contendo múltiplos relatórios</li>
          </ul>
          <button
            type="button"
            className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-bg-950 font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Selecionar arquivo DDEX
          </button>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex flex-col">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 grid place-items-center mb-4">
            <Upload className="w-6 h-6 text-violet-400" />
          </div>
          <h3 className="font-bold text-lg text-ink-100 mt-3">Planilha customizada</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            Para métricas que vocês acompanham fora das plataformas (rádio, eventos, fanclubes)
          </p>
          <ul className="text-[11px] text-ink-500 mt-3 space-y-1">
            <li>✓ .csv</li>
            <li>✓ .xlsx</li>
            <li>✓ .xls</li>
          </ul>
          <button
            type="button"
            className="mt-4 w-full bg-violet-500 hover:bg-violet-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Selecionar planilha
          </button>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex flex-col">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 grid place-items-center mb-4">
            <Edit3 className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="font-bold text-lg text-ink-100 mt-3">Entrada manual</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            Adicione qualquer métrica de qualquer artista em menos de 30 segundos
          </p>
          <ul className="text-[11px] text-ink-500 mt-3 space-y-1">
            <li>✓ Rápido</li>
            <li>✓ Histórico</li>
            <li>✓ Auditável</li>
          </ul>
          <button
            type="button"
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-bg-950 font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Adicionar dado manual
          </button>
        </div>
      </div>

      <div className="border-2 border-dashed border-bg-700/60 rounded-xl p-12 text-center bg-bg-900/30 hover:bg-bg-900/50 transition-colors cursor-pointer">
        <UploadCloud className="w-12 h-12 text-ink-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-ink-100">Arraste arquivos aqui</h3>
        <p className="text-sm text-ink-400 mt-1">ou clique pra navegar nos arquivos</p>
        <p className="text-[11px] text-ink-500 mt-3 num">
          Tamanho máximo: 500MB · Formatos aceitos: ZIP, XML, CSV, XLSX
        </p>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
          <h3 className="font-bold text-ink-100">Importações recentes</h3>
          <a href="#" className="text-violet-400 hover:text-violet-300 text-sm transition-colors">
            Ver todas →
          </a>
        </div>

        <div className="divide-y divide-bg-700/30">
          {importacoes.map((imp) => (
            <div
              key={imp.id}
              className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-lg grid place-items-center shrink-0',
                  imp.tipo === 'ddex'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-violet-500/15 text-violet-400'
                )}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-ink-100">{imp.nome}</span>
                  <span
                    className={cn(
                      'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded',
                      statusBadgeMap[imp.status]
                    )}
                  >
                    {imp.status}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 num mt-0.5">
                  {imp.tamanho} · {imp.detalhes} · {imp.data}
                </div>
              </div>
              <div className="text-[11px] text-ink-500 num shrink-0">{imp.ha}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

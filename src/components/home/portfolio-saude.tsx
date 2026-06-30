import type { FaixaSaude, ResumoSaude, SaudeBreakdown } from '@/lib/health/score'
import { cn, getHealthColor } from '@/lib/utils'

/** Faixas na ordem "pior → melhor" pra leitura da esquerda pra direita. */
const FAIXAS: { key: FaixaSaude; label: string; barra: string; texto: string; ponto: string }[] = [
  { key: 'critico', label: 'Crítico', barra: 'bg-red-500', texto: 'text-red-400', ponto: 'bg-red-500' },
  { key: 'atencao', label: 'Atenção', barra: 'bg-amber-500', texto: 'text-amber-400', ponto: 'bg-amber-500' },
  { key: 'saudavel', label: 'Saudável', barra: 'bg-violet-500', texto: 'text-violet-400', ponto: 'bg-violet-500' },
  { key: 'excelente', label: 'Excelente', barra: 'bg-emerald-500', texto: 'text-emerald-400', ponto: 'bg-emerald-500' },
]

const PILARES: { key: keyof SaudeBreakdown; label: string; barra: string }[] = [
  { key: 'audiencia', label: 'Audiência', barra: 'bg-violet-500' },
  { key: 'crescimento', label: 'Crescimento', barra: 'bg-emerald-500' },
  { key: 'engajamento', label: 'Engajamento', barra: 'bg-fuchsia-500' },
  { key: 'conteudo', label: 'Conteúdo', barra: 'bg-amber-500' },
  // "Carreira & Negócio" no contrato; medido hoje pelo streaming/consumo real (OneRPM).
  { key: 'streaming', label: 'Carreira & Negócio', barra: 'bg-cyan-500' },
]

export function PortfolioSaude({ resumo }: { resumo: ResumoSaude }) {
  const { media, avaliados, distribuicao, breakdownMedio } = resumo

  if (avaliados === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-ink-300 font-medium">Sem dados de saúde ainda</p>
        <p className="text-[13px] text-ink-500 mt-1 max-w-sm mx-auto">
          Assim que as sincronizações de YouTube e Instagram rodarem, o score de cada artista aparece aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
      {/* Média grande */}
      <div className="text-center md:pr-6 md:border-r border-bg-700/40">
        <div className={cn('num text-5xl font-bold leading-none', getHealthColor(media))}>{media}</div>
        <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase mt-1">de 100</div>
        <div className="text-[12px] text-ink-400 mt-2">
          <span className="num text-ink-200">{avaliados}</span> avaliados
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        {/* Distribuição por faixa */}
        <div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-bg-800">
            {FAIXAS.map((f) => {
              const n = distribuicao[f.key]
              if (n === 0) return null
              return (
                <div
                  key={f.key}
                  className={f.barra}
                  style={{ width: `${(n / avaliados) * 100}%` }}
                  title={`${f.label}: ${n}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {FAIXAS.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-400">
                <span className={cn('w-2 h-2 rounded-full', f.ponto)} />
                {f.label}
                <span className={cn('num font-semibold', f.texto)}>{distribuicao[f.key]}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Composição média do score */}
        <div>
          <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase mb-2">
            Composição do score
          </div>
          <div className="space-y-2">
            {PILARES.map((p) => {
              const v = breakdownMedio[p.key]
              return (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="text-[12px] text-ink-300 w-32 shrink-0">{p.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden">
                    {v != null && (
                      <div className={cn('h-full rounded-full', p.barra)} style={{ width: `${v}%` }} />
                    )}
                  </div>
                  <span className="num text-[12px] font-semibold text-ink-200 w-7 text-right shrink-0">
                    {v ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

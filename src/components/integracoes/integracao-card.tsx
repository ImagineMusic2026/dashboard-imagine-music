import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { IntegracaoSocial } from '@/lib/mock-data/integracoes'
import { cn } from '@/lib/utils'

type IntegracaoCardProps = {
  integracao: IntegracaoSocial
  icone: ReactNode
  corIcone: string
}

const badgeColorMap = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
} as const

export function IntegracaoCard({ integracao, icone, corIcone }: IntegracaoCardProps) {
  const isComplemento = integracao.isComplemento === true
  const isParcial = integracao.status === 'parcial'

  const ativasCor = isParcial ? 'text-amber-400' : 'text-emerald-400'
  const barCor = isParcial
    ? 'from-amber-500 to-amber-300'
    : 'from-emerald-500 to-emerald-300'

  const auth = integracao.contasAutorizadas
  const pct = auth.total > 0 ? (auth.ativas / auth.total) * 100 : 0
  const badgeClasses =
    integracao.badgeColor && badgeColorMap[integracao.badgeColor]
      ? badgeColorMap[integracao.badgeColor]
      : badgeColorMap.emerald

  return (
    <div
      className={cn(
        'bg-bg-900 border rounded-xl overflow-hidden flex flex-col',
        isParcial ? 'border-amber-500/30' : 'border-bg-700/40'
      )}
    >
      <div className="p-5 flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl grid place-items-center shrink-0 text-white',
            corIcone
          )}
        >
          <span className="block w-6 h-6">{icone}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-ink-100 leading-none">
              {integracao.nome}
            </span>
            {integracao.badge && (
              <span
                className={cn(
                  'text-[10px] tracking-wider font-bold px-1.5 py-0.5 rounded border',
                  badgeClasses
                )}
              >
                {integracao.badge}
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-1',
              isComplemento ? 'text-[13px] text-ink-300 leading-snug' : 'text-[12px] text-ink-400'
            )}
          >
            {integracao.descricao}
          </p>
        </div>
      </div>

      {!isComplemento ? (
        <div className="px-5 pb-4 flex-1">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-ink-400">Contas autorizadas</span>
            <span className="num font-semibold text-ink-300">
              <span className={ativasCor}>{auth.ativas}</span>
              <span className="text-ink-500">/{auth.total}</span>
            </span>
          </div>
          <div className="h-2 bg-bg-700 rounded-full overflow-hidden mb-3">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r', barCor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="text-center">
              <div className={cn('num font-bold text-base', ativasCor)}>{auth.ativas}</div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">ativas</div>
            </div>
            <div className="text-center">
              <div className="num font-bold text-base text-amber-400">{auth.pendentes}</div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">pendentes</div>
            </div>
            <div className="text-center">
              <div className="num font-bold text-base text-ink-400">
                {auth.recusaram ?? auth.semConta ?? 0}
              </div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">
                {auth.recusaram !== undefined
                  ? 'recusaram'
                  : auth.semConta !== undefined
                  ? 'sem página'
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-4 flex-1">
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="bg-bg-950/50 rounded-lg p-2 text-center">
              <div className="num font-bold text-base text-emerald-400">{auth.ativas}</div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider mt-0.5">
                conectadas
              </div>
            </div>
            <div className="bg-bg-950/50 rounded-lg p-2 text-center">
              <div className="num font-bold text-base text-ink-200">{integracao.frequencia}</div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider mt-0.5">
                frequência
              </div>
            </div>
            <div className="bg-bg-950/50 rounded-lg p-2 text-center">
              <div className="num font-bold text-base text-ink-200">há {integracao.ultimaSinc}</div>
              <div className="text-[10px] text-ink-500 uppercase tracking-wider mt-0.5">
                última coleta
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-bg-700/40 bg-bg-950/30 flex items-center justify-between text-[11px]">
        {isComplemento ? (
          <span className="italic text-ink-500">{integracao.notaComplemento}</span>
        ) : integracao.alerta ? (
          <span className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {integracao.alerta}
          </span>
        ) : (
          <span className="text-ink-500 num">
            a cada {integracao.frequencia} · há {integracao.ultimaSinc}
          </span>
        )}
        <button
          type="button"
          className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
        >
          Gerenciar →
        </button>
      </div>
    </div>
  )
}

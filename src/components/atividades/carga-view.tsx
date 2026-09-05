'use client'

import { useMemo } from 'react'
import { CalendarClock, TriangleAlert } from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { type Atividade } from '@/lib/atividades/client'
import { dataCurta } from '@/lib/atividades/cronograma'
import { calcularCarga, tempoPorEtapa } from '@/lib/atividades/metricas'
import { cor, esforcoMeta, etapaDe } from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

/**
 * A carga do time: quem está com o quê, e quanto.
 *
 * A régua é PONTOS de esforço, não número de cards — três demandas não dizem
 * nada quando uma delas é um clipe inteiro. A barra de cada pessoa é relativa à
 * maior carga do time, então ela responde "quem está mais cheio", que é a
 * pergunta real; um número absoluto de pontos não significaria nada sozinho.
 *
 * Embaixo entra o tempo médio por etapa — o "onde o calendário some", que sai
 * dos carimbos que cada movimentação de card deixa.
 */
export function CargaView({ onAbrir }: { onAbrir: (a: Atividade) => void }) {
  const { config, visiveis, equipe, atrasada } = useQuadro()

  const carga = useMemo(
    () =>
      calcularCarga(
        visiveis,
        config,
        equipe.map((u) => ({ uid: u.uid, nome: u.nome || u.email })),
      ),
    [visiveis, config, equipe],
  )

  const tempos = useMemo(() => tempoPorEtapa(visiveis, config), [visiveis, config])
  const maiorCarga = Math.max(1, ...carga.map((p) => p.pontos))

  /**
   * A partir de quantos pontos a barra fica vermelha.
   *
   * Antes era "85% do maior", o que pintava de vermelho quem estivesse no topo
   * SEMPRE — inclusive a única pessoa com trabalho num time em que os demais
   * estão zerados. Vermelho vira decoração assim. Agora é desequilíbrio de
   * verdade: metade acima da média de quem tem carga, e só quando há mais de uma
   * pessoa para comparar.
   */
  const comCarga = carga.filter((p) => p.uid !== '__sem__' && p.pontos > 0)
  const media = comCarga.length
    ? comCarga.reduce((t, p) => t + p.pontos, 0) / comCarga.length
    : 0
  const limiteVermelho = comCarga.length > 1 ? media * 1.5 : Infinity

  if (!carga.length) {
    return <p className="text-sm text-ink-500 text-center py-16">Nada em aberto no momento.</p>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {carga.map((p) => (
          <section key={p.uid} className="bg-bg-900/40 border border-bg-700/40 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span
                className="w-8 h-8 rounded-full bg-bg-700 grid place-items-center text-[11px] font-bold text-ink-200 shrink-0"
                aria-hidden
              >
                {p.uid === '__sem__'
                  ? '?'
                  : p.nome
                      .split(' ')
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join('')
                      .toUpperCase()}
              </span>
              <div className="min-w-0">
                <h3
                  className={cn(
                    'text-sm font-bold truncate',
                    p.uid === '__sem__' ? 'text-amber-300' : 'text-ink-100',
                  )}
                >
                  {p.nome}
                </h3>
                <p className="text-[11px] text-ink-500">
                  <span className="num">{p.emAberto}</span> em aberto ·{' '}
                  <span className="num">{p.nasProximasSemanas}</span> nas próximas 2 semanas
                  {p.atrasadas > 0 && (
                    <span className="text-red-400 font-semibold"> · {p.atrasadas} atrasada{p.atrasadas === 1 ? '' : 's'}</span>
                  )}
                </p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <div className="text-lg font-bold text-ink-100 num leading-none">{p.pontos}</div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wider">pontos</div>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-bg-800 overflow-hidden mb-3">
              <div
                className={cn(
                  'h-full rounded-full',
                  p.uid === '__sem__'
                    ? 'bg-amber-500'
                    : p.pontos > limiteVermelho
                      ? 'bg-red-500'
                      : 'bg-violet-500',
                )}
                style={{ width: `${Math.round((p.pontos / maiorCarga) * 100)}%` }}
              />
            </div>

            <ul className="space-y-1">
              {p.demandas
                .slice()
                .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
                .slice(0, 6)
                .map((a) => {
                  const etapa = etapaDe(config, a.etapa)
                  return (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className={cn('w-1 h-1 rounded-full shrink-0', cor(etapa?.cor).bar)} aria-hidden />
                      <button
                        type="button"
                        onClick={() => onAbrir(a)}
                        className="text-[12px] text-ink-300 hover:text-violet-300 transition-colors truncate text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
                      >
                        {a.titulo}
                      </button>
                      {a.esforco && (
                        <span className="text-[9px] font-bold text-ink-600 num shrink-0">
                          {esforcoMeta[a.esforco].label}
                        </span>
                      )}
                      {a.prazo && (
                        <span
                          className={cn(
                            'ml-auto flex items-center gap-1 text-[10px] num shrink-0',
                            atrasada(a) ? 'text-red-400 font-semibold' : 'text-ink-600',
                          )}
                        >
                          <CalendarClock className="w-3 h-3" aria-hidden />
                          {dataCurta(a.prazo)}
                        </span>
                      )}
                    </li>
                  )
                })}
              {p.demandas.length > 6 && (
                <li className="text-[10px] text-ink-600 pl-3">
                  +{p.demandas.length - 6} demanda{p.demandas.length - 6 === 1 ? '' : 's'}
                </li>
              )}
            </ul>

            {p.uid === '__sem__' && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-400/90 mt-3 pt-3 border-t border-bg-700/30">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Demanda sem dono não entra na carga de ninguém — e é a que mais some.
              </p>
            )}
          </section>
        ))}
      </div>

      {tempos.length > 0 && (
        <section className="bg-bg-900/40 border border-bg-700/40 rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink-100 mb-1">Onde o tempo fica</h3>
          <p className="text-[11px] text-ink-500 mb-4">
            Média de dias que uma demanda passa em cada etapa, medida pelas movimentações do quadro.
          </p>
          <div className="space-y-2.5">
            {tempos.map((t) => {
              const maior = Math.max(...tempos.map((x) => x.mediaDias), 1)
              return (
                <div key={t.etapa} className="flex items-center gap-3">
                  <span className="text-[11px] text-ink-300 w-28 shrink-0 truncate">{t.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', cor(etapaDe(config, t.etapa)?.cor).bar)}
                      style={{ width: `${Math.round((t.mediaDias / maior) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] num text-ink-400 w-20 text-right shrink-0">
                    {t.mediaDias}d
                    <span className="text-ink-600"> · {t.amostra}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-ink-600 mt-3">
            O número após o ponto é o tamanho da amostra — média de uma demanda só não é média.
          </p>
        </section>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleDot } from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { deISO, hojeISO, paraISO, type Atividade } from '@/lib/atividades/client'
import { dataLonga } from '@/lib/atividades/cronograma'
import { cor, etapaDe } from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * O calendário: as entregas do mês.
 *
 * Aqui a demanda aparece pela data de ENTREGA, não pela janela inteira. É a
 * pergunta "o que vence nesta semana?", e espalhar cada demanda por todos os
 * dias entre início e prazo transformaria um mês normal num bloco sólido —
 * quem quer a janela inteira tem o cronograma ao lado.
 */
export function CalendarioView({ onAbrir }: { onAbrir: (a: Atividade) => void }) {
  const { config, visiveis, atrasada, concluida, filtrando } = useQuadro()
  const hoje = hojeISO()
  const [mesBase, setMesBase] = useState(() => hoje.slice(0, 7))

  const [ano, mes] = mesBase.split('-').map(Number)

  const semanas = useMemo(() => {
    const primeiro = new Date(ano, mes - 1, 1, 12)
    const ultimo = new Date(ano, mes, 0, 12)
    // O grid começa no domingo anterior ao dia 1 e termina no sábado seguinte ao
    // último dia — é o que dá as linhas completas de sete colunas.
    const inicio = new Date(primeiro)
    inicio.setDate(inicio.getDate() - inicio.getDay())
    const fim = new Date(ultimo)
    fim.setDate(fim.getDate() + (6 - fim.getDay()))

    const linhas: { iso: string; doMes: boolean }[][] = []
    const cursor = new Date(inicio)
    while (cursor <= fim) {
      const semana: { iso: string; doMes: boolean }[] = []
      for (let i = 0; i < 7; i++) {
        semana.push({ iso: paraISO(cursor), doMes: cursor.getMonth() === mes - 1 })
        cursor.setDate(cursor.getDate() + 1)
      }
      linhas.push(semana)
    }
    return linhas
  }, [ano, mes])

  const porDia = useMemo(() => {
    const m = new Map<string, Atividade[]>()
    for (const a of visiveis) {
      const dia = a.prazo ?? (a.marco ? a.inicio : null)
      if (!dia) continue
      const atual = m.get(dia) ?? []
      atual.push(a)
      m.set(dia, atual)
    }
    return m
  }, [visiveis])

  const semData = visiveis.filter((a) => !a.prazo && !(a.marco && a.inicio))

  function andar(passo: number) {
    const d = new Date(ano, mes - 1 + passo, 1, 12)
    setMesBase(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => andar(-1)}
          aria-label="Mês anterior"
          className="p-1.5 rounded-lg bg-bg-900 border border-bg-700/50 text-ink-400 hover:text-ink-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold text-ink-100 min-w-[160px] text-center">
          {MESES[mes - 1]} de {ano}
        </h2>
        <button
          type="button"
          onClick={() => andar(1)}
          aria-label="Próximo mês"
          className="p-1.5 rounded-lg bg-bg-900 border border-bg-700/50 text-ink-400 hover:text-ink-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setMesBase(hoje.slice(0, 7))}
          className="px-2.5 py-1.5 rounded-lg bg-bg-900 border border-bg-700/50 text-[11px] font-semibold text-ink-300 hover:text-ink-100 transition-colors"
        >
          Hoje
        </button>
        <p className="text-[11px] text-ink-600 ml-auto hidden sm:block">Pela data de entrega</p>
      </div>

      <div className="border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-bg-900 border-b border-bg-700/40">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500 text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {semanas.map((semana, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-bg-700/20 last:border-b-0">
            {semana.map(({ iso, doMes }) => {
              const doDia = porDia.get(iso) ?? []
              const ehHoje = iso === hoje
              const fds = [0, 6].includes(deISO(iso).getDay())
              return (
                <div
                  key={iso}
                  className={cn(
                    'min-h-[104px] p-1.5 border-r border-bg-700/20 last:border-r-0 space-y-1',
                    !doMes && 'bg-bg-950/40',
                    fds && doMes && 'bg-bg-950/20',
                  )}
                >
                  <div
                    className={cn(
                      'text-[10px] num font-semibold w-5 h-5 grid place-items-center rounded-full',
                      ehHoje
                        ? 'bg-violet-500 text-white'
                        : doMes
                          ? 'text-ink-400'
                          : 'text-ink-600',
                    )}
                  >
                    {Number(iso.split('-')[2])}
                  </div>

                  {doDia.slice(0, 3).map((a) => {
                    const etapa = etapaDe(config, a.etapa)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onAbrir(a)}
                        title={a.titulo}
                        // A data só existia visualmente, na célula em volta: para
                        // quem navega por leitor de tela, os botões do mês eram
                        // uma lista de títulos sem quando.
                        aria-label={`${a.titulo} — ${a.marco ? 'marco' : 'entrega'} em ${dataLonga(iso)}`}
                        className={cn(
                          'w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 transition-colors hover:brightness-125',
                          concluida(a)
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : atrasada(a)
                              ? 'bg-red-500/10 border-red-500/30 text-red-300'
                              : cor(etapa?.cor).chip,
                        )}
                      >
                        {a.marco && <CircleDot className="w-2.5 h-2.5 shrink-0 rotate-45" aria-hidden />}
                        <span className="truncate">{a.titulo}</span>
                      </button>
                    )
                  })}

                  {doDia.length > 3 && (
                    <p className="text-[9px] text-ink-500 px-1">+{doDia.length - 3} demandas</p>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {semData.length > 0 && (
        <p className="text-[11px] text-ink-600">
          {semData.length} demanda{semData.length === 1 ? '' : 's'} sem data de entrega — não
          aparece{semData.length === 1 ? '' : 'm'} no calendário.
        </p>
      )}
      {!visiveis.length && (
        <p className="text-sm text-ink-500 text-center py-6">
          {filtrando ? 'Nada com esses filtros.' : 'Nenhuma demanda ainda.'}
        </p>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { corAvatarDe, iniciaisDe } from '@/lib/artistas/client'
import {
  eventoTipoMeta,
  excluirEvento,
  listarEventos,
  type EventoAgenda,
  type EventoTipo,
} from '@/lib/agenda/client'
import { EventoDialog } from '@/components/agenda/evento-dialog'
import { cn } from '@/lib/utils'

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const PLURAL: Record<EventoTipo, string> = {
  release: 'Releases',
  show: 'Shows',
  contrato: 'Contratos',
  reuniao: 'Reuniões',
}

const JANELAS: { key: Janela; label: string; dias: number }[] = [
  { key: 'mes', label: 'Mês', dias: 30 },
  { key: 'trimestre', label: 'Trimestre', dias: 92 },
  { key: 'ano', label: 'Ano', dias: 365 },
]

type Janela = 'mes' | 'trimestre' | 'ano'
type DialogState = null | { modo: 'novo' } | { modo: 'editar'; evento: EventoAgenda }

/** Data local de hoje em 'YYYY-MM-DD' (sem conversão de fuso). */
function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseData(iso: string): { dia: number; mes: string } {
  const [, m, dd] = iso.split('-')
  return { dia: Number(dd), mes: MESES[Number(m) - 1] ?? '' }
}

export function AgendaView() {
  const { user } = useAuth()
  const [eventos, setEventos] = useState<EventoAgenda[] | null>(null)
  const [erro, setErro] = useState(false)
  const [janela, setJanela] = useState<Janela>('mes')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setEventos(await listarEventos())
    } catch {
      setErro(true)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const dias = JANELAS.find((j) => j.key === janela)!.dias
  const { lista, contagem } = useMemo(() => {
    const hoje = hojeISO()
    const fim = addDias(hoje, dias)
    const lista = (eventos ?? []).filter((e) => e.data >= hoje && e.data <= fim)
    const contagem: Record<EventoTipo, number> = { release: 0, show: 0, contrato: 0, reuniao: 0 }
    for (const e of lista) contagem[e.tipo]++
    return { lista, contagem }
  }, [eventos, dias])

  async function remover(id: string) {
    setExcluindo(id)
    try {
      await excluirEvento(id)
    } catch {
      /* recarrega de qualquer forma abaixo */
    } finally {
      await carregar()
      setExcluindo(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Agenda</h1>
          <p className="text-sm text-ink-400 mt-1">Releases, shows, contratos e reuniões do portfólio</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-bg-800 rounded-lg p-1">
            {JANELAS.map((j) => (
              <button
                key={j.key}
                type="button"
                onClick={() => setJanela(j.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  janela === j.key ? 'bg-violet-500/20 text-violet-300' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {j.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDialog({ modo: 'novo' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo evento
          </button>
        </div>
      </div>

      {erro ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            Não consegui carregar a agenda. Confirme que as regras do Firestore estão deployadas.
          </div>
        </div>
      ) : eventos === null ? (
        <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando agenda…
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
              <div>
                <div className="font-bold text-ink-100">Próximos eventos</div>
                <div className="text-[12px] text-ink-500">
                  {janela === 'mes'
                    ? 'Próximos 30 dias'
                    : janela === 'trimestre'
                      ? 'Próximos 3 meses'
                      : 'Próximo ano'}
                </div>
              </div>
              <span className="text-[10px] num bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded font-semibold">
                {lista.length} evento{lista.length === 1 ? '' : 's'}
              </span>
            </div>

            {lista.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-500">
                Nenhum evento nesse período. Clique em{' '}
                <span className="text-violet-300">Novo evento</span> pra adicionar.
              </div>
            ) : (
              <div className="divide-y divide-bg-700/30">
                {lista.map((ev) => {
                  const tipo = eventoTipoMeta[ev.tipo]
                  const d = parseData(ev.data)
                  return (
                    <div
                      key={ev.id}
                      className="group flex items-start gap-4 p-4 hover:bg-bg-800/30 transition-colors relative pl-6"
                    >
                      <div className={cn('absolute left-0 top-0 bottom-0 w-1', tipo.bar)} />
                      <div className="w-12 text-center shrink-0">
                        <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">{d.mes}</div>
                        <div className="num text-2xl font-bold text-ink-100">{d.dia}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-[10px] tracking-wider font-bold uppercase', tipo.text)}>
                          {tipo.label}
                        </div>
                        <div className="font-semibold text-sm text-ink-100">{ev.titulo}</div>
                        {ev.descricao && <div className="text-[12px] text-ink-400">{ev.descricao}</div>}
                        {ev.artistaNome &&
                          (ev.artistaSlug ? (
                            <Link
                              href={`/artistas/${ev.artistaSlug}`}
                              className="text-[12px] text-violet-400 hover:text-violet-300 num"
                            >
                              {ev.artistaNome}
                            </Link>
                          ) : (
                            <span className="text-[12px] text-ink-500 num">{ev.artistaNome}</span>
                          ))}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-center">
                        {ev.artistaSlug && ev.artistaNome && (
                          <AvatarFallback
                            iniciais={iniciaisDe(ev.artistaNome)}
                            gradient={corAvatarDe(ev.artistaSlug)}
                            size="sm"
                          />
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setDialog({ modo: 'editar', evento: ev })}
                            aria-label="Editar evento"
                            className="p-1.5 rounded-md text-ink-400 hover:text-ink-100 hover:bg-bg-700/50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(ev.id)}
                            disabled={excluindo === ev.id}
                            aria-label="Excluir evento"
                            className="p-1.5 rounded-md text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            {excluindo === ev.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 h-fit">
            <div className="font-bold text-ink-100">Resumo do período</div>
            <div className="text-[12px] text-ink-500 mb-4">
              {JANELAS.find((j) => j.key === janela)!.label.toLowerCase()}
            </div>
            <div className="space-y-3">
              {(Object.keys(eventoTipoMeta) as EventoTipo[]).map((t) => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-300">
                    <span className={cn('w-2 h-2 rounded-full', eventoTipoMeta[t].bar)} />
                    {PLURAL[t]}
                  </span>
                  <span className="num font-semibold text-ink-100">{contagem[t]}</span>
                </div>
              ))}
            </div>
            <div className="my-4 h-px bg-bg-700/40" />
            <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase mb-1">Próximo</div>
            <div className="text-sm text-ink-200">
              {lista[0]
                ? `${parseData(lista[0].data).dia} ${parseData(lista[0].data).mes} · ${lista[0].titulo}`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <EventoDialog
          evento={dialog.modo === 'editar' ? dialog.evento : null}
          uid={user?.uid ?? ''}
          onClose={() => setDialog(null)}
          onSalvo={async () => {
            setDialog(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

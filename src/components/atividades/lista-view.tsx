'use client'

import { useMemo, useState } from 'react'
import { ArrowDownUp, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { type Atividade } from '@/lib/atividades/client'
import { dataCurta, duracaoEmDias, montarLinhas, type Agrupamento } from '@/lib/atividades/cronograma'
import {
  campoLigado,
  cor,
  etapaDe,
  prioridadeMeta,
  tipoDe,
  areaDe,
  esforcoMeta,
} from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

type Ordem = 'quadro' | 'prazo' | 'prioridade' | 'titulo' | 'progresso' | 'responsavel'

const ORDENS: { key: Ordem; label: string }[] = [
  { key: 'quadro', label: 'Ordem do quadro' },
  { key: 'prazo', label: 'Prazo' },
  { key: 'prioridade', label: 'Prioridade' },
  { key: 'progresso', label: 'Progresso' },
  { key: 'titulo', label: 'Título' },
  { key: 'responsavel', label: 'Responsável' },
]

/**
 * A lista: o mesmo dado do quadro numa tabela.
 *
 * Serve pra duas coisas que o kanban faz mal — ver muita demanda de uma vez e
 * ordenar por um critério (o que vence primeiro, o que está mais atrasado).
 *
 * Detalhe que vale explicar: ordenar DESLIGA a hierarquia. Uma tabela ordenada
 * por prazo com subtarefas indentadas seria uma mentira visual — a indentação
 * promete "esta linha pertence à de cima", e depois de ordenar a de cima é outra
 * qualquer. Na ordem do quadro, que é a natural, a árvore volta.
 */
export function ListaView({
  agrupamento,
  onAbrir,
}: {
  agrupamento: Agrupamento
  onAbrir: (a: Atividade) => void
}) {
  const { config, visiveis, todas, progresso, atrasada, concluida, mover, filtrando } = useQuadro()
  const [ordem, setOrdem] = useState<Ordem>('quadro')
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set())

  const linhas = useMemo(() => {
    if (ordem === 'quadro') return montarLinhas(visiveis, config, { agrupamento, recolhidos })

    const peso = (a: Atividade) => prioridadeMeta[a.prioridade]?.peso ?? 0
    const ordenadas = [...visiveis].sort((a, b) => {
      switch (ordem) {
        case 'prazo':
          // Sem prazo vai pro fim: a demanda sem data não disputa urgência com
          // quem tem uma marcada.
          return (a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31')
        case 'prioridade':
          return peso(b) - peso(a)
        case 'progresso':
          return progresso(a) - progresso(b)
        case 'responsavel':
          return (a.responsavelNome ?? 'zzz').localeCompare(b.responsavelNome ?? 'zzz', 'pt-BR')
        default:
          return a.titulo.localeCompare(b.titulo, 'pt-BR')
      }
    })
    return ordenadas.map((a) => ({
      tipo: 'demanda' as const,
      id: a.id,
      atividade: a,
      nivel: 0,
      temFilhos: false,
    }))
  }, [visiveis, config, agrupamento, recolhidos, ordem, progresso])

  function alternar(chave: string) {
    setRecolhidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  if (!visiveis.length) {
    return (
      <p className="text-sm text-ink-500 text-center py-16">
        {filtrando ? 'Nada com esses filtros.' : 'Nenhuma demanda ainda — crie a primeira.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="lista-ordem"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400"
        >
          <ArrowDownUp className="w-3.5 h-3.5" aria-hidden />
          Ordenar por
        </label>
        <select
          id="lista-ordem"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          className="bg-bg-900 border border-bg-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-ink-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        >
          {ORDENS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {ordem !== 'quadro' && (
          <span className="text-[11px] text-ink-600">
            Ordenado — subtarefas e agrupamento desligados
          </span>
        )}
      </div>

      <div className="overflow-x-auto border border-bg-700/40 rounded-xl">
        <table className="w-full text-sm min-w-[840px]">
          <thead>
            <tr className="bg-bg-900 border-b border-bg-700/40 text-left">
              <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                Demanda
              </th>
              <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 w-40">
                Etapa
              </th>
              {campoLigado(config, 'responsavel') && (
                <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 w-36">
                  Responsável
                </th>
              )}
              <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 w-40">
                Janela
              </th>
              <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 w-28">
                Progresso
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              if (linha.tipo === 'grupo') {
                const chave = `grupo:${linha.id}`
                const aberto = !recolhidos.has(chave)
                return (
                  <tr key={chave} className="bg-bg-800/40 border-b border-bg-700/30">
                    <td colSpan={5} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => alternar(chave)}
                        aria-expanded={aberto}
                        className="flex items-center gap-1.5 text-xs font-bold text-ink-200 hover:text-violet-300 transition-colors"
                      >
                        {aberto ? (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                        )}
                        {linha.rotulo || 'Sem grupo'}
                        <span className="text-[10px] font-semibold text-ink-500 num">
                          {linha.concluidas}/{linha.quantidade}
                        </span>
                      </button>
                    </td>
                  </tr>
                )
              }

              const a = linha.atividade
              const etapa = etapaDe(config, a.etapa)
              const feito = progresso(a)
              // Campo desligado na configuração some da Lista também: antes o
              // chip continuava aparecendo aqui, contradizendo o card e o
              // formulário, que já respeitavam a escolha.
              const tipo = campoLigado(config, 'tipo') ? tipoDe(config, a.tipo) : null
              const area = campoLigado(config, 'area') ? areaDe(config, a.area) : null

              return (
                <tr
                  key={a.id}
                  className="border-b border-bg-700/20 hover:bg-bg-800/30 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: linha.nivel * 16 }} aria-hidden />
                      {linha.temFilhos ? (
                        <button
                          type="button"
                          onClick={() => alternar(a.id)}
                          aria-expanded={!recolhidos.has(a.id)}
                          aria-label={
                            recolhidos.has(a.id)
                              ? `Mostrar subtarefas de "${a.titulo}"`
                              : `Ocultar subtarefas de "${a.titulo}"`
                          }
                          className="p-0.5 rounded text-ink-400 hover:text-violet-300 transition-colors shrink-0"
                        >
                          {recolhidos.has(a.id) ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onAbrir(a)}
                          className={cn(
                            'text-left text-[13px] hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded truncate block max-w-[380px]',
                            linha.temFilhos ? 'font-bold text-ink-100' : 'text-ink-200',
                            concluida(a) && 'text-ink-500 line-through decoration-ink-600',
                          )}
                        >
                          {a.titulo}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {campoLigado(config, 'artista') && a.artistaNome && (
                            <span className="text-[10px] text-ink-500 truncate">{a.artistaNome}</span>
                          )}
                          {tipo && (
                            <span className={cn('text-[9px] px-1 py-px rounded border', cor(tipo.cor).chip)}>
                              {tipo.label}
                            </span>
                          )}
                          {area && (
                            <span className={cn('text-[9px] px-1 py-px rounded border', cor(area.cor).chip)}>
                              {area.label}
                            </span>
                          )}
                          {a.prioridade !== 'baixa' && (
                            <span
                              className={cn(
                                'text-[9px] px-1 py-px rounded border',
                                prioridadeMeta[a.prioridade].chip,
                              )}
                            >
                              {prioridadeMeta[a.prioridade].label}
                            </span>
                          )}
                          {campoLigado(config, 'esforco') && a.esforco && (
                            <span className="text-[9px] font-bold text-ink-600 num">
                              {esforcoMeta[a.esforco].label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    {/* Trocar a etapa direto da tabela: na lista, mudar de coluna
                        é escolher um valor, não arrastar. */}
                    <select
                      value={a.etapa}
                      onChange={(e) => mover(a.id, e.target.value, null)}
                      aria-label={`Etapa de "${a.titulo}"`}
                      className={cn(
                        'bg-bg-900 border border-bg-700/50 rounded-md px-2 py-1 text-[11px] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20',
                        cor(etapa?.cor).text,
                      )}
                    >
                      {config.etapas.map((e) => (
                        <option key={e.key} value={e.key}>
                          {e.label}
                        </option>
                      ))}
                      {!etapa && <option value={a.etapa}>{a.etapa}</option>}
                    </select>
                  </td>

                  {campoLigado(config, 'responsavel') && (
                    <td className="px-3 py-2 text-[12px] text-ink-300 truncate">
                      {a.responsavelNome ?? <span className="text-ink-600 italic">A definir</span>}
                    </td>
                  )}

                  <td className="px-3 py-2">
                    {a.inicio || a.prazo ? (
                      <div className="text-[11px] num">
                        <span className={atrasada(a) ? 'text-red-400 font-semibold' : 'text-ink-300'}>
                          {a.inicio ? dataCurta(a.inicio) : '—'} → {a.prazo ? dataCurta(a.prazo) : '—'}
                        </span>
                        <span className="text-ink-600 block">
                          {a.marco
                            ? 'marco'
                            : `${duracaoEmDias(a)} ${duracaoEmDias(a) === 1 ? 'dia' : 'dias'}`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-600 italic">Sem datas</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-14 rounded-full bg-bg-800 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            feito === 100 ? 'bg-emerald-500' : 'bg-violet-500',
                          )}
                          style={{ width: `${feito}%` }}
                        />
                      </div>
                      <span className="text-[11px] num text-ink-400 w-8">{feito}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-600">
        {linhas.filter((l) => l.tipo === 'demanda').length} demandas
        {todas.length !== visiveis.length && ` de ${todas.length} no total`}
      </p>
    </div>
  )
}

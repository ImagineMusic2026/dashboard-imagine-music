'use client'

import { useMemo } from 'react'
import { CircleAlert, Clock, PackageCheck, Pause, TrendingUp, UserMinus } from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { calcularIndicadores } from '@/lib/atividades/metricas'
import { cn } from '@/lib/utils'

/**
 * A faixa de indicadores do quadro.
 *
 * Nenhum destes números custa uma leitura: todos saem da lista que o quadro já
 * carregou. E todos respeitam os filtros da tela — filtrar por um artista e ver
 * "12 entregues no mês" do selo inteiro seria pior do que não ter número nenhum.
 *
 * Cada peça é clicável e ACENDE um filtro. É o que transforma o indicador em
 * ponto de partida: ver "4 atrasadas" e cair direto nas quatro, em vez de
 * procurá-las no quadro.
 */
export function IndicadoresQuadro() {
  const { config, noEscopo, filtros, setFiltros } = useQuadro()
  // Calculado sobre o ESCOPO, não sobre o que está na tela: os indicadores
  // descrevem o recorte (este artista, esta área), e os dois filtros de fluxo
  // — "esconder concluídas" e "só atrasadas" — são maneiras de OLHAR esse
  // recorte. Usar a lista já filtrada por eles fazia clicar num indicador zerar
  // os vizinhos: esconder as concluídas apagava "entregues no mês" e o tempo
  // médio de entrega, que são justamente contas sobre demandas concluídas.
  const ind = useMemo(() => calcularIndicadores(noEscopo, config), [noEscopo, config])

  const pecas = [
    {
      chave: 'aberto',
      icone: TrendingUp,
      valor: String(ind.emAberto),
      rotulo: 'em aberto',
      detalhe: ind.progressoMedio > 0 ? `${ind.progressoMedio}% de progresso médio` : null,
      tom: 'neutro' as const,
      aoClicar: () =>
        setFiltros({ ...filtros, ocultarConcluidas: !filtros.ocultarConcluidas, somenteAtrasadas: false }),
      ativo: filtros.ocultarConcluidas,
    },
    {
      chave: 'atrasadas',
      icone: CircleAlert,
      valor: String(ind.atrasadas),
      rotulo: ind.atrasadas === 1 ? 'atrasada' : 'atrasadas',
      detalhe: null,
      tom: ind.atrasadas > 0 ? ('ruim' as const) : ('neutro' as const),
      aoClicar: () => setFiltros({ ...filtros, somenteAtrasadas: !filtros.somenteAtrasadas }),
      ativo: filtros.somenteAtrasadas,
    },
    {
      chave: 'paradas',
      icone: Pause,
      valor: String(ind.paradas),
      rotulo: ind.paradas === 1 ? 'parada há 7d+' : 'paradas há 7d+',
      detalhe: null,
      tom: ind.paradas > 0 ? ('atencao' as const) : ('neutro' as const),
      aoClicar: null,
      ativo: false,
    },
    {
      chave: 'semDono',
      icone: UserMinus,
      valor: String(ind.semResponsavel),
      rotulo: 'sem responsável',
      detalhe: null,
      tom: ind.semResponsavel > 0 ? ('atencao' as const) : ('neutro' as const),
      aoClicar: () =>
        setFiltros({ ...filtros, responsavel: filtros.responsavel === '__sem__' ? '' : '__sem__' }),
      ativo: filtros.responsavel === '__sem__',
    },
    {
      chave: 'entregues',
      icone: PackageCheck,
      valor: String(ind.entreguesNoMes),
      rotulo: 'entregues no mês',
      detalhe: null,
      tom: 'bom' as const,
      aoClicar: null,
      ativo: false,
    },
    {
      chave: 'tempo',
      icone: Clock,
      valor: ind.tempoMedioEntrega === null ? '—' : `${ind.tempoMedioEntrega}d`,
      rotulo: 'do início à entrega',
      // Sem amostra o traço é honesto: nada de "0 dias", que pareceria
      // instantâneo em vez de desconhecido.
      detalhe: ind.gargalo
        ? `Gargalo: ${ind.gargalo.label} (${ind.gargalo.quantidade})`
        : null,
      tom: 'neutro' as const,
      aoClicar: null,
      ativo: false,
    },
  ]

  const tomClasse = {
    neutro: 'text-ink-100',
    bom: 'text-emerald-400',
    atencao: 'text-amber-400',
    ruim: 'text-red-400',
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {pecas.map((p) => {
        const Icone = p.icone
        {/* Layout HORIZONTAL: rótulo (e o detalhe, quando existe) à esquerda, o
            número à direita, os dois centrados na vertical.
            O bloco é largo e baixo — proporção de mais de 3:1 —, então empilhar
            tudo no meio deixava o conteúdo boiando com margens enormes dos dois
            lados. Aqui a largura vira o próprio eixo da leitura, e o número
            continua alinhado entre os blocos porque o `items-center` o centra na
            altura, tenha o bloco linha de detalhe ou não. */}
        const conteudo = (
          <>
            <div className="flex flex-col min-w-0 gap-1">
              <div className="flex items-start gap-1.5 min-w-0">
                <Icone className="w-3.5 h-3.5 text-ink-500 shrink-0 mt-px" aria-hidden />
                {/* Quebra em duas linhas em vez de truncar: com seis blocos numa
                    tela média o rótulo não cabe, e "SEM RESPONS…" esconde
                    justamente a palavra que dá sentido ao número. A altura
                    igual entre os blocos vem do grid, e o número segue centrado
                    pelo `items-center` do bloco. */}
                <span className="text-[10px] uppercase tracking-wider text-ink-500 leading-tight">
                  {p.rotulo}
                </span>
              </div>
              {p.detalhe && (
                <div className="text-[10px] text-ink-600 leading-none truncate">{p.detalhe}</div>
              )}
            </div>
            <div
              className={cn('text-3xl font-bold num leading-none shrink-0', tomClasse[p.tom])}
            >
              {p.valor}
            </div>
          </>
        )

        const base = cn(
          'min-h-[72px] bg-bg-900/50 border rounded-xl px-4 py-3 transition-colors flex items-center justify-between gap-3 text-left',
          p.ativo ? 'border-violet-500/50 bg-violet-500/5' : 'border-bg-700/40',
        )

        return p.aoClicar ? (
          <button
            key={p.chave}
            type="button"
            onClick={p.aoClicar}
            aria-pressed={p.ativo}
            className={cn(base, 'hover:border-bg-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40')}
          >
            {conteudo}
          </button>
        ) : (
          <div key={p.chave} className={base}>
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}

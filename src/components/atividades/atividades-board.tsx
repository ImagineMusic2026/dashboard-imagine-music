'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarDays,
  GanttChartSquare,
  List,
  Loader2,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  SquareKanban,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AtividadeDetalhe } from '@/components/atividades/atividade-detalhe'
import { AtividadeDialog } from '@/components/atividades/atividade-dialog'
import { CalendarioView } from '@/components/atividades/calendario-view'
import { CargaView } from '@/components/atividades/carga-view'
import { CronogramaView } from '@/components/atividades/cronograma-view'
import { IndicadoresQuadro } from '@/components/atividades/indicadores-quadro'
import { ListaView } from '@/components/atividades/lista-view'
import { QuadroProvider, useQuadro } from '@/components/atividades/quadro-contexto'
import { QuadroView } from '@/components/atividades/quadro-view'
import { type Atividade } from '@/lib/atividades/client'
import { agrupamentoMeta, AGRUPAMENTOS, type Agrupamento } from '@/lib/atividades/cronograma'
import {
  campoLigado,
  PRIORIDADES,
  prioridadeMeta,
  visaoMeta,
  type Visao,
} from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

const seletor =
  'bg-bg-900 border border-bg-700/50 rounded-lg px-3 py-2 text-xs text-ink-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

const iconeDaVisao: Record<Visao, typeof SquareKanban> = {
  quadro: SquareKanban,
  cronograma: GanttChartSquare,
  lista: List,
  calendario: CalendarDays,
  carga: Users,
}

/** Visões em que agrupar muda alguma coisa. */
const ACEITAM_AGRUPAMENTO: Visao[] = ['quadro', 'cronograma', 'lista']

type Dialogo = null | { modo: 'novo'; etapa: string } | { modo: 'editar'; atividade: Atividade }

export function AtividadesBoard() {
  return (
    <QuadroProvider>
      <QuadroTela />
    </QuadroProvider>
  )
}

/**
 * A casca do quadro: cabeçalho, indicadores, filtros e a visão escolhida.
 *
 * As cinco visões dividem o MESMO carregamento (ver `quadro-contexto`), então
 * trocar de aba não custa nenhuma leitura — é o que permite oferecer cinco
 * leituras do mesmo dado num painel que roda na cota gratuita do Firestore.
 */
function QuadroTela() {
  const { role } = useAuth()
  const {
    config,
    carregandoConfig,
    carregando,
    erro,
    artistas,
    equipe,
    filtros,
    setFiltros,
    filtrando,
    limparFiltros,
    etiquetasConhecidas,
    todas,
  } = useQuadro()

  const [visao, setVisao] = useState<Visao | null>(null)
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum')
  const [maisFiltros, setMaisFiltros] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  // A visão inicial vem da configuração, mas só na primeira vez que ela chega —
  // depois disso quem manda é a escolha da pessoa nesta sessão. O `carregandoConfig`
  // é o que faz a configuração ser respeitada: sem ele, o efeito rodava no
  // primeiro render (quando o contexto ainda devolve o padrão de fábrica),
  // travava a visão em "quadro" e a escolha do admin nunca chegava a valer.
  useEffect(() => {
    if (carregandoConfig) return
    setVisao((atual) => atual ?? config.visaoPadrao)
  }, [carregandoConfig, config.visaoPadrao])

  const visaoAtiva: Visao = visao && config.visoes.includes(visao) ? visao : config.visoes[0]

  /**
   * Agrupar por um campo que a configuração desligou não faria sentido: a opção
   * existiria no seletor e produziria um quadro inteiro dentro de "Sem tipo".
   */
  const agrupamentosDisponiveis = AGRUPAMENTOS.filter((g) => {
    if (g === 'artista') return campoLigado(config, 'artista')
    if (g === 'responsavel') return campoLigado(config, 'responsavel')
    if (g === 'area') return campoLigado(config, 'area')
    if (g === 'tipo') return campoLigado(config, 'tipo')
    return true
  })

  // Se o campo do agrupamento em uso for desligado, volta para "sem agrupar" em
  // vez de deixar a tela num modo que o seletor não oferece mais.
  const agrupamentoAtivo = agrupamentosDisponiveis.includes(agrupamento) ? agrupamento : 'nenhum'
  const detalhe = detalheId ? todas.find((a) => a.id === detalheId) : null

  // A demanda aberta pode sumir (excluída aqui ou por outra pessoa) — sem isto o
  // painel de detalhe ficaria preso mostrando um card que não existe mais.
  useEffect(() => {
    if (detalheId && !todas.some((a) => a.id === detalheId)) setDetalheId(null)
  }, [todas, detalheId])

  /** Setas andam entre as abas, Home/End vão às pontas — padrão de tablist. */
  function aoNavegarAbas(e: React.KeyboardEvent, atual: Visao) {
    const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!teclas.includes(e.key)) return
    e.preventDefault()
    const i = config.visoes.indexOf(atual)
    const destino =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? config.visoes.length - 1
          : (i + (e.key === 'ArrowRight' ? 1 : -1) + config.visoes.length) % config.visoes.length
    const proxima = config.visoes[destino]
    setVisao(proxima)
    document.getElementById(`aba-${proxima}`)?.focus()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Atividades</h1>
          <p className="text-sm text-ink-400 mt-1">
            O fluxo de atendimento do começo ao fim, o cronograma de cada projeto e quem está com
            cada demanda
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {role === 'admin' && (
            <Link
              href="/configuracoes?aba=quadro"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-900 border border-bg-700/50 text-ink-300 hover:text-ink-100 text-sm font-semibold transition-colors"
            >
              <Settings2 className="w-4 h-4" aria-hidden />
              <span className="hidden sm:inline">Configurar quadro</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDialogo({ modo: 'novo', etapa: config.etapas[0]?.key ?? 'solicitado' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Nova demanda
          </button>
        </div>
      </div>

      <IndicadoresQuadro />

      {/* Visões ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-0.5 bg-bg-900 border border-bg-700/50 rounded-lg p-0.5 overflow-x-auto"
          role="tablist"
          aria-label="Visão do quadro"
        >
          {config.visoes.map((v) => {
            const Icone = iconeDaVisao[v]
            const ativa = visaoAtiva === v
            return (
              <button
                key={v}
                type="button"
                role="tab"
                id={`aba-${v}`}
                aria-selected={ativa}
                aria-controls="painel-visao"
                // Numa lista de abas, só a selecionada entra na ordem de
                // tabulação; entre elas se anda com as setas. Sem isto o Tab
                // pisava nas cinco antes de chegar ao conteúdo.
                tabIndex={ativa ? 0 : -1}
                onKeyDown={(e) => aoNavegarAbas(e, v)}
                onClick={() => setVisao(v)}
                title={visaoMeta[v].descricao}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap',
                  ativa ? 'bg-violet-500/15 text-violet-300' : 'text-ink-400 hover:text-ink-200',
                )}
              >
                <Icone className="w-3.5 h-3.5" aria-hidden />
                {visaoMeta[v].label}
              </button>
            )
          })}
        </div>

        {ACEITAM_AGRUPAMENTO.includes(visaoAtiva) && (
          <select
            value={agrupamentoAtivo}
            onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}
            aria-label="Agrupar demandas"
            className={seletor}
          >
            {agrupamentosDisponiveis.map((g) => (
              <option key={g} value={g}>
                {agrupamentoMeta[g]}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            placeholder="Buscar demanda…"
            aria-label="Buscar demanda"
            className={cn(seletor, 'pl-8 w-44')}
          />
        </div>

        <button
          type="button"
          onClick={() => setMaisFiltros((v) => !v)}
          aria-expanded={maisFiltros}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
            maisFiltros || filtrando
              ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
              : 'bg-bg-900 border-bg-700/50 text-ink-400 hover:text-ink-200',
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
          Filtros
        </button>

        {filtrando && (
          <button
            type="button"
            onClick={limparFiltros}
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 px-2 py-2 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Limpar
          </button>
        )}
      </div>

      {maisFiltros && (
        <div className="flex flex-wrap items-center gap-2 bg-bg-900/40 border border-bg-700/30 rounded-xl p-3">
          {campoLigado(config, 'artista') && (
            <select
              value={filtros.artista}
              onChange={(e) => setFiltros({ ...filtros, artista: e.target.value })}
              aria-label="Filtrar por artista"
              className={seletor}
            >
              <option value="">Todos os artistas</option>
              {artistas.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.nome}
                </option>
              ))}
            </select>
          )}

          {/* O colaborador só vê as demandas dele: filtrar por responsável não
              recortaria nada. */}
          {campoLigado(config, 'responsavel') && role !== 'colaborador' && (
            <select
              value={filtros.responsavel}
              onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
              aria-label="Filtrar por responsável"
              className={seletor}
            >
              <option value="">Todos os responsáveis</option>
              <option value="__sem__">Sem responsável</option>
              {equipe.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.nome || u.email}
                </option>
              ))}
            </select>
          )}

          {campoLigado(config, 'area') && !!config.areas.length && (
            <select
              value={filtros.area}
              onChange={(e) => setFiltros({ ...filtros, area: e.target.value })}
              aria-label="Filtrar por área"
              className={seletor}
            >
              <option value="">Todas as áreas</option>
              {config.areas.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          )}

          {campoLigado(config, 'tipo') && !!config.tipos.length && (
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              aria-label="Filtrar por tipo"
              className={seletor}
            >
              <option value="">Todos os tipos</option>
              {config.tipos.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          <select
            value={filtros.prioridade}
            onChange={(e) =>
              setFiltros({ ...filtros, prioridade: e.target.value as typeof filtros.prioridade })
            }
            aria-label="Filtrar por prioridade"
            className={seletor}
          >
            <option value="">Toda prioridade</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {prioridadeMeta[p].label}
              </option>
            ))}
          </select>

          {campoLigado(config, 'etiquetas') && !!etiquetasConhecidas.length && (
            <select
              value={filtros.etiqueta}
              onChange={(e) => setFiltros({ ...filtros, etiqueta: e.target.value })}
              aria-label="Filtrar por etiqueta"
              className={seletor}
            >
              <option value="">Todas as etiquetas</option>
              {etiquetasConhecidas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-1.5 text-xs text-ink-300 px-2">
            <input
              type="checkbox"
              checked={filtros.ocultarConcluidas}
              onChange={(e) => setFiltros({ ...filtros, ocultarConcluidas: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-violet-500"
            />
            Esconder concluídas
          </label>

          <label className="flex items-center gap-1.5 text-xs text-ink-300 px-2">
            <input
              type="checkbox"
              checked={filtros.somenteAtrasadas}
              onChange={(e) => setFiltros({ ...filtros, somenteAtrasadas: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-violet-500"
            />
            Só atrasadas
          </label>
        </div>
      )}

      {erro && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-amber-200/90">{erro}</div>
        </div>
      )}

      <div
        id="painel-visao"
        role="tabpanel"
        aria-labelledby={`aba-${visaoAtiva}`}
        tabIndex={-1}
      >
      {carregando ? (
        // Com erro, quem explica é o aviso acima — repetir "carregando" aqui
        // deixaria um spinner eterno na tela.
        erro ? null : (
          <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando quadro…
          </div>
        )
      ) : (
        <>
          {visaoAtiva === 'quadro' && (
            <QuadroView
              agrupamento={agrupamentoAtivo}
              onAbrir={(a) => setDetalheId(a.id)}
              onNovo={(etapa) => setDialogo({ modo: 'novo', etapa })}
            />
          )}
          {visaoAtiva === 'cronograma' && (
            <CronogramaView agrupamento={agrupamentoAtivo} onAbrir={(a) => setDetalheId(a.id)} />
          )}
          {visaoAtiva === 'lista' && (
            <ListaView agrupamento={agrupamentoAtivo} onAbrir={(a) => setDetalheId(a.id)} />
          )}
          {visaoAtiva === 'calendario' && <CalendarioView onAbrir={(a) => setDetalheId(a.id)} />}
          {visaoAtiva === 'carga' && <CargaView onAbrir={(a) => setDetalheId(a.id)} />}
        </>
      )}
      </div>

      {detalhe && (
        <AtividadeDetalhe
          atividade={detalhe}
          bloqueado={!!dialogo}
          onFechar={() => setDetalheId(null)}
          onEditar={() => setDialogo({ modo: 'editar', atividade: detalhe })}
        />
      )}

      {dialogo && (
        <AtividadeDialog
          atividade={dialogo.modo === 'editar' ? dialogo.atividade : null}
          etapaInicial={dialogo.modo === 'novo' ? dialogo.etapa : (config.etapas[0]?.key ?? '')}
          onFechar={() => setDialogo(null)}
          onSalvo={(id) => {
            setDialogo(null)
            // Criar uma demanda já abre o detalhe dela: quase sempre o próximo
            // passo é anexar o briefing ou destrinchar o checklist.
            if (dialogo.modo === 'novo') setDetalheId(id)
          }}
        />
      )}
    </div>
  )
}

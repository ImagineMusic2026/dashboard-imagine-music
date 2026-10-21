'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { listarArtistas } from '@/lib/artistas/client'
import { carregarConfig } from '@/lib/atividades/config'
import {
  concluida,
  diasNaEtapa,
  estaAtrasada,
  excluirAtividade,
  invalidarAtividades,
  listarArtistasDoColaborador,
  listarAtividades,
  listarResponsaveis,
  moverAtividade,
  ordemAoSoltar,
  progressoDe,
  reprogramar,
  salvarChecklist,
  transicao,
  type ArtistaOpcao,
  type Atividade,
  type ItemChecklist,
} from '@/lib/atividades/client'
import { CONFIG_PADRAO, type ConfigQuadro, type Prioridade } from '@/lib/atividades/tipos'
import { ehColaborador } from '@/lib/permissions'
import type { AppUser } from '@/lib/users'

/**
 * Estado compartilhado do quadro de atividades.
 *
 * Existe porque as cinco visões (quadro, cronograma, lista, calendário, carga)
 * são leituras DIFERENTES do mesmo dado: a mesma coleção, a mesma configuração,
 * os mesmos filtros. Sem um lugar comum, trocar de aba recarregaria tudo — e
 * cada recarga é uma varredura da coleção na cota gratuita do Firestore, a mesma
 * que já derrubou o painel uma vez.
 *
 * O contrato que todas as visões herdam daqui:
 *
 * 1. **Escrever é otimista e custa UM documento.** Arrastar um card entre
 *    colunas, arrastar uma barra no cronograma ou marcar um item do checklist
 *    mexem no estado local na hora, gravam só o documento afetado e NÃO releem a
 *    coleção. Se a escrita falhar, o quadro é recarregado e a pessoa é avisada —
 *    a tela nunca fica mentindo.
 * 2. **Filtro vale pra tudo.** `visiveis` é o recorte; `todas` é a lista
 *    completa, e só é usada onde o recorte daria resposta errada — progresso de
 *    uma mãe cujos filhos foram filtrados, por exemplo.
 */

export type FiltroResponsavel = string | '__sem__' | ''

export interface FiltrosQuadro {
  busca: string
  artista: string
  responsavel: FiltroResponsavel
  area: string
  tipo: string
  prioridade: Prioridade | ''
  etiqueta: string
  /** Só as atrasadas. */
  somenteAtrasadas: boolean
  /** Esconde o que já saiu do fluxo (colunas finais). */
  ocultarConcluidas: boolean
}

export const FILTROS_VAZIOS: FiltrosQuadro = {
  busca: '',
  artista: '',
  responsavel: '',
  area: '',
  tipo: '',
  prioridade: '',
  etiqueta: '',
  somenteAtrasadas: false,
  ocultarConcluidas: false,
}

interface QuadroCtx {
  config: ConfigQuadro
  carregandoConfig: boolean
  /** Todas as demandas, sem filtro — base de progresso e hierarquia. */
  todas: Atividade[]
  /** O recorte atual (todos os filtros). */
  visiveis: Atividade[]
  /**
   * O recorte SEM os filtros de fluxo (`ocultarConcluidas`/`somenteAtrasadas`).
   * É a base dos indicadores de entrega, que falam justamente das concluídas.
   */
  noEscopo: Atividade[]
  carregando: boolean
  erro: string | null
  artistas: ArtistaOpcao[]
  /** Quem pode ser responsável (para o colaborador, só ele mesmo). */
  equipe: AppUser[]
  filtros: FiltrosQuadro
  setFiltros: (f: FiltrosQuadro) => void
  filtrando: boolean
  limparFiltros: () => void
  /** Etiquetas em uso no quadro + as sugeridas na configuração. */
  etiquetasConhecidas: string[]
  progresso: (a: Atividade) => number
  atrasada: (a: Atividade) => boolean
  concluida: (a: Atividade) => boolean
  paradaHa: (a: Atividade) => number | null
  mover: (id: string, destino: string, alvoId: string | null) => Promise<void>
  reagendar: (id: string, inicio: string | null, prazo: string | null) => Promise<void>
  alternarItem: (id: string, itemId: string) => Promise<void>
  remover: (a: Atividade) => Promise<void>
  recarregar: () => Promise<void>
  /** Atualiza uma demanda no estado local (após salvar no formulário). */
  aplicarLocal: (a: Atividade) => void
  excluindo: string | null
  setErro: (e: string | null) => void
}

const Ctx = createContext<QuadroCtx | null>(null)

export function useQuadro(): QuadroCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useQuadro precisa estar dentro de <QuadroProvider>')
  return ctx
}

export function QuadroProvider({ children }: { children: ReactNode }) {
  const { user, appUser } = useAuth()
  // O colaborador enxerga só as demandas em que é o responsável (a regra do
  // Firestore recorta do mesmo jeito) e não lê o roster nem o time.
  const colaborador = ehColaborador(appUser?.role ?? null)
  const soDoResponsavel = colaborador ? (appUser?.uid ?? null) : null
  const [config, setConfig] = useState<ConfigQuadro | null>(null)
  const [todas, setTodas] = useState<Atividade[] | null>(null)
  const [artistas, setArtistas] = useState<ArtistaOpcao[]>([])
  const [equipe, setEquipe] = useState<AppUser[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltrosQuadro>(FILTROS_VAZIOS)

  const quem = appUser?.nome || appUser?.email || 'alguém da equipe'
  // A configuração nunca é `null` para quem consome: enquanto ela não chega (ou
  // se a leitura falhar), o quadro roda no padrão de fábrica. Uma tela em branco
  // esperando configuração seria pior que um quadro com as colunas de sempre.
  const configAtiva = config ?? CONFIG_PADRAO

  const carregar = useCallback(async () => {
    try {
      setTodas(await listarAtividades(soDoResponsavel))
      setErro(null)
    } catch {
      setErro(
        'Não consegui carregar o quadro. Confirme que as regras do Firestore estão publicadas.',
      )
    }
  }, [soDoResponsavel])

  useEffect(() => {
    carregar()
    carregarConfig()
      .then(setConfig)
      .catch(() => setConfig(CONFIG_PADRAO))
  }, [carregar])

  // Listas dos seletores. Para a equipe, o roster e quem pode receber demanda
  // (equipe + colaboradores). Para o colaborador, os artistas vêm do servidor
  // (só slug e nome) e o responsável é sempre ele.
  useEffect(() => {
    if (colaborador) {
      listarArtistasDoColaborador()
        .then(setArtistas)
        .catch(() => setArtistas([]))
      setEquipe(appUser ? [appUser] : [])
      return
    }
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
    listarResponsaveis()
      .then(setEquipe)
      .catch(() => setEquipe([]))
  }, [colaborador, appUser])

  /**
   * Relê as DEMANDAS. Não relê a configuração de propósito: ela só muda quando
   * um admin salva a tela de configuração, e aquela tela já invalida o cache por
   * conta própria. Reler as duas aqui somava uma leitura a cada operação que
   * pedia atualização — e este é o módulo que roda na cota gratuita.
   */
  const recarregar = useCallback(async () => {
    invalidarAtividades()
    await carregar()
  }, [carregar])

  const lista = useMemo(() => todas ?? [], [todas])

  /**
   * O recorte, em duas camadas.
   *
   * `escopo` são os filtros de CLASSIFICAÇÃO — artista, responsável, área, tipo,
   * prioridade, etiqueta, busca. Eles dizem "de que parte do quadro estamos
   * falando".
   *
   * `ocultarConcluidas` e `somenteAtrasadas` são de FLUXO: dizem "em que momento
   * do ciclo". Ficam de fora do escopo porque os indicadores de entrega
   * (entregues no mês, tempo do início à entrega) são calculados sobre demandas
   * CONCLUÍDAS — e usar o mesmo recorte para tudo fazia clicar em "em aberto"
   * zerar os dois vizinhos, como se o mês não tivesse tido entrega nenhuma.
   */
  const noEscopo = useCallback(
    (a: Atividade) => {
      const termo = filtros.busca.trim().toLowerCase()
      if (filtros.artista && a.artistaSlug !== filtros.artista) return false
      if (filtros.responsavel === '__sem__') {
        if (a.responsavelUid) return false
      } else if (filtros.responsavel && a.responsavelUid !== filtros.responsavel) {
        return false
      }
      if (filtros.area && a.area !== filtros.area) return false
      if (filtros.tipo && a.tipo !== filtros.tipo) return false
      if (filtros.prioridade && a.prioridade !== filtros.prioridade) return false
      if (filtros.etiqueta && !(a.etiquetas ?? []).includes(filtros.etiqueta)) return false
      if (!termo) return true
      return (
        a.titulo.toLowerCase().includes(termo) ||
        (a.descricao ?? '').toLowerCase().includes(termo) ||
        (a.artistaNome ?? '').toLowerCase().includes(termo) ||
        (a.responsavelNome ?? '').toLowerCase().includes(termo) ||
        (a.etiquetas ?? []).some((e) => e.toLowerCase().includes(termo))
      )
    },
    [filtros],
  )

  const noEscopoLista = useMemo(() => lista.filter(noEscopo), [lista, noEscopo])

  const visiveis = useMemo(
    () =>
      noEscopoLista.filter((a) => {
        if (filtros.ocultarConcluidas && concluida(a, configAtiva)) return false
        if (filtros.somenteAtrasadas && !estaAtrasada(a, configAtiva)) return false
        return true
      }),
    [noEscopoLista, filtros.ocultarConcluidas, filtros.somenteAtrasadas, configAtiva],
  )

  const etiquetasConhecidas = useMemo(() => {
    const set = new Set<string>(configAtiva.etiquetas)
    for (const a of lista) for (const e of a.etiquetas ?? []) set.add(e)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [lista, configAtiva])

  const filtrando = useMemo(
    () => JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS),
    [filtros],
  )

  /** Move a demanda: estado local na hora, uma escrita, sem releitura. */
  const mover = useCallback(
    async (id: string, destino: string, alvoId: string | null) => {
      const atual = lista.find((a) => a.id === id)
      if (!atual) return
      const ordem = ordemAoSoltar(lista, destino, alvoId, id)
      if (atual.etapa === destino && atual.ordem === ordem) return

      const campos = transicao(atual, destino, configAtiva, quem)
      // Updater funcional em toda escrita otimista: o `lista` capturado aqui é
      // do render em que a ação começou, e duas ações em sequência rápida (mover
      // dois cards, marcar dois itens) fariam a segunda gravar por cima da
      // primeira no estado local — o banco fica certo e a tela, errada.
      setTodas((atual) =>
        (atual ?? []).map((a) => (a.id === id ? { ...a, ...campos, ordem } : a)),
      )
      try {
        await moverAtividade(atual, destino, ordem, configAtiva, quem)
        setErro(null)
      } catch {
        setErro('Não consegui mover a demanda. O quadro foi recarregado.')
        await recarregar()
      }
    },
    [lista, configAtiva, quem, recarregar],
  )

  /** Reprograma a janela — o que o arrasto da barra do cronograma grava. */
  const reagendar = useCallback(
    async (id: string, inicio: string | null, prazo: string | null) => {
      setTodas((atual) => (atual ?? []).map((a) => (a.id === id ? { ...a, inicio, prazo } : a)))
      try {
        await reprogramar(id, inicio, prazo)
        setErro(null)
      } catch {
        setErro('Não consegui salvar as novas datas. O quadro foi recarregado.')
        await recarregar()
      }
    },
    [recarregar],
  )

  const alternarItem = useCallback(
    async (id: string, itemId: string) => {
      const atual = lista.find((a) => a.id === id)
      if (!atual?.checklist) return
      const checklist: ItemChecklist[] = atual.checklist.map((i) =>
        i.id === itemId ? { ...i, feito: !i.feito } : i,
      )
      setTodas((atual) => (atual ?? []).map((a) => (a.id === id ? { ...a, checklist } : a)))
      try {
        await salvarChecklist(id, checklist)
        setErro(null)
      } catch {
        setErro('Não consegui salvar o checklist. O quadro foi recarregado.')
        await recarregar()
      }
    },
    [lista, recarregar],
  )

  const remover = useCallback(
    async (a: Atividade) => {
      setExcluindo(a.id)
      try {
        await excluirAtividade(a.id, lista)
        // Espelha localmente o que a exclusão fez no banco: as subtarefas viram
        // demandas soltas e as setas que apontavam pra ela caem.
        setTodas((atualLista) =>
          (atualLista ?? [])
            .filter((x) => x.id !== a.id)
            .map((x) => ({
              ...x,
              paiId: x.paiId === a.id ? null : x.paiId,
              dependeDe: (x.dependeDe ?? []).filter((d) => d !== a.id),
            })),
        )
        setErro(null)
      } catch {
        setErro('Não consegui excluir a demanda.')
        await recarregar()
      } finally {
        setExcluindo(null)
      }
    },
    [lista, recarregar],
  )

  const aplicarLocal = useCallback((a: Atividade) => {
    setTodas((atual) => {
      if (!atual) return atual
      const existe = atual.some((x) => x.id === a.id)
      return existe ? atual.map((x) => (x.id === a.id ? a : x)) : [...atual, a]
    })
  }, [])

  const valor: QuadroCtx = {
    config: configAtiva,
    carregandoConfig: config === null,
    todas: lista,
    visiveis,
    noEscopo: noEscopoLista,
    carregando: todas === null,
    erro,
    artistas,
    equipe,
    filtros,
    setFiltros,
    filtrando,
    limparFiltros: () => setFiltros(FILTROS_VAZIOS),
    etiquetasConhecidas,
    progresso: (a) => progressoDe(a, lista, configAtiva),
    atrasada: (a) => estaAtrasada(a, configAtiva),
    concluida: (a) => concluida(a, configAtiva),
    paradaHa: (a) => diasNaEtapa(a),
    mover,
    reagendar,
    alternarItem,
    remover,
    recarregar,
    aplicarLocal,
    excluindo,
    setErro,
  }

  // `user` só entra aqui pra deixar explícito que o quadro é área logada; o
  // gate de permissão de verdade está na página e nas regras do Firestore.
  void user

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

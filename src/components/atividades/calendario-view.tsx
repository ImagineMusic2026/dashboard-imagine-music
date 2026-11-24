'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { EventoDialog } from '@/components/agenda/evento-dialog'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { metaDoTipo, type EventoAgenda } from '@/lib/agenda/client'
import { chaveDiaMes, chavesDeAniversario, lerDataNascimento } from '@/lib/artistas/aniversario'
import {
  deISO,
  diasEntre,
  hojeISO,
  paraISO,
  reprogramar,
  somarDias,
  type Atividade,
} from '@/lib/atividades/client'
import { dataLonga, empurrarSucessoras } from '@/lib/atividades/cronograma'
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
 * Quantas demandas o dia mostra antes de recolher o resto num "+N".
 *
 * Eram 3, e num dia de lançamento o calendário virava um "+4 demandas" que não
 * dizia quais. A célula não tem altura fixa: ela cresce com o conteúdo até este
 * teto, então um mês tranquilo continua compacto.
 *
 * O teto conta só DEMANDAS. Evento da agenda e aniversário ficam sempre
 * visíveis: são poucos por dia e são justamente a referência pela qual as
 * demandas do dia existem — esconder a data do lançamento atrás de um "+N"
 * desfaria o motivo de eles estarem aqui.
 */
const POR_DIA = 6

/**
 * O que está sendo arrastado, escrito no `dataTransfer`.
 *
 * Duas coisas arrastáveis caem no mesmo drop, e elas gravam em coleções
 * diferentes: a demanda anda com a janela inteira (início + prazo) e oferece o
 * empurrão das sucessoras; o evento da agenda é só uma data. Sem o prefixo, um
 * id de evento cairia no caminho da demanda e o drop viraria um silêncio.
 */
const ARRASTO_DEMANDA = 'demanda:'
const ARRASTO_EVENTO = 'evento:'

/**
 * O dia em que a demanda aparece no calendário: o PRAZO, e o início só quando é
 * marco (que não tem duração).
 *
 * É também o ponto de referência do arrasto: a distância entre este dia e o dia
 * em que o card foi solto é o quanto a janela inteira anda.
 */
function diaDe(a: Atividade): string | null {
  return a.prazo ?? (a.marco ? a.inicio : null) ?? null
}

/** O empurrão oferecido depois de mover uma demanda que tem sucessoras. */
interface Cascata {
  id: string
  titulo: string
  dias: number
  afetadas: number
}

/** Um aniversário no dia — derivado do cadastro, não é documento nenhum. */
interface Aniversariante {
  slug: string
  nome: string
}

type DialogoEvento = null | { modo: 'novo'; data: string } | { modo: 'editar'; evento: EventoAgenda }

/**
 * O calendário: as entregas do mês, as datas marcadas da agenda e os
 * aniversários do roster.
 *
 * Aqui a demanda aparece pela data de ENTREGA, não pela janela inteira. É a
 * pergunta "o que vence nesta semana?", e espalhar cada demanda por todos os
 * dias entre início e prazo transformaria um mês normal num bloco sólido —
 * quem quer a janela inteira tem o cronograma ao lado.
 *
 * Arrastar o card pra outro dia reprograma a demanda (pedido da cliente em
 * 11/2026): a janela inteira anda a mesma distância, numa escrita só, como o
 * arrasto do quadro e o da barra do cronograma.
 *
 * ## Agenda e aniversários no mesmo mês (pedido da cliente em 11/2026)
 *
 * A equipe vinha criando demanda de lançamento no quadro só para marcar a data
 * — e uma demanda carrega etapa, responsável, prazo e carga de time que ninguém
 * ia preencher. O lugar dessa data é a **Agenda**; o que faltava era ela
 * aparecer aqui, onde o mês é olhado. Por isso o evento entra em AZUL e o
 * aniversário em ROSA: a cor diz, antes de ler, que aquilo não é trabalho na
 * mão de ninguém. O evento arrasta igual à demanda (muda só a data dele) e abre
 * para edição no clique; o aniversário vem do cadastro do artista e não se
 * arrasta — quem nasceu em 12/03 não nasce noutro dia.
 */
export function CalendarioView({ onAbrir }: { onAbrir: (a: Atividade) => void }) {
  const { user } = useAuth()
  const {
    config,
    visiveis,
    todas,
    artistas,
    filtros,
    reagendar,
    aplicarLocal,
    atrasada,
    concluida,
    filtrando,
    tituloDe,
    setErro,
    eventos,
    podeAgenda,
    agendaIndisponivel,
    pedirEventos,
    podeAniversarios,
    reagendarEvento,
    recarregarEventos,
  } = useQuadro()

  // A agenda só é lida porque ESTA visão montou (ver `pedirEventos` no
  // contexto). Trocar de visão e voltar não relê: o estado vive no provider.
  useEffect(() => {
    if (podeAgenda) pedirEventos()
  }, [podeAgenda, pedirEventos])
  const hoje = hojeISO()
  const [mesBase, setMesBase] = useState(() => hoje.slice(0, 7))
  // Dias abertos pelo "+N": a chave é a data ISO, então o que sobra de outro mês
  // não atrapalha — aquele dia só volta a existir quando o mês dele voltar.
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  // Arrasto: o card que está na mão e o dia sob o cursor. Os dois só marcam a
  // tela — quem grava é `soltarNoDia`.
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [cascata, setCascata] = useState<Cascata | null>(null)
  const [empurrando, setEmpurrando] = useState(false)
  // As duas camadas que não são demanda. Ligadas por padrão — quem pediu o
  // calendário pediu justamente por elas —, e desligáveis para a semana em que
  // só interessa o que a equipe tem na mão.
  const [mostrarAgenda, setMostrarAgenda] = useState(true)
  const [mostrarAniversarios, setMostrarAniversarios] = useState(true)
  const [dialogoEvento, setDialogoEvento] = useState<DialogoEvento>(null)

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
      const dia = diaDe(a)
      if (!dia) continue
      const atual = m.get(dia) ?? []
      atual.push(a)
      m.set(dia, atual)
    }
    return m
  }, [visiveis])

  /**
   * Os filtros que a agenda e os aniversários entendem.
   *
   * São dois, e de propósito: ARTISTA, que é o recorte que a equipe mais faz, e
   * a BUSCA. Responsável, área, tipo, prioridade e etiqueta são campos de
   * demanda — um evento não tem nenhum deles, e fazê-lo "não casar" com esses
   * filtros sumiria com a data do lançamento justamente quando alguém está
   * olhando o mês de uma pessoa do time.
   */
  const termo = filtros.busca.trim().toLowerCase()

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>()
    if (!podeAgenda || !mostrarAgenda) return m
    for (const ev of eventos) {
      if (filtros.artista && ev.artistaSlug !== filtros.artista) continue
      if (
        termo &&
        !ev.titulo.toLowerCase().includes(termo) &&
        !(ev.descricao ?? '').toLowerCase().includes(termo) &&
        !(ev.artistaNome ?? '').toLowerCase().includes(termo)
      ) {
        continue
      }
      const atual = m.get(ev.data) ?? []
      atual.push(ev)
      m.set(ev.data, atual)
    }
    return m
  }, [eventos, podeAgenda, mostrarAgenda, filtros.artista, termo])

  /**
   * Os aniversários por 'MM-DD', não por data cheia: o dia 12/03 do cadastro
   * vale em todo ano que o calendário visitar, e guardar por ano obrigaria a
   * refazer o mapa a cada mês andado.
   *
   * A data vem do roster que o seletor de artista já leu — nenhuma leitura a
   * mais. O colaborador recebe a lista sem data de nascimento, então para ele
   * esta camada simplesmente não tem o que mostrar.
   */
  const aniversariosPorDiaMes = useMemo(() => {
    const m = new Map<string, Aniversariante[]>()
    if (!mostrarAniversarios) return m
    for (const a of artistas) {
      if (filtros.artista && a.slug !== filtros.artista) continue
      if (termo && !a.nome.toLowerCase().includes(termo)) continue
      const n = lerDataNascimento(a.dataNascimento)
      if (!n) continue
      const chave = chaveDiaMes(n)
      const atual = m.get(chave) ?? []
      atual.push({ slug: a.slug, nome: a.nome })
      m.set(chave, atual)
    }
    m.forEach((lista) => lista.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')))
    return m
  }, [artistas, mostrarAniversarios, filtros.artista, termo])

  /**
   * Existe ALGUM artista com data de nascimento no cadastro? (sem filtro — a
   * pergunta é sobre o roster, não sobre o recorte da tela.)
   *
   * Sem nenhum, a camada rosa não teria o que mostrar em mês nenhum, e um botão
   * que não liga nada é pior que botão nenhum: a pessoa fica procurando o
   * aniversário que o painel não tem. Em vez do botão, uma linha dizendo de
   * onde a data vem.
   */
  const temAniversarios = useMemo(
    () => artistas.some((a) => lerDataNascimento(a.dataNascimento) !== null),
    [artistas],
  )

  function aniversariantesDe(iso: string): Aniversariante[] {
    if (!aniversariosPorDiaMes.size) return []
    const out: Aniversariante[] = []
    for (const chave of chavesDeAniversario(iso)) out.push(...(aniversariosPorDiaMes.get(chave) ?? []))
    return out
  }

  const semData = visiveis.filter((a) => !diaDe(a))

  function alternarDia(iso: string) {
    setAbertos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(iso)) proximo.delete(iso)
      else proximo.add(iso)
      return proximo
    })
  }

  function andar(passo: number) {
    const d = new Date(ano, mes - 1 + passo, 1, 12)
    setMesBase(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  /**
   * Solta o card num dia: a janela inteira anda a mesma distância.
   *
   * O calendário mostra a demanda pela data de ENTREGA, então é ela que vai
   * parar no dia onde o card foi solto; o início acompanha pelo mesmo número de
   * dias. Arrastar REPROGRAMA, não estica — quem quer mudar a duração tem as
   * pontas da barra no cronograma. Uma escrita, sem releitura, como o quadro.
   */
  function soltarNoDia(iso: string, id: string) {
    const a = todas.find((x) => x.id === id)
    const atual = a ? diaDe(a) : null
    if (!a || !atual) return
    const dias = diasEntre(atual, iso)
    if (!dias) return

    void reagendar(
      a.id,
      a.inicio ? somarDias(a.inicio, dias) : null,
      a.prazo ? somarDias(a.prazo, dias) : null,
    )

    // Mesma regra do cronograma: mover uma demanda NÃO empurra as dependentes
    // sozinho — reagendar em cascata sem avisar é o tipo de coisa que ninguém
    // desfaz. A faixa oferece o empurrão. O deslocamento é medido pelo dia do
    // card, que é a ENTREGA: é a data em que a antecessora termina que puxa a
    // sucessora.
    const afetadas = empurrarSucessoras(todas, a.id, dias)
    if (afetadas.length) {
      setCascata({ id: a.id, titulo: tituloDe(a), dias, afetadas: afetadas.length })
    }
  }

  /**
   * Solta um EVENTO da agenda num dia: muda a data dele e mais nada.
   *
   * Evento não tem janela nem sucessora — é uma data marcada. Por isso aqui não
   * existe cascata: não há o que empurrar.
   */
  function soltarEventoNoDia(iso: string, id: string) {
    const ev = eventos.find((e) => e.id === id)
    if (!ev || ev.data === iso) return
    void reagendarEvento(id, iso)
  }

  async function aplicarCascata() {
    if (!cascata) return
    setEmpurrando(true)
    try {
      const mudancas = empurrarSucessoras(todas, cascata.id, cascata.dias)
      // Uma escrita por demanda afetada, em sequência: são poucas, e assim uma
      // falha isolada não desfaz o resto.
      for (const m of mudancas) await reprogramar(m.id, m.inicio, m.prazo)
      // As novas datas já estão calculadas — aplicar no estado local custa zero
      // leitura, enquanto recarregar varreria a coleção inteira.
      for (const m of mudancas) {
        const demanda = todas.find((x) => x.id === m.id)
        if (demanda) aplicarLocal({ ...demanda, inicio: m.inicio, prazo: m.prazo })
      }
      setCascata(null)
      setErro(null)
    } catch {
      setErro('Não consegui empurrar as demandas dependentes.')
    } finally {
      setEmpurrando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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

        {/*
          As camadas que não são demanda. O botão é a legenda: a bolinha diz a
          cor que a pessoa vai procurar na grade, e `aria-pressed` diz o estado
          sem depender dela.
        */}
        <div className="flex items-center gap-1.5 ml-auto">
          {podeAgenda && (
            <>
              <button
                type="button"
                onClick={() => setMostrarAgenda((v) => !v)}
                aria-pressed={mostrarAgenda}
                title="Mostrar ou esconder os eventos da agenda"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                  mostrarAgenda
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                    : 'bg-bg-900 border-bg-700/50 text-ink-400 hover:text-ink-200',
                )}
              >
                <span
                  aria-hidden
                  className={cn('w-2 h-2 rounded-[3px]', mostrarAgenda ? 'bg-blue-400' : 'bg-bg-700')}
                />
                Agenda
              </button>
              <button
                type="button"
                // O dia do MÊS EXIBIDO, não o de hoje: quem está em dezembro e
                // clica aqui quer marcar em dezembro. Olhando o mês corrente, o
                // padrão continua sendo hoje.
                onClick={() =>
                  setDialogoEvento({
                    modo: 'novo',
                    data: mesBase === hoje.slice(0, 7) ? hoje : `${mesBase}-01`,
                  })
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" aria-hidden />
                Novo evento
              </button>
            </>
          )}
          {podeAniversarios && temAniversarios && (
            <button
              type="button"
              onClick={() => setMostrarAniversarios((v) => !v)}
              aria-pressed={mostrarAniversarios}
              title="Mostrar ou esconder os aniversários do roster"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                mostrarAniversarios
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-200'
                  : 'bg-bg-900 border-bg-700/50 text-ink-400 hover:text-ink-200',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'w-2 h-2 rounded-[3px]',
                  mostrarAniversarios ? 'bg-pink-400' : 'bg-bg-700',
                )}
              />
              Aniversários
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-ink-400 hidden sm:block">
        Demanda pela data de entrega · arraste o card (ou o evento da agenda) pra outro dia
      </p>

      {agendaIndisponivel && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm text-amber-200/90"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            Não consegui carregar a agenda — os eventos podem estar faltando neste mês. O que
            aparece aqui são só as demandas.
          </span>
        </div>
      )}

      {podeAniversarios && !temAniversarios && (
        <p className="text-[11px] text-ink-400">
          Nenhum artista tem data de nascimento no cadastro, então não há aniversário pra mostrar.
          A data entra em <span className="text-ink-300">Perfil do artista › Editar</span> ou pelo
          questionário do artista.
        </p>
      )}

      {cascata && (
        <div className="flex flex-wrap items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2.5">
          <p className="text-sm text-violet-100/90 flex-1 min-w-[240px]">
            <strong>{cascata.titulo}</strong> andou {Math.abs(cascata.dias)} dia
            {Math.abs(cascata.dias) === 1 ? '' : 's'}{' '}
            {cascata.dias > 0 ? 'para frente' : 'para trás'}. Empurrar as {cascata.afetadas} demandas
            que dependem dela?
          </p>
          <button
            type="button"
            onClick={aplicarCascata}
            disabled={empurrando}
            className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white text-xs font-semibold transition-colors"
          >
            {empurrando ? 'Empurrando…' : 'Empurrar dependentes'}
          </button>
          <button
            type="button"
            onClick={() => setCascata(null)}
            aria-label="Manter as datas das dependentes"
            className="p-1.5 rounded-md text-ink-400 hover:text-ink-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
              const doDiaEventos = eventosPorDia.get(iso) ?? []
              const doDiaAniversarios = aniversariantesDe(iso)
              const aberto = abertos.has(iso)
              const escondidas = doDia.length - POR_DIA
              const ehHoje = iso === hoje
              const fds = [0, 6].includes(deISO(iso).getDay())
              return (
                <div
                  key={iso}
                  onDragOver={(e) => {
                    // Sem o preventDefault o navegador recusa o drop. A célula
                    // inteira é alvo, inclusive por baixo dos cards: o evento
                    // deles sobe até aqui.
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setAlvo(iso)
                  }}
                  onDragLeave={() => setAlvo((c) => (c === iso ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault()
                    const carga = e.dataTransfer.getData('text/plain')
                    setAlvo(null)
                    setArrastando(null)
                    if (carga.startsWith(ARRASTO_EVENTO)) {
                      soltarEventoNoDia(iso, carga.slice(ARRASTO_EVENTO.length))
                    } else if (carga.startsWith(ARRASTO_DEMANDA)) {
                      soltarNoDia(iso, carga.slice(ARRASTO_DEMANDA.length))
                    }
                  }}
                  className={cn(
                    'min-h-[140px] p-1.5 border-r border-bg-700/20 last:border-r-0 space-y-1 transition-colors',
                    !doMes && 'bg-bg-950/40',
                    fds && doMes && 'bg-bg-950/20',
                    arrastando &&
                      alvo === iso &&
                      'bg-violet-500/10 ring-1 ring-inset ring-violet-500/40',
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

                  {/*
                    Agenda e aniversários vêm ANTES das demandas: são a referência
                    do dia (o lançamento, a data do show), e o teto do "+N" é só
                    das demandas — assim a data marcada nunca é a que some.
                  */}
                  {doDiaEventos.map((ev) => {
                    const meta = metaDoTipo(ev.tipo)
                    const visivel = `${ev.artistaNome ? `${ev.artistaNome} - ` : ''}${ev.titulo}`
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', `${ARRASTO_EVENTO}${ev.id}`)
                          e.dataTransfer.effectAllowed = 'move'
                          setArrastando(ev.id)
                        }}
                        onDragEnd={() => {
                          setArrastando(null)
                          setAlvo(null)
                        }}
                        onClick={() => setDialogoEvento({ modo: 'editar', evento: ev })}
                        // O rótulo COMEÇA pelo texto visível (WCAG 2.5.3): quem
                        // comanda por voz fala o que está na tela.
                        aria-label={`${visivel} — evento da agenda, ${meta.label.toLowerCase()} em ${dataLonga(iso)}`}
                        className={cn(
                          'w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 transition-colors hover:brightness-125 cursor-grab active:cursor-grabbing',
                          'bg-blue-500/20 border-blue-500/50 text-blue-200',
                          arrastando === ev.id && 'opacity-40',
                        )}
                      >
                        {/*
                          Ícone, e não um ponto: o azul sozinho não distingue um
                          evento de uma demanda cuja etapa o admin pintou de azul.
                          É o mesmo papel que o bolo faz no aniversário.
                        */}
                        <CalendarDays className="w-2.5 h-2.5 shrink-0" aria-hidden />
                        <span className="truncate">{visivel}</span>
                      </button>
                    )
                  })}

                  {doDiaAniversarios.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/artistas/${a.slug}`}
                      // `<a href>` é arrastável por padrão: sem isto, arrastar o
                      // chip rosa mostrava cursor de "mover" pela grade inteira
                      // e terminava em nada.
                      draggable={false}
                      title={`Aniversário de ${a.nome}`}
                      aria-label={`Aniversário de ${a.nome} em ${dataLonga(iso)}`}
                      className="w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 transition-colors hover:brightness-125 bg-pink-500/15 border-pink-500/40 text-pink-200"
                    >
                      <Cake className="w-2.5 h-2.5 shrink-0" aria-hidden />
                      <span className="truncate">{a.nome}</span>
                    </Link>
                  ))}

                  {(aberto ? doDia : doDia.slice(0, POR_DIA)).map((a) => {
                    const etapa = etapaDe(config, a.etapa)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        // O card é o mesmo botão que abre a demanda: arrastar e
                        // clicar não competem (o navegador não dispara o clique
                        // no fim de um arrasto), e quem não arrasta — teclado,
                        // celular — muda a data pelo detalhe, que abre daqui.
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', `${ARRASTO_DEMANDA}${a.id}`)
                          e.dataTransfer.effectAllowed = 'move'
                          setArrastando(a.id)
                        }}
                        onDragEnd={() => {
                          setArrastando(null)
                          setAlvo(null)
                        }}
                        onClick={() => onAbrir(a)}
                        title={tituloDe(a)}
                        // A data só existia visualmente, na célula em volta: para
                        // quem navega por leitor de tela, os botões do mês eram
                        // uma lista de títulos sem quando.
                        aria-label={`${tituloDe(a)} — ${a.marco ? 'marco' : 'entrega'} em ${dataLonga(iso)}`}
                        className={cn(
                          'w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 transition-colors hover:brightness-125 cursor-grab active:cursor-grabbing',
                          arrastando === a.id && 'opacity-40',
                          concluida(a)
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : atrasada(a)
                              ? 'bg-red-500/10 border-red-500/30 text-red-300'
                              : cor(etapa?.cor).chip,
                        )}
                      >
                        {a.marco && <CircleDot className="w-2.5 h-2.5 shrink-0 rotate-45" aria-hidden />}
                        <span className="truncate">{tituloDe(a)}</span>
                      </button>
                    )
                  })}

                  {escondidas > 0 && (
                    <button
                      type="button"
                      onClick={() => alternarDia(iso)}
                      aria-expanded={aberto}
                      aria-label={
                        aberto
                          ? `Recolher as demandas de ${dataLonga(iso)}`
                          : `Ver mais ${escondidas} demanda${escondidas === 1 ? '' : 's'} de ${dataLonga(iso)}`
                      }
                      className="w-full text-left text-[9px] font-semibold text-ink-500 hover:text-violet-300 px-1 py-0.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      {aberto ? 'mostrar menos' : `+${escondidas} demanda${escondidas === 1 ? '' : 's'}`}
                    </button>
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

      {dialogoEvento && (
        <EventoDialog
          evento={dialogoEvento.modo === 'editar' ? dialogoEvento.evento : null}
          dataInicial={dialogoEvento.modo === 'novo' ? dialogoEvento.data : undefined}
          uid={user?.uid ?? ''}
          onClose={() => setDialogoEvento(null)}
          onSalvo={async (dataEvento) => {
            setDialogoEvento(null)
            // Pula para o mês do evento salvo. Sem isto, criar um evento olhando
            // outro mês não mudava nada na tela: parecia que não tinha salvo, e
            // a pessoa repetia — duplicando o evento num mês que ela nem via.
            if (dataEvento) setMesBase(dataEvento.slice(0, 7))
            await recarregarEventos()
          }}
          onExcluido={async () => {
            setDialogoEvento(null)
            await recarregarEventos()
          }}
        />
      )}
    </div>
  )
}

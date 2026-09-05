'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightToLine,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Route,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { diasEntre, somarDias, type Atividade } from '@/lib/atividades/client'
import {
  agrupamentoMeta,
  barraDe,
  caminhoCritico,
  conflitosDe,
  dataCurta,
  duracaoEmDias,
  empurrarSucessoras,
  escalaMeta,
  ESCALAS,
  janelaDaDemanda,
  janelaDe,
  montarEixo,
  montarLinhas,
  situacaoDaBarra,
  type Agrupamento,
  type Escala,
  type Eixo,
} from '@/lib/atividades/cronograma'
import { campoLigado, cor, etapaDe } from '@/lib/atividades/tipos'
import { reprogramar } from '@/lib/atividades/client'
import { cn } from '@/lib/utils'

const LARGURA_PAINEL = 296
const ALTURA_LINHA = 38
/** Zona de agarre nas pontas da barra, em px. */
const PEGA = 8

type Arrasto = {
  id: string
  modo: 'mover' | 'inicio' | 'fim'
  xInicial: number
  inicio: string
  fim: string
}

/** Datas em pré-visualização enquanto a barra é arrastada. */
type Previa = { id: string; inicio: string; fim: string }

/**
 * O cronograma: a linha do tempo do quadro.
 *
 * É a visão que a cliente pediu como "algo tipo MS Project", e o que isso quer
 * dizer na prática são quatro coisas que um kanban não responde:
 *
 * 1. **Quando** cada demanda acontece — barra do início ao prazo, não só uma data.
 * 2. **O que depende do quê** — as setas entre as barras, e o aviso quando a
 *    antecessora termina depois de a sucessora começar.
 * 3. **Onde um atraso dói** — o caminho crítico, a corrente mais longa de
 *    dependências: atrasar uma demanda dali empurra a entrega inteira.
 * 4. **Projeto e subtarefa** — a demanda mãe recolhe e expande os filhos.
 *
 * Arrastar a barra reprograma as datas com UMA escrita, igual ao arrasto no
 * kanban. Quando a demanda movida tem sucessoras, o cronograma NÃO as empurra
 * sozinho: oferece o empurrão numa faixa de ação. Reagendar em cascata sem
 * perguntar é o tipo de coisa que a pessoa só descobre depois, olhando um
 * cronograma que ela não reconhece.
 */
export function CronogramaView({
  agrupamento,
  onAbrir,
}: {
  agrupamento: Agrupamento
  onAbrir: (a: Atividade) => void
}) {
  const {
    config,
    visiveis,
    todas,
    reagendar,
    aplicarLocal,
    progresso,
    atrasada,
    concluida,
    setErro,
    filtrando,
  } = useQuadro()

  const [escala, setEscala] = useState<Escala>('semana')
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set())
  const [mostrarCritico, setMostrarCritico] = useState(false)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [cascata, setCascata] = useState<{
    id: string
    titulo: string
    dias: number
    afetadas: number
  } | null>(null)
  const [empurrando, setEmpurrando] = useState(false)

  const rolagem = useRef<HTMLDivElement>(null)
  /**
   * Id da demanda que acabou de ser ARRASTADA (não apenas clicada). O `click`
   * dispara depois do `pointerup`, então sem esta marca soltar uma barra
   * reprogramada abria o painel de detalhe por cima do cronograma que a pessoa
   * acabou de ajustar. Guarda o id, e não um booleano, pra arrastar a barra A
   * não engolir o próximo clique na barra B.
   */
  const arrastou = useRef<string | null>(null)

  const linhas = useMemo(
    () => montarLinhas(visiveis, config, { agrupamento, recolhidos }),
    [visiveis, config, agrupamento, recolhidos],
  )

  const janela = useMemo(() => janelaDe(visiveis), [visiveis])
  const eixo = useMemo(
    () => montarEixo(janela.inicio, janela.fim, escala),
    [janela.inicio, janela.fim, escala],
  )

  // O terceiro argumento é o universo: as antecessoras são procuradas no quadro
  // INTEIRO, mesmo que a iteração seja só sobre o recorte. Sem isso, filtrar por
  // um artista fazia toda dependência de fora do filtro virar "depende de uma
  // demanda que não existe mais".
  const conflitos = useMemo(() => conflitosDe(visiveis, config, todas), [visiveis, config, todas])
  const critico = useMemo(
    () => (mostrarCritico ? caminhoCritico(visiveis) : new Set<string>()),
    [visiveis, mostrarCritico],
  )

  /** Índice de cada demanda entre as linhas — vira o Y das setas. */
  const indicePorId = useMemo(() => {
    const m = new Map<string, number>()
    linhas.forEach((l, i) => {
      if (l.tipo === 'demanda') m.set(l.id, i)
    })
    return m
  }, [linhas])

  const irParaHoje = useCallback(() => {
    if (!rolagem.current || eixo.hoje === null) return
    rolagem.current.scrollTo({
      left: Math.max(0, eixo.hoje - rolagem.current.clientWidth / 2 + LARGURA_PAINEL / 2),
      behavior: 'smooth',
    })
  }, [eixo.hoje])

  // Abrir o cronograma já centrado em hoje: é onde a leitura começa. Refazer a
  // cada troca de escala mantém o mesmo ponto no lugar depois do zoom.
  useEffect(() => {
    const t = setTimeout(irParaHoje, 60)
    return () => clearTimeout(t)
  }, [irParaHoje, escala])

  /* ---------------------------------------------------------------------- */
  /* Arrasto das barras                                                      */
  /* ---------------------------------------------------------------------- */

  // `previa` muda a cada pixel do arrasto; ler o valor mais recente por ref
  // evita reatar os ouvintes de ponteiro a cada movimento do mouse.
  const previaRef = useRef<Previa | null>(null)
  previaRef.current = previa

  useEffect(() => {
    if (!arrasto) return

    const mover = (e: PointerEvent) => {
      const dias = Math.round((e.clientX - arrasto.xInicial) / eixo.larguraDia)
      if (dias !== 0) arrastou.current = arrasto.id
      if (arrasto.modo === 'mover') {
        setPrevia({
          id: arrasto.id,
          inicio: somarDias(arrasto.inicio, dias),
          fim: somarDias(arrasto.fim, dias),
        })
        return
      }
      if (arrasto.modo === 'inicio') {
        const novo = somarDias(arrasto.inicio, dias)
        // A ponta nunca ultrapassa a outra: uma barra invertida desenharia
        // largura negativa e gravaria um prazo anterior ao início.
        setPrevia({ id: arrasto.id, inicio: novo > arrasto.fim ? arrasto.fim : novo, fim: arrasto.fim })
        return
      }
      const novo = somarDias(arrasto.fim, dias)
      setPrevia({ id: arrasto.id, inicio: arrasto.inicio, fim: novo < arrasto.inicio ? arrasto.inicio : novo })
    }

    const soltar = () => {
      const p = previaRef.current
      const a = arrasto
      setArrasto(null)
      setPrevia(null)
      if (!p || (p.inicio === a.inicio && p.fim === a.fim)) return

      const alvo = visiveis.find((x) => x.id === a.id)
      void reagendar(a.id, p.inicio, p.fim)

      // Medido pelo FIM, não pelo início: a dependência aqui é fim-para-início
      // (`conflitosDe` compara `dela.fim > minha.inicio`), então quem empurra a
      // sucessora é a data em que a antecessora TERMINA. Pelo início, esticar o
      // prazo pela pega direita nunca oferecia a cascata — justo o caso que
      // precisa dela — e antecipar só o começo pela pega esquerda oferecia um
      // empurrão que nada justificava.
      const deslocamento = diasEntre(a.fim, p.fim)
      if (alvo && deslocamento !== 0) {
        const afetadas = empurrarSucessoras(todas, a.id, deslocamento)
        if (afetadas.length) {
          setCascata({ id: a.id, titulo: alvo.titulo, dias: deslocamento, afetadas: afetadas.length })
        }
      }
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    // `pointercancel` também encerra: o navegador cancela o ponteiro quando o
    // gesto vira scroll no toque ou quando a janela perde o foco no meio do
    // arrasto. Sem ele o arrasto ficava grudado no cursor e os ouvintes vivos.
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [arrasto, eixo.larguraDia, reagendar, todas, visiveis])

  async function aplicarCascata() {
    if (!cascata) return
    setEmpurrando(true)
    try {
      const mudancas = empurrarSucessoras(todas, cascata.id, cascata.dias)
      // Uma escrita por demanda afetada, em sequência. Um lote seria mais
      // enxuto, mas aqui são poucas e assim uma falha isolada não desfaz o resto.
      for (const m of mudancas) await reprogramar(m.id, m.inicio, m.prazo)
      // As novas datas já estão calculadas — aplicar no estado local custa zero
      // leitura, enquanto `recarregar()` varreria a coleção inteira.
      for (const m of mudancas) {
        const alvo = todas.find((x) => x.id === m.id)
        if (alvo) aplicarLocal({ ...alvo, inicio: m.inicio, prazo: m.prazo })
      }
      setCascata(null)
      setErro(null)
    } catch {
      setErro('Não consegui empurrar as demandas dependentes.')
    } finally {
      setEmpurrando(false)
    }
  }

  /** Abre o detalhe, a menos que o clique seja o fim do arrasto DESTA barra. */
  function abrir(a: Atividade) {
    if (arrastou.current === a.id) {
      arrastou.current = null
      return
    }
    onAbrir(a)
  }

  function alternarRecolhido(chave: string) {
    setRecolhidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  /** A janela em vigor pra desenhar: a prévia do arrasto ganha do que está salvo. */
  function janelaVigente(a: Atividade) {
    if (previa?.id === a.id) return { inicio: previa.inicio, fim: previa.fim }
    return janelaDaDemanda(a)
  }

  if (!visiveis.length) {
    return (
      <p className="text-sm text-ink-500 text-center py-16">
        {filtrando ? 'Nada com esses filtros.' : 'Nenhuma demanda ainda — crie a primeira.'}
      </p>
    )
  }

  const alturaCorpo = linhas.length * ALTURA_LINHA

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-0.5 bg-bg-900 border border-bg-700/50 rounded-lg p-0.5"
          role="group"
          aria-label="Escala do cronograma"
        >
          {ESCALAS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEscala(e)}
              aria-pressed={escala === e}
              title={escalaMeta[e].descricao}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                escala === e ? 'bg-violet-500/15 text-violet-300' : 'text-ink-400 hover:text-ink-200',
              )}
            >
              {escalaMeta[e].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={irParaHoje}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-900 border border-bg-700/50 text-[11px] font-semibold text-ink-300 hover:text-ink-100 transition-colors"
        >
          <ArrowRightToLine className="w-3.5 h-3.5" aria-hidden />
          Hoje
        </button>

        <button
          type="button"
          onClick={() => setMostrarCritico((v) => !v)}
          aria-pressed={mostrarCritico}
          title="A corrente de dependências mais longa — onde um atraso empurra a entrega inteira"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
            mostrarCritico
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-bg-900 border-bg-700/50 text-ink-300 hover:text-ink-100',
          )}
        >
          <Route className="w-3.5 h-3.5" aria-hidden />
          Caminho crítico
        </button>

        <p className="text-[11px] text-ink-500 ml-auto hidden sm:block">
          Arraste a barra pra reprogramar · as pontas mudam a duração
        </p>
      </div>

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

      <div
        ref={rolagem}
        className="overflow-auto border border-bg-700/40 rounded-xl bg-bg-900/40 max-h-[68vh]"
      >
        <div style={{ width: LARGURA_PAINEL + eixo.largura, minWidth: '100%' }}>
          <CabecalhoEixo eixo={eixo} />

          <div className="relative" style={{ height: alturaCorpo }}>
            {/* UMA grade para o corpo inteiro. Antes ela era instanciada dentro
                de cada linha: com 300 demandas e um ano de janela, isso dava
                mais de cem mil divs — e todas re-renderizavam a cada pixel do
                arrasto. */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{ left: LARGURA_PAINEL, width: eixo.largura, height: alturaCorpo }}
              aria-hidden
            >
              <GradeDeFundo eixo={eixo} />
            </div>

            <SetasDeDependencia
              linhas={linhas}
              indicePorId={indicePorId}
              eixo={eixo}
              janelaVigente={janelaVigente}
              altura={alturaCorpo}
              conflitos={conflitos}
            />

            {linhas.map((linha, i) => {
              if (linha.tipo === 'grupo') {
                const chave = `grupo:${linha.id}`
                const aberto = !recolhidos.has(chave)
                return (
                  <div
                    key={chave}
                    className="flex items-center border-b border-bg-700/30 bg-bg-800/40"
                    style={{ height: ALTURA_LINHA }}
                  >
                    <div
                      className="sticky left-0 z-20 bg-bg-800/95 h-full flex items-center px-3"
                      style={{ width: LARGURA_PAINEL, minWidth: LARGURA_PAINEL }}
                    >
                      <button
                        type="button"
                        onClick={() => alternarRecolhido(chave)}
                        aria-expanded={aberto}
                        className="flex items-center gap-1.5 text-xs font-bold text-ink-200 hover:text-violet-300 transition-colors truncate"
                      >
                        {aberto ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="truncate">{linha.rotulo || 'Sem grupo'}</span>
                        <span className="text-[10px] font-semibold text-ink-500 num shrink-0">
                          {linha.concluidas}/{linha.quantidade}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              }

              const a = linha.atividade
              const vigente = janelaVigente(a)
              const barra = barraDe(
                { ...a, inicio: vigente.inicio, prazo: vigente.fim },
                eixo,
              )
              const etapa = etapaDe(config, a.etapa)
              const paleta = cor(etapa?.cor)
              const feito = progresso(a)
              const problemas = conflitos.get(a.id) ?? []
              const noCritico = critico.has(a.id)
              const situacao = situacaoDaBarra(a, todas, config)
              const arrastandoEsta = arrasto?.id === a.id

              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center border-b border-bg-700/20 hover:bg-bg-800/30 transition-colors',
                    i % 2 === 1 && 'bg-bg-950/20',
                  )}
                  style={{ height: ALTURA_LINHA }}
                >
                  <div
                    className="sticky left-0 z-20 bg-bg-900/95 h-full flex items-center gap-1.5 px-3 border-r border-bg-700/30"
                    style={{ width: LARGURA_PAINEL, minWidth: LARGURA_PAINEL }}
                  >
                    <div style={{ width: linha.nivel * 14 }} aria-hidden />
                    {linha.temFilhos ? (
                      <button
                        type="button"
                        onClick={() => alternarRecolhido(a.id)}
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

                    <button
                      type="button"
                      onClick={() => onAbrir(a)}
                      className={cn(
                        'text-left text-xs truncate hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded flex-1 min-w-0',
                        linha.temFilhos ? 'font-bold text-ink-100' : 'text-ink-200',
                        concluida(a) && 'text-ink-500 line-through decoration-ink-600',
                      )}
                      title={a.titulo}
                    >
                      {a.titulo}
                    </button>

                    {!!problemas.length && (
                      <TriangleAlert
                        className="w-3.5 h-3.5 text-amber-400 shrink-0"
                        aria-label={problemas.map((p) => p.mensagem).join(' ')}
                      />
                    )}
                    {campoLigado(config, 'responsavel') && a.responsavelNome && (
                      <span
                        className="w-5 h-5 rounded-full bg-bg-700 grid place-items-center text-[9px] font-bold text-ink-300 shrink-0"
                        title={a.responsavelNome}
                      >
                        {a.responsavelNome
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="relative h-full flex-1" style={{ width: eixo.largura }}>
                    {barra.marco ? (
                      <button
                        type="button"
                        onClick={() => abrir(a)}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          arrastou.current = null
                          setArrasto({
                            id: a.id,
                            modo: 'mover',
                            xInicial: e.clientX,
                            inicio: vigente.inicio,
                            fim: vigente.fim,
                          })
                        }}
                        title={`${a.titulo} — marco em ${dataCurta(vigente.inicio)}`}
                        aria-label={`Marco "${a.titulo}" em ${dataCurta(vigente.inicio)}`}
                        className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                        style={{ left: barra.left + eixo.larguraDia / 2 - 7 }}
                      >
                        <CircleDot
                          className={cn(
                            'w-3.5 h-3.5 rotate-45',
                            concluida(a) ? 'text-emerald-400' : 'text-amber-400',
                          )}
                        />
                      </button>
                    ) : (
                      <div
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 h-5 rounded-md border overflow-hidden transition-shadow',
                          concluida(a)
                            ? 'bg-emerald-500/20 border-emerald-500/40'
                            : atrasada(a)
                              ? 'bg-red-500/20 border-red-500/50'
                              : cn('bg-bg-800', paleta.borda, 'border-opacity-60'),
                          noCritico && 'ring-2 ring-red-500/60',
                          arrastandoEsta && 'shadow-lg shadow-violet-500/20',
                        )}
                        style={{ left: barra.left, width: barra.largura }}
                      >
                        {/* Preenchimento de progresso: a parte "feita" da barra,
                            como a barra de andamento do MS Project. */}
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0',
                            concluida(a) ? 'bg-emerald-500/50' : paleta.bar,
                            !concluida(a) && 'opacity-50',
                          )}
                          style={{ width: `${feito}%` }}
                          aria-hidden
                        />

                        <button
                          type="button"
                          onClick={() => abrir(a)}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            setArrasto({
                              id: a.id,
                              modo: 'mover',
                              xInicial: e.clientX,
                              inicio: vigente.inicio,
                              fim: vigente.fim,
                            })
                          }}
                          title={`${a.titulo}\n${dataCurta(vigente.inicio)} → ${dataCurta(vigente.fim)} · ${duracaoEmDias({ ...a, inicio: vigente.inicio, prazo: vigente.fim })} dias\n${situacao.texto}`}
                          aria-label={`${a.titulo}, de ${dataCurta(vigente.inicio)} a ${dataCurta(vigente.fim)}. ${situacao.texto}. Abrir demanda.`}
                          className="absolute inset-0 w-full cursor-grab active:cursor-grabbing px-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                          <span className="text-[10px] font-semibold text-ink-100 truncate block leading-5">
                            {barra.largura > 64 ? `${feito}%` : ''}
                          </span>
                        </button>

                        {/* As pegas ficam por cima do botão (z maior) — são elas
                            que mudam a duração em vez de deslocar a barra. */}
                        <span
                          role="presentation"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setArrasto({
                              id: a.id,
                              modo: 'inicio',
                              xInicial: e.clientX,
                              inicio: vigente.inicio,
                              fim: vigente.fim,
                            })
                          }}
                          className="absolute inset-y-0 left-0 cursor-ew-resize hover:bg-violet-400/30"
                          style={{ width: PEGA }}
                        />
                        <span
                          role="presentation"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setArrasto({
                              id: a.id,
                              modo: 'fim',
                              xInicial: e.clientX,
                              inicio: vigente.inicio,
                              fim: vigente.fim,
                            })
                          }}
                          className="absolute inset-y-0 right-0 cursor-ew-resize hover:bg-violet-400/30"
                          style={{ width: PEGA }}
                        />
                      </div>
                    )}

                    {/* Etiqueta ao lado da barra: o texto não cabe dentro dela
                        nas escalas fechadas, e sem ele o cronograma vira um
                        gráfico de blocos sem nome. */}
                    <span
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 text-[10px] whitespace-nowrap pointer-events-none',
                        situacao.tom === 'ruim'
                          ? 'text-red-400 font-semibold'
                          : situacao.tom === 'atencao'
                            ? 'text-amber-400'
                            : 'text-ink-500',
                      )}
                      style={{ left: barra.left + barra.largura + 8 }}
                    >
                      {situacao.texto}
                    </span>
                  </div>
                </div>
              )
            })}

            {eixo.hoje !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-violet-400/70 pointer-events-none z-10"
                style={{ left: LARGURA_PAINEL + eixo.hoje }}
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-600">
        {agrupamento !== 'nenhum' && `${agrupamentoMeta[agrupamento]} · `}
        {linhas.filter((l) => l.tipo === 'demanda').length} demandas na linha do tempo
        {mostrarCritico && critico.size > 0 && ` · ${critico.size} no caminho crítico`}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Cabeçalho e grade                                                           */
/* -------------------------------------------------------------------------- */

function CabecalhoEixo({ eixo }: { eixo: Eixo }) {
  return (
    <div className="sticky top-0 z-30 flex bg-bg-900 border-b border-bg-700/40">
      <div
        className="sticky left-0 z-40 bg-bg-900 border-r border-bg-700/30 flex items-end px-3 py-2"
        style={{ width: LARGURA_PAINEL, minWidth: LARGURA_PAINEL }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Demanda</span>
      </div>
      <div className="relative" style={{ width: eixo.largura }}>
        <div className="flex h-6">
          {eixo.meses.map((m) => (
            <div
              key={m.chave}
              className="border-l border-bg-700/40 text-[10px] font-semibold text-ink-400 px-1.5 truncate leading-6"
              style={{ width: m.largura, minWidth: m.largura }}
            >
              {m.largura > 42 ? m.rotulo : ''}
            </div>
          ))}
        </div>
        <div className="flex h-6">
          {eixo.celulas.map((c) => (
            <div
              key={c.iso}
              className={cn(
                'text-[9px] text-center leading-6 border-l',
                c.inicioDeMes ? 'border-bg-700/50' : 'border-bg-700/15',
                c.hoje ? 'text-violet-300 font-bold' : c.fimDeSemana ? 'text-ink-600' : 'text-ink-500',
              )}
              style={{ width: c.largura, minWidth: c.largura }}
            >
              {c.rotulo}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Faixas de fim de semana e divisórias de mês, atrás das barras. */
function GradeDeFundo({ eixo }: { eixo: Eixo }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {eixo.celulas.map((c) => (
        <div
          key={c.iso}
          className={cn(
            'absolute top-0 bottom-0 border-l',
            c.inicioDeMes ? 'border-bg-700/40' : 'border-bg-700/10',
            c.fimDeSemana && 'bg-bg-950/40',
          )}
          style={{ left: c.left, width: c.largura }}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Setas de dependência                                                        */
/* -------------------------------------------------------------------------- */

/**
 * As setas que ligam antecessora → sucessora.
 *
 * Um SVG único por cima da área das barras, e não um por linha: as setas cruzam
 * linhas o tempo todo, e desenhar cada uma dentro da sua faixa as cortaria.
 * O traçado é ortogonal (sai da direita da antecessora, desce/sobe, entra pela
 * esquerda da sucessora) porque diagonal por cima de dezenas de barras vira
 * ruído — é a mesma escolha que o MS Project faz.
 *
 * Só liga o que está na tela: uma dependência cuja antecessora foi filtrada não
 * vira uma seta saindo do nada.
 */
function SetasDeDependencia({
  linhas,
  indicePorId,
  eixo,
  janelaVigente,
  altura,
  conflitos,
}: {
  linhas: ReturnType<typeof montarLinhas>
  indicePorId: Map<string, number>
  eixo: Eixo
  janelaVigente: (a: Atividade) => { inicio: string; fim: string }
  altura: number
  conflitos: Map<string, { tipo: string; outraId: string; mensagem: string }[]>
}) {
  const caminhos: { d: string; problema: boolean; chave: string }[] = []

  for (const linha of linhas) {
    if (linha.tipo !== 'demanda') continue
    const a = linha.atividade
    const iDestino = indicePorId.get(a.id)
    if (iDestino === undefined) continue

    for (const depId of a.dependeDe ?? []) {
      const iOrigem = indicePorId.get(depId)
      if (iOrigem === undefined) continue
      const origem = linhas.find((l) => l.tipo === 'demanda' && l.id === depId)
      if (!origem || origem.tipo !== 'demanda') continue

      const jo = janelaVigente(origem.atividade)
      const jd = janelaVigente(a)
      const x1 =
        (diasEntre(eixo.inicio, jo.fim) + 1) * eixo.larguraDia
      const y1 = iOrigem * ALTURA_LINHA + ALTURA_LINHA / 2
      const x2 = diasEntre(eixo.inicio, jd.inicio) * eixo.larguraDia
      const y2 = iDestino * ALTURA_LINHA + ALTURA_LINHA / 2

      // Cotovelo: um degrau curto à direita da origem, a descida, e a entrada
      // pela esquerda do destino. Quando o destino está ANTES da origem (o caso
      // do conflito), o desvio passa por fora pra seta não voltar por cima.
      const folga = 10
      const meio = x2 > x1 + folga ? x2 - folga : x1 + folga
      const d = `M ${x1} ${y1} H ${meio} V ${y2} H ${x2}`
      const problema = (conflitos.get(a.id) ?? []).some((c) => c.outraId === depId)
      caminhos.push({ d, problema, chave: `${depId}->${a.id}` })
    }
  }

  if (!caminhos.length) return null

  return (
    <svg
      className="absolute top-0 pointer-events-none z-10"
      style={{ left: LARGURA_PAINEL, width: eixo.largura, height: altura }}
      width={eixo.largura}
      height={altura}
      aria-hidden
    >
      <defs>
        <marker id="seta-ok" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" className="fill-ink-500" />
        </marker>
        <marker id="seta-ruim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" className="fill-amber-400" />
        </marker>
      </defs>
      {caminhos.map((c) => (
        <path
          key={c.chave}
          d={c.d}
          fill="none"
          strokeWidth={1.25}
          className={c.problema ? 'stroke-amber-400' : 'stroke-ink-600'}
          markerEnd={c.problema ? 'url(#seta-ruim)' : 'url(#seta-ok)'}
        />
      ))}
    </svg>
  )
}

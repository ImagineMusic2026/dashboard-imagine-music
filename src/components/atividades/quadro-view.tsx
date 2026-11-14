'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { AtividadeCard } from '@/components/atividades/atividade-card'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { daEtapa, type Atividade } from '@/lib/atividades/client'
import { agruparPor, type Agrupamento } from '@/lib/atividades/cronograma'
import { cor } from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

/**
 * Teto de altura da coluna, pra o quadro inteiro caber numa tela: o desconto
 * cobre o cabeçalho da página, os indicadores e a faixa de filtros acima dele.
 * O piso existe pra uma coluna vazia não virar uma tira de 40px.
 */
const ALTURA_COLUNA = 'max-h-[calc(100vh-25rem)] min-h-[16rem]'

/** Com raias, várias faixas dividem a mesma tela — cada uma ganha menos altura. */
const ALTURA_COLUNA_RAIA = 'max-h-[22rem]'

/**
 * O kanban.
 *
 * Duas coisas que ele ganhou ao virar uma visão entre outras:
 *
 * - **Raias.** Agrupar por artista, responsável ou área quebra o quadro em
 *   faixas horizontais com as mesmas colunas. É como a gestão olha quando a
 *   pergunta deixa de ser "o que está em produção?" e vira "o que está em
 *   produção DE CADA artista?".
 * - **Limite de WIP.** Uma coluna com teto configurado avisa quando passa dele.
 *   O aviso não bloqueia: travar o arrasto esconderia o problema em vez de
 *   mostrá-lo, e a demanda urgente entraria de qualquer jeito por fora.
 *
 * E uma terceira, de 03/11/2026: a coluna tem **teto de altura** e rola por
 * dentro. Antes ela crescia com os cards, o quadro ficava mais alto que a tela
 * e a barra de rolagem horizontal — a que anda entre as etapas — ia parar no pé
 * da página: pra alcançar a última coluna era preciso descer tudo primeiro.
 */
export function QuadroView({
  agrupamento,
  onAbrir,
  onNovo,
}: {
  agrupamento: Agrupamento
  onAbrir: (a: Atividade) => void
  onNovo: (etapa: string) => void
}) {
  const { config, visiveis, filtrando, mover, nomeArtistaDe } = useQuadro()
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set())

  const grupos = agruparPor(visiveis, agrupamento, config, { nomeArtistaDe })
  const comRaias = agrupamento !== 'nenhum'

  function alternarRaia(id: string) {
    setRecolhidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
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
    <div className="space-y-4">
      {grupos.map((grupo) => {
        const recolhida = recolhidas.has(grupo.id)
        return (
          <div key={grupo.id}>
            {comRaias && (
              <button
                type="button"
                onClick={() => alternarRaia(grupo.id)}
                aria-expanded={!recolhida}
                className="flex items-center gap-2 mb-2 text-sm font-semibold text-ink-200 hover:text-violet-300 transition-colors"
              >
                {recolhida ? (
                  <ChevronRight className="w-4 h-4" aria-hidden />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden />
                )}
                {grupo.rotulo}
                <span className="text-[10px] num bg-bg-800 text-ink-400 px-1.5 py-0.5 rounded font-semibold">
                  {grupo.itens.length}
                </span>
              </button>
            )}

            {!recolhida && (
              <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
                {config.etapas.map((etapa) => {
                  const cards = daEtapa(grupo.itens, etapa.key)
                  const chaveAlvo = `${grupo.id}:${etapa.key}`
                  const paleta = cor(etapa.cor)
                  const teto = typeof etapa.wip === 'number' && etapa.wip > 0 ? etapa.wip : null
                  // O teto vale pela coluna inteira, não pela raia: um limite de
                  // "3 em produção" é do time, não de cada artista.
                  const naColuna = comRaias ? daEtapa(visiveis, etapa.key).length : cards.length
                  const estourou = teto !== null && naColuna > teto

                  return (
                    <section
                      key={etapa.key}
                      aria-label={`${etapa.label} — ${cards.length} demanda${cards.length === 1 ? '' : 's'}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setAlvo(chaveAlvo)
                      }}
                      onDragLeave={() => setAlvo((c) => (c === chaveAlvo ? null : c))}
                      onDrop={(e) => {
                        e.preventDefault()
                        const id = e.dataTransfer.getData('text/plain')
                        setAlvo(null)
                        setArrastando(null)
                        if (id) mover(id, etapa.key, null)
                      }}
                      className={cn(
                        // Coluna ELÁSTICA: cresce para ocupar a largura livre
                        // (num monitor grande, cinco colunas fixas de 272px
                        // deixavam um terço da tela vazio à direita) e nunca
                        // encolhe abaixo do piso — quando as colunas não cabem
                        // mais, o `overflow-x-auto` do pai volta a rolar.
                        // O teto existe para uma coluna solta não virar uma
                        // faixa de tela inteira com um card no meio.
                        'flex-1 basis-[272px] min-w-[268px] max-w-[420px] bg-bg-900/40 border rounded-xl flex flex-col transition-colors',
                        comRaias ? ALTURA_COLUNA_RAIA : ALTURA_COLUNA,
                        alvo === chaveAlvo ? 'border-violet-500/50 bg-violet-500/5' : 'border-bg-700/30',
                      )}
                    >
                      <div className="px-3 py-3 border-b border-bg-700/30 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-1.5 h-1.5 rounded-full', paleta.bar)} aria-hidden />
                          <span
                            className={cn('text-xs font-bold uppercase tracking-wider', paleta.text)}
                          >
                            {etapa.label}
                          </span>
                          <span
                            className={cn(
                              'ml-auto text-[10px] num px-1.5 py-0.5 rounded font-semibold',
                              estourou ? 'bg-red-500/15 text-red-300' : 'bg-bg-800 text-ink-400',
                            )}
                            title={
                              comRaias && teto !== null
                                ? `${cards.length} nesta raia · ${naColuna} na coluna inteira`
                                : undefined
                            }
                          >
                            {/* Com raias, o selo mostra o número DA COLUNA quando
                                há teto: o limite é do time, e mostrar a contagem
                                da raia ao lado de um alerta sobre a coluna fazia
                                os dois números discordarem na mesma linha. */}
                            {teto !== null
                              ? `${comRaias ? naColuna : cards.length}/${teto}`
                              : cards.length}
                          </span>
                        </div>
                        {estourou && (
                          <p className="flex items-center gap-1 text-[10px] text-red-400 mt-1.5">
                            <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden />
                            {naColuna} em andamento, limite de {teto}
                          </p>
                        )}
                        {!estourou && !comRaias && etapa.descricao && (
                          <p className="text-[10px] text-ink-600 mt-1">{etapa.descricao}</p>
                        )}
                      </div>

                      {/* O min-h definido (e não "auto") é o que autoriza o
                          encolhimento do item flex — sem ele a lista empurraria
                          a coluna pra além do teto em vez de rolar. */}
                      <div className="p-2 space-y-2 flex-1 min-h-[100px] overflow-y-auto overscroll-contain">
                        {cards.map((a) => (
                          <AtividadeCard
                            key={a.id}
                            atividade={a}
                            arrastando={arrastando === a.id}
                            onAbrir={() => onAbrir(a)}
                            onArrastarInicio={() => setArrastando(a.id)}
                            onArrastarFim={() => {
                              setArrastando(null)
                              setAlvo(null)
                            }}
                            onSoltarAntes={() => {
                              if (arrastando && arrastando !== a.id) mover(arrastando, etapa.key, a.id)
                              setArrastando(null)
                              setAlvo(null)
                            }}
                          />
                        ))}

                        {cards.length === 0 && (
                          <p className="text-[11px] text-ink-600 text-center py-6 px-2">
                            {filtrando ? 'Nada com esses filtros.' : 'Arraste uma demanda pra cá.'}
                          </p>
                        )}
                      </div>

                      {!comRaias && (
                        <button
                          type="button"
                          onClick={() => onNovo(etapa.key)}
                          className="m-2 mt-0 shrink-0 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-ink-500 hover:text-violet-300 hover:bg-bg-800/60 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden />
                          Adicionar em {etapa.label}
                        </button>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

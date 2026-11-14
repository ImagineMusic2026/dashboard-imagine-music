'use client'

import { ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { iniciaisDe } from '@/lib/artistas/client'
import { type Atividade } from '@/lib/atividades/client'
import { campoLigado, cor, etapaDe } from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

/**
 * Um card do quadro — deliberadamente ENXUTO: o título no padrão "Artista -
 * título" (ver `tituloDe`) e o responsável.
 *
 * O quadro responde "em que etapa está cada demanda", e pra isso bastam essas
 * duas linhas. O artista tinha uma linha própria, com avatar; desde que o título
 * passou a trazer o nome (11/2026), ela só repetia o que estava logo acima — e o
 * link para o perfil continua no detalhe. Chips de tipo, área e prioridade, descrição, barra de progresso,
 * etiquetas, prazo, esforço e os selos de subtarefa/comentário/link/dependência
 * saíram do card em 03/11/2026: com tudo isso dentro, cada card passava de 200px
 * e meia dúzia de demandas já empurravam a rolagem horizontal pra fora da tela.
 * Todos esses campos continuam no detalhe — quem quer saber, clica no título.
 *
 * As duas exceções que ficaram são de graça em altura e caras de perder:
 * a barra colorida da esquerda (etapa, ou vermelha quando atrasou) e o selo
 * "Atrasada", que impede o atraso de ser sinalizado só por cor.
 *
 * O container NÃO é clicável de propósito (regra de a11y do repo: nada de
 * pressável dentro de pressável). Quem abre a demanda é o título; as setas e o
 * excluir são irmãos dele — cada um com o seu foco e o seu rótulo. As setas também são o caminho de quem não arrasta: teclado e celular.
 */
export function AtividadeCard({
  atividade,
  arrastando,
  onAbrir,
  onArrastarInicio,
  onArrastarFim,
  onSoltarAntes,
}: {
  atividade: Atividade
  arrastando: boolean
  onAbrir: () => void
  onArrastarInicio: () => void
  onArrastarFim: () => void
  onSoltarAntes: () => void
}) {
  const { config, mover, remover, excluindo, atrasada, tituloDe } = useQuadro()
  const a = atividade
  const titulo = tituloDe(a)

  const i = config.etapas.findIndex((e) => e.key === a.etapa)
  const anterior = i > 0 ? config.etapas[i - 1] : null
  const proxima = i >= 0 && i < config.etapas.length - 1 ? config.etapas[i + 1] : null

  const etapa = etapaDe(config, a.etapa)
  const estaAtrasada = atrasada(a)
  const excluindoEste = excluindo === a.id

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', a.id)
        e.dataTransfer.effectAllowed = 'move'
        onArrastarInicio()
      }}
      onDragEnd={onArrastarFim}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSoltarAntes()
      }}
      className={cn(
        'group relative bg-bg-900 border border-bg-700/40 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-colors hover:border-bg-700',
        arrastando && 'opacity-40',
        excluindoEste && 'opacity-50 pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-0.5 rounded-full',
          estaAtrasada ? 'bg-red-500' : cor(etapa?.cor).bar,
        )}
        aria-hidden
      />

      <div className="pl-2">
        <button
          type="button"
          onClick={onAbrir}
          className="text-left text-sm font-semibold text-ink-100 hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
        >
          {titulo}
        </button>

        {/* Rodapé: responsável à esquerda; à direita o atraso e, no hover ou no
            foco, as ações. Dividir a linha com elas é o que evita reservar mais
            uma faixa de altura em todo card só pra três botões invisíveis. */}
        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-bg-700/30">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {campoLigado(config, 'responsavel') &&
              (a.responsavelNome ? (
                <>
                  <span
                    className="w-5 h-5 rounded-full bg-bg-700 grid place-items-center text-[9px] font-bold text-ink-200 shrink-0"
                    aria-hidden
                  >
                    {iniciaisDe(a.responsavelNome)}
                  </span>
                  <span className="text-[11px] text-ink-300 truncate">{a.responsavelNome}</span>
                </>
              ) : (
                <span className="text-[11px] text-ink-500 italic">Sem responsável</span>
              ))}
          </div>

          {estaAtrasada && (
            <span className="text-[10px] font-semibold text-red-400 shrink-0">Atrasada</span>
          )}

          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              disabled={!anterior}
              onClick={() => anterior && mover(a.id, anterior.key, null)}
              aria-label={
                anterior
                  ? `Mover "${titulo}" para ${anterior.label}`
                  : `"${titulo}" já está na primeira etapa`
              }
              className="p-1 rounded hover:bg-bg-800 text-ink-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!proxima}
              onClick={() => proxima && mover(a.id, proxima.key, null)}
              aria-label={
                proxima
                  ? `Mover "${titulo}" para ${proxima.label}`
                  : `"${titulo}" já está na última etapa`
              }
              className="p-1 rounded hover:bg-bg-800 text-ink-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => remover(a)}
              aria-label={`Excluir "${titulo}"`}
              className="p-1 rounded hover:bg-red-500/10 text-ink-500 hover:text-red-400 transition-colors"
            >
              {excluindoEste ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

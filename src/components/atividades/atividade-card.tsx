'use client'

import Link from 'next/link'
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { corAvatarDe, iniciaisDe } from '@/lib/artistas/client'
import {
  areaMeta,
  estaAtrasada,
  etapaMeta,
  ETAPAS,
  prioridadeMeta,
  type Atividade,
  type EtapaAtividade,
} from '@/lib/atividades/client'
import { cn } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM-DD' → '12 set' (sem conversão de fuso). */
function prazoCurto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`
}

/**
 * Um card do quadro.
 *
 * O container NÃO é clicável de propósito (regra de a11y do repo: nada de
 * pressável dentro de pressável). Quem abre a edição é o título; as setas, o
 * link do artista e o excluir são irmãos dele — cada um com o seu foco e o seu
 * rótulo. As setas também são o caminho de quem não arrasta: teclado e celular.
 */
export function AtividadeCard({
  atividade,
  arrastando,
  onEditar,
  onMover,
  onExcluir,
  onArrastarInicio,
  onArrastarFim,
  onSoltarAntes,
  excluindo,
}: {
  atividade: Atividade
  arrastando: boolean
  onEditar: () => void
  onMover: (destino: EtapaAtividade) => void
  onExcluir: () => void
  onArrastarInicio: () => void
  onArrastarFim: () => void
  onSoltarAntes: () => void
  excluindo: boolean
}) {
  const a = atividade
  const i = ETAPAS.indexOf(a.etapa)
  const anterior = i > 0 ? ETAPAS[i - 1] : null
  const proxima = i < ETAPAS.length - 1 ? ETAPAS[i + 1] : null
  const atrasada = estaAtrasada(a)
  const prio = prioridadeMeta[a.prioridade] ?? prioridadeMeta.media

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
        excluindo && 'opacity-50 pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-0.5 rounded-full',
          atrasada ? 'bg-red-500' : etapaMeta[a.etapa].bar,
        )}
        aria-hidden
      />

      <div className="pl-2">
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {a.area && (
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                areaMeta[a.area].chip,
              )}
            >
              {areaMeta[a.area].label}
            </span>
          )}
          {a.prioridade !== 'baixa' && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', prio.chip)}>
              {prio.label}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onEditar}
          className="text-left text-sm font-semibold text-ink-100 hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
        >
          {a.titulo}
        </button>

        {a.descricao && (
          <p className="text-[12px] text-ink-400 mt-1 line-clamp-2">{a.descricao}</p>
        )}

        {a.artistaNome && (
          <div className="flex items-center gap-1.5 mt-2">
            <AvatarFallback
              iniciais={iniciaisDe(a.artistaNome)}
              gradient={corAvatarDe(a.artistaSlug ?? a.artistaNome)}
              size="sm"
            />
            {a.artistaSlug ? (
              <Link
                href={`/artistas/${a.artistaSlug}`}
                className="text-[12px] text-violet-400 hover:text-violet-300 truncate"
              >
                {a.artistaNome}
              </Link>
            ) : (
              <span className="text-[12px] text-ink-400 truncate">{a.artistaNome}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-bg-700/30">
          <div className="flex items-center gap-1.5 min-w-0">
            {a.responsavelNome ? (
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
            )}
          </div>

          {a.prazo && (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] shrink-0 num',
                atrasada ? 'text-red-400 font-semibold' : 'text-ink-500',
              )}
            >
              <CalendarClock className="w-3 h-3" />
              {prazoCurto(a.prazo)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            disabled={!anterior}
            onClick={() => anterior && onMover(anterior)}
            aria-label={
              anterior
                ? `Mover "${a.titulo}" para ${etapaMeta[anterior].label}`
                : `"${a.titulo}" já está na primeira etapa`
            }
            className="p-1 rounded hover:bg-bg-800 text-ink-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!proxima}
            onClick={() => proxima && onMover(proxima)}
            aria-label={
              proxima
                ? `Mover "${a.titulo}" para ${etapaMeta[proxima].label}`
                : `"${a.titulo}" já está na última etapa`
            }
            className="p-1 rounded hover:bg-bg-800 text-ink-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExcluir}
            aria-label={`Excluir "${a.titulo}"`}
            className="p-1 rounded hover:bg-red-500/10 text-ink-500 hover:text-red-400 ml-auto transition-colors"
          >
            {excluindo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

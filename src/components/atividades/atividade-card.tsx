'use client'

import Link from 'next/link'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  GitBranch,
  Link2,
  ListTree,
  Loader2,
  MessageSquare,
  Pause,
  Trash2,
} from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { useAuth } from '@/components/auth/auth-provider'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import { corAvatarDe, iniciaisDe } from '@/lib/artistas/client'
import { filhosDe, type Atividade } from '@/lib/atividades/client'
import { dataCurta } from '@/lib/atividades/cronograma'
import {
  areaDe,
  campoLigado,
  cor,
  etapaDe,
  prioridadeMeta,
  tipoDe,
  esforcoMeta,
} from '@/lib/atividades/tipos'
import { ehStaff } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/** A partir de quantos dias parada a demanda ganha o selo de travada. */
const DIAS_PARADA = 7

/**
 * Um card do quadro.
 *
 * O container NÃO é clicável de propósito (regra de a11y do repo: nada de
 * pressável dentro de pressável). Quem abre a demanda é o título; as setas, o
 * link do artista e o excluir são irmãos dele — cada um com o seu foco e o seu
 * rótulo. As setas também são o caminho de quem não arrasta: teclado e celular.
 *
 * O que o card mostra é decidido pela configuração do quadro: um time que
 * desligou "esforço" e "etiquetas" vê um card mais curto, sem buraco no lugar.
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
  const { config, todas, mover, remover, excluindo, progresso, atrasada, concluida, paradaHa } =
    useQuadro()
  // Só a equipe abre o perfil do artista; para o colaborador o nome é texto.
  const { role } = useAuth()
  const equipe = ehStaff(role)
  const a = atividade

  const i = config.etapas.findIndex((e) => e.key === a.etapa)
  const anterior = i > 0 ? config.etapas[i - 1] : null
  const proxima = i >= 0 && i < config.etapas.length - 1 ? config.etapas[i + 1] : null

  // Só "alta" e "urgente" ganham chip. "Média" é o padrão de toda demanda, então
  // mostrá-la punha um chip em cada card e afogava justamente o sinal que
  // precisava saltar; "baixa" é abaixo do padrão e também não pede atenção.
  const prioridadeVisivel = a.prioridade === 'alta' || a.prioridade === 'urgente'

  const etapa = etapaDe(config, a.etapa)
  const tipo = campoLigado(config, 'tipo') ? tipoDe(config, a.tipo) : null
  const area = campoLigado(config, 'area') ? areaDe(config, a.area) : null
  const prio = prioridadeMeta[a.prioridade] ?? prioridadeMeta.media

  const estaAtrasada = atrasada(a)
  const feito = progresso(a)
  const filhos = filhosDe(todas, a.id)
  const dias = paradaHa(a)
  const travada = !concluida(a) && dias !== null && dias >= DIAS_PARADA

  const itens = a.checklist ?? []
  const marcados = itens.filter((x) => x.feito).length
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
        {(tipo || area || prioridadeVisivel || a.marco) && (
          <div className="flex flex-wrap items-center gap-1 mb-1.5">
            {a.marco && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5" aria-hidden />
                Marco
              </span>
            )}
            {tipo && (
              <span
                className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cor(tipo.cor).chip)}
              >
                {tipo.label}
              </span>
            )}
            {area && (
              <span
                className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cor(area.cor).chip)}
              >
                {area.label}
              </span>
            )}
            {prioridadeVisivel && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', prio.chip)}>
                {prio.label}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onAbrir}
          className="text-left text-sm font-semibold text-ink-100 hover:text-violet-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
        >
          {a.titulo}
        </button>

        {a.descricao && <p className="text-[12px] text-ink-400 mt-1 line-clamp-2">{a.descricao}</p>}

        {/* A barra só aparece quando há de onde tirar um número honesto — sem
            checklist e sem subtarefas, "0%" diria mais sobre o preenchimento do
            card do que sobre o andamento do trabalho. */}
        {(itens.length > 0 || filhos.length > 0) && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-ink-500 mb-1">
              <span>
                {itens.length > 0
                  ? `${marcados}/${itens.length} no checklist`
                  : `${filhos.filter((f) => concluida(f)).length}/${filhos.length} subtarefas`}
              </span>
              <span className="num font-semibold text-ink-400">{feito}%</span>
            </div>
            <div className="h-1 rounded-full bg-bg-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full', feito === 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                style={{ width: `${feito}%` }}
              />
            </div>
          </div>
        )}

        {campoLigado(config, 'etiquetas') && !!a.etiquetas?.length && (
          <div className="flex flex-wrap gap-1 mt-2">
            {a.etiquetas.slice(0, 3).map((e) => (
              <span
                key={e}
                className="text-[10px] px-1.5 py-0.5 rounded bg-bg-800 text-ink-400 border border-bg-700/50"
              >
                {e}
              </span>
            ))}
            {a.etiquetas.length > 3 && (
              <span className="text-[10px] px-1 py-0.5 text-ink-500">+{a.etiquetas.length - 3}</span>
            )}
          </div>
        )}

        {campoLigado(config, 'artista') && a.artistaNome && (
          <div className="flex items-center gap-1.5 mt-2">
            <AvatarFallback
              iniciais={iniciaisDe(a.artistaNome)}
              gradient={corAvatarDe(a.artistaSlug ?? a.artistaNome)}
              size="sm"
            />
            {equipe && a.artistaSlug ? (
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

          <div className="flex items-center gap-2 shrink-0">
            {campoLigado(config, 'esforco') && a.esforco && (
              <span
                className="text-[10px] font-bold text-ink-500 num"
                title={esforcoMeta[a.esforco].descricao}
              >
                {esforcoMeta[a.esforco].label}
              </span>
            )}
            {campoLigado(config, 'prazo') && a.prazo && (
              <span
                className={cn(
                  'flex items-center gap-1 text-[11px] num',
                  estaAtrasada ? 'text-red-400 font-semibold' : 'text-ink-500',
                )}
              >
                <CalendarClock className="w-3 h-3" aria-hidden />
                {dataCurta(a.prazo)}
              </span>
            )}
          </div>
        </div>

        {/* Selos silenciosos: dizem que existe mais coisa dentro da demanda sem
            obrigar a abri-la. O de "parada" é o único que grita. */}
        {(travada ||
          !!filhos.length ||
          !!a.qtdComentarios ||
          !!a.links?.length ||
          !!a.dependeDe?.length) && (
          <div className="flex items-center gap-2.5 mt-2 text-[10px] text-ink-500">
            {travada && (
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Pause className="w-3 h-3" aria-hidden />
                {dias}d parada
              </span>
            )}
            {!!filhos.length && (
              <span className="flex items-center gap-1 num" title={`${filhos.length} subtarefas`}>
                <ListTree className="w-3 h-3" aria-hidden />
                {filhos.length}
              </span>
            )}
            {!!a.dependeDe?.length && (
              <span
                className="flex items-center gap-1 num"
                title={`Depende de ${a.dependeDe.length} demanda(s)`}
              >
                <GitBranch className="w-3 h-3" aria-hidden />
                {a.dependeDe.length}
              </span>
            )}
            {!!a.qtdComentarios && (
              <span className="flex items-center gap-1 num" title={`${a.qtdComentarios} comentários`}>
                <MessageSquare className="w-3 h-3" aria-hidden />
                {a.qtdComentarios}
              </span>
            )}
            {!!a.links?.length && (
              <span className="flex items-center gap-1 num" title={`${a.links.length} links`}>
                <Link2 className="w-3 h-3" aria-hidden />
                {a.links.length}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            disabled={!anterior}
            onClick={() => anterior && mover(a.id, anterior.key, null)}
            aria-label={
              anterior
                ? `Mover "${a.titulo}" para ${anterior.label}`
                : `"${a.titulo}" já está na primeira etapa`
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
                ? `Mover "${a.titulo}" para ${proxima.label}`
                : `"${a.titulo}" já está na última etapa`
            }
            className="p-1 rounded hover:bg-bg-800 text-ink-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => remover(a)}
            aria-label={`Excluir "${a.titulo}"`}
            className="p-1 rounded hover:bg-red-500/10 text-ink-500 hover:text-red-400 ml-auto transition-colors"
          >
            {excluindoEste ? (
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

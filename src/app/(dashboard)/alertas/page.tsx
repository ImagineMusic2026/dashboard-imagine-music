'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCheck, EyeOff } from 'lucide-react'
import { useAlertas } from '@/components/alertas/alertas-provider'
import { type AlertaDerivado, type SeveridadeAlerta } from '@/lib/alertas/derivar'
import { filtrarPorPrefs } from '@/lib/alertas/preferencias'
import { chavesQueCobrem, chaveVisto, separarVistos } from '@/lib/alertas/vistos'
import { AlertaLinha } from '@/components/alertas/alerta-linha'
import { cn } from '@/lib/utils'

const PILLS: { key: 'todos' | SeveridadeAlerta; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'critico', label: 'Críticos' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'oportunidade', label: 'Oportunidades' },
  { key: 'operacional', label: 'Operacional' },
]

const FALHA_AO_GRAVAR = 'Não foi possível salvar agora. Tente de novo em instantes.'

/** Abrir a página relê a lista se ela tiver mais que isto (a Home não: é a tela mais visitada). */
const IDADE_MAX_LISTA = 5 * 60_000

const vistosTexto = (n: number) => `${n} ${n === 1 ? 'visto' : 'vistos'}`
const abertosTexto = (n: number) => `${n} ${n === 1 ? 'aberto' : 'abertos'}`

export default function AlertasPage() {
  // A lista vem do casco — a MESMA que o sino conta. Abrir a página só a relê se
  // ela estiver suja, tiver falhado ou tiver uns minutos.
  const { carregados, falhou, vistos: mapaVistos, marcar: marcarVistos, desmarcar: desmarcarVisto, renovar } =
    useAlertas()
  const [filtro, setFiltro] = useState<'todos' | SeveridadeAlerta>('todos')
  // Os vistos ficam a um clique, e não apagados: marcar errado tem volta.
  const [verVistos, setVerVistos] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  // Avisa o leitor de tela: a linha marcada some, e sem isto o clique parecia não ter feito nada.
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    renovar(IDADE_MAX_LISTA)
  }, [renovar])

  const todos = useMemo(() => (carregados ? filtrarPorPrefs(carregados.alertas) : []), [carregados])
  const { abertos, vistos } = useMemo(() => separarVistos(todos, mapaVistos ?? {}), [todos, mapaVistos])
  const alertas = verVistos ? vistos : abertos

  const counts = useMemo(() => {
    const c: Record<SeveridadeAlerta, number> = { critico: 0, atencao: 0, oportunidade: 0, operacional: 0 }
    for (const a of alertas) c[a.severidade] += 1
    return c
  }, [alertas])

  const filtrados = useMemo(
    () => (filtro === 'todos' ? alertas : alertas.filter((a) => a.severidade === filtro)),
    [alertas, filtro],
  )

  // Volta da lista de vistos quando ela esvazia — senão a tela ficava presa num
  // "nenhum alerta" sem o botão que leva de volta aos abertos.
  useEffect(() => {
    if (verVistos && vistos.length === 0) setVerVistos(false)
  }, [verVistos, vistos.length])

  async function marcar(lista: AlertaDerivado[]) {
    setFalha(null)
    const restam = abertos.length - lista.length
    setAviso(
      `${lista.length === 1 ? 'Alerta marcado como visto' : `${lista.length} alertas marcados como vistos`}. ${abertosTexto(restam)}.`,
    )
    const ok = await marcarVistos(lista.map(chaveVisto))
    if (!ok) {
      setFalha(FALHA_AO_GRAVAR)
      setAviso('')
    }
  }

  async function desmarcar(a: AlertaDerivado) {
    setFalha(null)
    setAviso(`Alerta devolvido aos abertos. ${vistosTexto(vistos.length - 1)} na lista.`)
    // Todas as marcas que escondem o alerta: numa queda, a marca de "crítico" também
    // esconde a mesma queda em "atenção".
    const ok = await desmarcarVisto(chavesQueCobrem(a))
    if (!ok) {
      setFalha(FALHA_AO_GRAVAR)
      setAviso('')
    }
  }

  // Espera os vistos também: sem eles a lista abriria cheia e encolheria em seguida.
  if (!falhou && (carregados === null || mapaVistos === null)) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-16 justify-center">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Analisando os dados…
      </div>
    )
  }

  if (falhou && carregados === null) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Não foi possível carregar</h1>
        <p className="text-sm text-ink-400 mt-2">Verifique se você é membro ativo e se as regras do Firestore estão deployadas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Alertas</h1>
        <p className="text-sm text-ink-400 mt-1">
          <span className="num text-ink-200">{verVistos ? vistosTexto(vistos.length) : abertosTexto(abertos.length)}</span>
          {counts.critico > 0 && <> · <span className="num text-red-400">{counts.critico} críticos</span></>}
          {counts.atencao > 0 && <> · <span className="num text-amber-400">{counts.atencao} atenção</span></>}
          {counts.oportunidade > 0 && <> · <span className="num text-emerald-400">{counts.oportunidade} oportunidades</span></>}
          {counts.operacional > 0 && <> · <span className="num text-blue-400">{counts.operacional} operacional</span></>}
        </p>
        <p className="text-[12px] text-ink-500 mt-0.5">
          Gerados automaticamente dos dados das redes, do streaming, do cadastro e da saúde das integrações.
          Marcado como visto, o alerta sai do sino e da lista enquanto a situação durar.
        </p>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {PILLS.map((pill) => {
          const n = pill.key === 'todos' ? alertas.length : counts[pill.key]
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFiltro(pill.key)}
              aria-pressed={filtro === pill.key}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                filtro === pill.key
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'bg-bg-800 text-ink-400 hover:text-ink-100 border-transparent',
              )}
            >
              {pill.label}
              <span className="ml-1.5 num text-ink-500">({n})</span>
            </button>
          )
        })}

        <div className="flex items-center gap-2 ml-auto">
          {!verVistos && filtrados.length > 0 && (
            <button
              type="button"
              onClick={() => marcar(filtrados)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-300 hover:text-ink-100 hover:bg-bg-800 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden />
              {filtro === 'todos'
                ? 'Marcar todos como vistos'
                : filtrados.length === 1
                  ? 'Marcar este como visto'
                  : `Marcar estes ${filtrados.length} como vistos`}
            </button>
          )}
          {/* O rótulo diz a ação (ver vistos / voltar), por isso nada de aria-pressed:
              um alternador com rótulo que muda anunciaria "Voltar aos abertos,
              pressionado" justamente quando a tela mostra os vistos. */}
          {(verVistos || vistos.length > 0) && (
            <button
              type="button"
              onClick={() => setVerVistos((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                verVistos
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'border-bg-700/50 text-ink-400 hover:text-ink-100',
              )}
            >
              <EyeOff className="w-3.5 h-3.5" aria-hidden />
              {verVistos ? 'Voltar aos abertos' : `Ver vistos (${vistos.length})`}
            </button>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {aviso}
      </p>

      {falha && (
        <p role="alert" className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {falha}
        </p>
      )}

      {filtrados.length === 0 ? (
        <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-8 text-center">
          <p className="text-sm text-ink-300 font-medium">
            {verVistos ? 'Nenhum alerta visto nesta categoria' : 'Nenhum alerta por aqui'}
          </p>
          <p className="text-[13px] text-ink-500 mt-1 max-w-md mx-auto">
            {verVistos
              ? 'Os alertas que você marcar como vistos ficam guardados aqui enquanto a situação durar.'
              : vistos.length > 0
                ? 'Tudo visto. Alertas novos aparecem aqui conforme as sincronizações rodam.'
                : 'Conforme as sincronizações rodam, os destaques e quedas dos artistas aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="divide-y divide-bg-700/30">
            {filtrados.map((a) => (
              <AlertaLinha
                key={a.id}
                a={a}
                visto={verVistos}
                onVisto={() => (verVistos ? desmarcar(a) : marcar([a]))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

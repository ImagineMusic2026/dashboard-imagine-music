'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AtividadeCard } from '@/components/atividades/atividade-card'
import { AtividadeDialog } from '@/components/atividades/atividade-dialog'
import {
  carimboConclusao,
  daEtapa,
  estaAtrasada,
  etapaMeta,
  ETAPAS,
  excluirAtividade,
  invalidarAtividades,
  listarAtividades,
  listarEquipe,
  moverAtividade,
  ordemAoSoltar,
  type Atividade,
  type EtapaAtividade,
} from '@/lib/atividades/client'
import { listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import type { AppUser } from '@/lib/users'
import { cn } from '@/lib/utils'

type Dialogo = null | { modo: 'novo'; etapa: EtapaAtividade } | { modo: 'editar'; atividade: Atividade }

const seletor =
  'bg-bg-900 border border-bg-700/50 rounded-lg px-3 py-2 text-xs text-ink-200 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

/**
 * Quadro do fluxo de atendimento: colunas = etapas, card = demanda.
 *
 * Duas decisões que valem por escrito:
 *
 * 1. Mover é OTIMISTA e escreve UM doc. O board mexe no estado local na hora,
 *    grava só o card movido e não relê a coleção. É o que mantém o custo de um
 *    dia de arrasta-e-solta perto de zero na cota gratuita do Firestore (a
 *    mesma que já derrubou o painel uma vez). Se a escrita falhar, recarrega
 *    tudo e avisa — a tela nunca fica mentindo.
 * 2. A posição na coluna é um número fracionado (ver `ordemAoSoltar`), então
 *    encaixar no meio não reescreve os vizinhos.
 */
export function AtividadesBoard() {
  const { user } = useAuth()
  const [atividades, setAtividades] = useState<Atividade[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [artistas, setArtistas] = useState<ArtistaDoc[]>([])
  const [equipe, setEquipe] = useState<AppUser[]>([])
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<EtapaAtividade | null>(null)

  // Filtros — o "quem está com o quê" que a gestão pede.
  const [busca, setBusca] = useState('')
  const [fArtista, setFArtista] = useState('')
  const [fResponsavel, setFResponsavel] = useState('')

  const carregar = useCallback(async () => {
    try {
      setAtividades(await listarAtividades())
      setErro(null)
    } catch {
      setErro('Não consegui carregar o quadro. Confirme que as regras do Firestore estão publicadas.')
    }
  }, [])

  useEffect(() => {
    carregar()
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
    listarEquipe()
      .then(setEquipe)
      .catch(() => setEquipe([]))
  }, [carregar])

  const recarregar = useCallback(async () => {
    invalidarAtividades()
    await carregar()
  }, [carregar])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (atividades ?? []).filter((a) => {
      if (fArtista && a.artistaSlug !== fArtista) return false
      if (fResponsavel === '__sem__' ? !!a.responsavelUid : fResponsavel && a.responsavelUid !== fResponsavel)
        return false
      if (!termo) return true
      return (
        a.titulo.toLowerCase().includes(termo) ||
        (a.descricao ?? '').toLowerCase().includes(termo) ||
        (a.artistaNome ?? '').toLowerCase().includes(termo)
      )
    })
  }, [atividades, busca, fArtista, fResponsavel])

  const resumo = useMemo(() => {
    const abertas = visiveis.filter((a) => a.etapa !== 'concluido')
    return {
      abertas: abertas.length,
      atrasadas: abertas.filter(estaAtrasada).length,
      semDono: abertas.filter((a) => !a.responsavelUid).length,
    }
  }, [visiveis])

  const filtrando = !!(busca.trim() || fArtista || fResponsavel)

  /** Move o card (arrastar ou setas): estado local na hora, uma escrita, sem releitura. */
  async function mover(id: string, destino: EtapaAtividade, alvoId: string | null) {
    const lista = atividades ?? []
    const atual = lista.find((a) => a.id === id)
    if (!atual) return
    const ordem = ordemAoSoltar(lista, destino, alvoId, id)
    if (atual.etapa === destino && atual.ordem === ordem) return
    const concluidoEm = carimboConclusao(destino, atual.concluidoEm)

    setAtividades(lista.map((a) => (a.id === id ? { ...a, etapa: destino, ordem, concluidoEm } : a)))
    try {
      await moverAtividade(id, destino, ordem, concluidoEm)
      setErro(null)
    } catch {
      setErro('Não consegui mover a demanda. O quadro foi recarregado.')
      await recarregar()
    }
  }

  async function remover(a: Atividade) {
    setExcluindo(a.id)
    try {
      await excluirAtividade(a.id)
      setAtividades((lista) => (lista ?? []).filter((x) => x.id !== a.id))
      setErro(null)
    } catch {
      setErro('Não consegui excluir a demanda.')
      await recarregar()
    } finally {
      setExcluindo(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Atividades</h1>
          <p className="text-sm text-ink-400 mt-1">
            O fluxo de atendimento do começo ao fim e quem está com cada demanda
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogo({ modo: 'novo', etapa: 'solicitado' })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova demanda
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar demanda…"
            aria-label="Buscar demanda"
            className={cn(seletor, 'pl-8 w-48')}
          />
        </div>
        <select
          value={fArtista}
          onChange={(e) => setFArtista(e.target.value)}
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
        <select
          value={fResponsavel}
          onChange={(e) => setFResponsavel(e.target.value)}
          aria-label="Filtrar por responsável"
          className={seletor}
        >
          <option value="">Todos os responsáveis</option>
          {user?.uid && <option value={user.uid}>Só as minhas</option>}
          <option value="__sem__">Sem responsável</option>
          {equipe
            .filter((u) => u.uid !== user?.uid)
            .map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.nome || u.email}
              </option>
            ))}
        </select>
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setBusca('')
              setFArtista('')
              setFResponsavel('')
            }}
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 px-2 py-2 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}

        {/* No celular desce pra uma linha só dele; no desktop cola à direita. */}
        <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto text-[11px] text-ink-500">
          <span className="num">
            <strong className="text-ink-200">{resumo.abertas}</strong> em aberto
          </span>
          {resumo.atrasadas > 0 && (
            <span className="num text-red-400 font-semibold">{resumo.atrasadas} atrasada{resumo.atrasadas === 1 ? '' : 's'}</span>
          )}
          {resumo.semDono > 0 && <span className="num">{resumo.semDono} sem responsável</span>}
        </div>
      </div>

      {erro && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-amber-200/90">{erro}</div>
        </div>
      )}

      {atividades === null ? (
        // Sem lista E com erro, quem explica é o aviso acima — repetir
        // "carregando" aqui deixaria um spinner eterno na tela.
        erro ? null : (
          <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando quadro…
          </div>
        )
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {ETAPAS.map((etapa) => {
            const cards = daEtapa(visiveis, etapa)
            const meta = etapaMeta[etapa]
            return (
              <section
                key={etapa}
                aria-label={`${meta.label} — ${cards.length} demanda${cards.length === 1 ? '' : 's'}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setColunaAlvo(etapa)
                }}
                onDragLeave={() => setColunaAlvo((c) => (c === etapa ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  setColunaAlvo(null)
                  setArrastando(null)
                  if (id) mover(id, etapa, null)
                }}
                className={cn(
                  'w-[270px] shrink-0 bg-bg-900/40 border rounded-xl flex flex-col transition-colors',
                  colunaAlvo === etapa ? 'border-violet-500/50 bg-violet-500/5' : 'border-bg-700/30',
                )}
              >
                <div className="px-3 py-3 border-b border-bg-700/30 flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full', meta.bar)} aria-hidden />
                  <span className={cn('text-xs font-bold uppercase tracking-wider', meta.text)}>
                    {meta.label}
                  </span>
                  <span className="ml-auto text-[10px] num bg-bg-800 text-ink-400 px-1.5 py-0.5 rounded font-semibold">
                    {cards.length}
                  </span>
                </div>

                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {cards.map((a) => (
                    <AtividadeCard
                      key={a.id}
                      atividade={a}
                      arrastando={arrastando === a.id}
                      excluindo={excluindo === a.id}
                      onEditar={() => setDialogo({ modo: 'editar', atividade: a })}
                      onMover={(destino) => mover(a.id, destino, null)}
                      onExcluir={() => remover(a)}
                      onArrastarInicio={() => setArrastando(a.id)}
                      onArrastarFim={() => {
                        setArrastando(null)
                        setColunaAlvo(null)
                      }}
                      onSoltarAntes={() => {
                        if (arrastando && arrastando !== a.id) mover(arrastando, etapa, a.id)
                        setArrastando(null)
                        setColunaAlvo(null)
                      }}
                    />
                  ))}

                  {cards.length === 0 && (
                    <p className="text-[11px] text-ink-600 text-center py-6 px-2">
                      {filtrando ? 'Nada com esses filtros.' : 'Arraste uma demanda pra cá.'}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDialogo({ modo: 'novo', etapa })}
                  className="m-2 mt-0 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-ink-500 hover:text-violet-300 hover:bg-bg-800/60 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar em {meta.label}
                </button>
              </section>
            )
          })}
        </div>
      )}

      {dialogo && user?.uid && (
        <AtividadeDialog
          atividade={dialogo.modo === 'editar' ? dialogo.atividade : null}
          etapaInicial={dialogo.modo === 'novo' ? dialogo.etapa : 'solicitado'}
          uid={user.uid}
          atuais={atividades ?? []}
          onClose={() => setDialogo(null)}
          onSalvo={async () => {
            setDialogo(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}

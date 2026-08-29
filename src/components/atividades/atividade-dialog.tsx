'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import {
  AREAS,
  areaMeta,
  atualizarAtividade,
  carimboConclusao,
  criarAtividade,
  etapaMeta,
  ETAPAS,
  PRIORIDADES,
  prioridadeMeta,
  listarEquipe,
  type Atividade,
  type AreaAtividade,
  type EtapaAtividade,
  type Prioridade,
} from '@/lib/atividades/client'
import type { AppUser } from '@/lib/users'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/** Formulário de criar/editar demanda do quadro. */
export function AtividadeDialog({
  atividade,
  etapaInicial,
  uid,
  atuais,
  onClose,
  onSalvo,
}: {
  atividade: Atividade | null
  /** Coluna em que o "+" foi clicado — já vem selecionada ao criar. */
  etapaInicial: EtapaAtividade
  uid: string
  /** Board atual: serve pra calcular a posição de quem entra numa coluna. */
  atuais: Atividade[]
  onClose: () => void
  onSalvo: () => void | Promise<void>
}) {
  const editando = !!atividade
  const [titulo, setTitulo] = useState(atividade?.titulo ?? '')
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '')
  const [etapa, setEtapa] = useState<EtapaAtividade>(atividade?.etapa ?? etapaInicial)
  const [prioridade, setPrioridade] = useState<Prioridade>(atividade?.prioridade ?? 'media')
  const [area, setArea] = useState<AreaAtividade | ''>(atividade?.area ?? '')
  const [prazo, setPrazo] = useState(atividade?.prazo ?? '')
  const [artistaSlug, setArtistaSlug] = useState(atividade?.artistaSlug ?? '')
  const [responsavelUid, setResponsavelUid] = useState(atividade?.responsavelUid ?? '')
  const [artistas, setArtistas] = useState<ArtistaDoc[]>([])
  const [equipe, setEquipe] = useState<AppUser[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
    listarEquipe()
      .then(setEquipe)
      .catch(() => setEquipe([]))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)
    if (!titulo.trim()) {
      setErro('Dê um título à demanda.')
      return
    }
    setSalvando(true)
    try {
      const art = artistas.find((a) => a.slug === artistaSlug)
      const resp = equipe.find((u) => u.uid === responsavelUid)
      const dados = {
        titulo,
        descricao,
        etapa,
        prioridade,
        area: area || null,
        prazo: prazo || null,
        artistaSlug: artistaSlug || null,
        artistaNome: art?.nome ?? null,
        responsavelUid: responsavelUid || null,
        responsavelNome: resp ? resp.nome || resp.email : null,
      }
      if (editando && atividade) {
        await atualizarAtividade(
          atividade.id,
          dados,
          carimboConclusao(etapa, atividade.concluidoEm),
        )
      } else {
        await criarAtividade(dados, uid, atuais)
      }
      await onSalvo()
    } catch (err) {
      setErro(
        err instanceof FirebaseError && err.code === 'permission-denied'
          ? 'Sem permissão. Confirme que você é da equipe e que as regras do Firestore estão publicadas.'
          : 'Não foi possível salvar a demanda.',
      )
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl">
          <div className="font-bold text-ink-100">{editando ? 'Editar demanda' : 'Nova demanda'}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form className="p-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="at-titulo" className={rotulo}>
              O que precisa ser feito
            </label>
            <input
              id="at-titulo"
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Roteiro do clipe de “Madrugada”"
              className={campo}
            />
          </div>

          <div>
            <div className={rotulo}>Etapa</div>
            <div className="grid grid-cols-5 gap-1.5">
              {ETAPAS.map((et) => (
                <button
                  key={et}
                  type="button"
                  onClick={() => setEtapa(et)}
                  aria-pressed={etapa === et}
                  className={cn(
                    'px-1 py-2 rounded-lg text-[10px] font-semibold border transition-colors leading-tight',
                    etapa === et
                      ? cn(etapaMeta[et].text, 'border-current bg-bg-800')
                      : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                  )}
                >
                  {etapaMeta[et].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="at-resp" className={rotulo}>
                Responsável
              </label>
              <select
                id="at-resp"
                value={responsavelUid}
                onChange={(e) => setResponsavelUid(e.target.value)}
                className={campo}
              >
                <option value="">— A definir —</option>
                {equipe.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.nome || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="at-artista" className={rotulo}>
                Artista
              </label>
              <select
                id="at-artista"
                value={artistaSlug}
                onChange={(e) => setArtistaSlug(e.target.value)}
                className={campo}
              >
                <option value="">— Interna —</option>
                {artistas.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="at-area" className={rotulo}>
                Área
              </label>
              <select
                id="at-area"
                value={area}
                onChange={(e) => setArea(e.target.value as AreaAtividade | '')}
                className={campo}
              >
                <option value="">— Nenhuma —</option>
                {AREAS.map((ar) => (
                  <option key={ar} value={ar}>
                    {areaMeta[ar].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="at-prazo" className={rotulo}>
                Prazo
              </label>
              <input
                id="at-prazo"
                type="date"
                value={prazo ?? ''}
                onChange={(e) => setPrazo(e.target.value)}
                className={cn(campo, '[color-scheme:dark]')}
              />
            </div>
          </div>

          <div>
            <div className={rotulo}>Prioridade</div>
            <div className="grid grid-cols-3 gap-2">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrioridade(p)}
                  aria-pressed={prioridade === p}
                  className={cn(
                    'px-2 py-2 rounded-lg text-xs font-semibold border transition-colors',
                    prioridade === p
                      ? prioridadeMeta[p].chip
                      : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                  )}
                >
                  {prioridadeMeta[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="at-desc" className={rotulo}>
              Detalhes (opcional)
            </label>
            <textarea
              id="at-desc"
              rows={2}
              value={descricao ?? ''}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, links, o que foi combinado…"
              className={cn(campo, 'resize-none')}
            />
          </div>

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            aria-busy={salvando}
            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando && <RefreshCw className="w-4 h-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar demanda'}
          </button>
        </form>
      </div>
    </div>
  )
}

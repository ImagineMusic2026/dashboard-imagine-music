'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RefreshCw, Trash2, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import {
  atualizarEvento,
  criarEvento,
  eventoTipoMeta,
  excluirEvento,
  type EventoAgenda,
  type EventoTipo,
} from '@/lib/agenda/client'
import { cn } from '@/lib/utils'

const TIPOS = Object.keys(eventoTipoMeta) as EventoTipo[]

/** Formulário de criar/editar evento da agenda. */
export function EventoDialog({
  evento,
  uid,
  dataInicial,
  onClose,
  onSalvo,
  onExcluido,
}: {
  evento: EventoAgenda | null
  uid: string
  /**
   * Data já preenchida ao criar. Quem abre o formulário de dentro de um
   * calendário sabe o dia; obrigar a escolher de novo o que a pessoa acabou de
   * apontar é o tipo de passo que faz a equipe voltar a marcar data no quadro.
   */
  dataInicial?: string
  onClose: () => void
  onSalvo: (dataEvento?: string) => void | Promise<void>
  /**
   * Quando existe, o formulário ganha o botão de excluir. A Agenda já tem a
   * lixeira na própria lista; quem abre o evento de outra tela (o calendário de
   * Atividades) não teria por onde desfazer um evento criado por engano.
   */
  onExcluido?: () => void | Promise<void>
}) {
  const editando = !!evento
  const [tipo, setTipo] = useState<EventoTipo>(evento?.tipo ?? 'release')
  const [titulo, setTitulo] = useState(evento?.titulo ?? '')
  const [data, setData] = useState(evento?.data ?? dataInicial ?? '')
  const [descricao, setDescricao] = useState(evento?.descricao ?? '')
  const [artistaSlug, setArtistaSlug] = useState(evento?.artistaSlug ?? '')
  const [artistas, setArtistas] = useState<ArtistaDoc[]>([])
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const tituloRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
  }, [])

  /**
   * Teclado: Esc fecha (menos no meio de uma gravação), o foco entra no título
   * ao abrir e volta para quem abriu ao fechar.
   *
   * Isso passou a pesar quando o calendário de Atividades começou a abrir este
   * formulário: lá ele é o ÚNICO caminho de teclado para mudar a data de um
   * evento, e o botão que o abriu costuma ser destruído na releitura — sem
   * devolver o foco, ele caía no `body` e a navegação voltava ao topo da página.
   */
  const ocupado = salvando || excluindo
  const abriuCom = useRef<HTMLElement | null>(null)
  useEffect(() => {
    abriuCom.current = document.activeElement as HTMLElement | null
    tituloRef.current?.focus()
    return () => {
      abriuCom.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ocupado) onClose()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onClose, ocupado])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)
    if (!titulo.trim()) {
      setErro('Dê um título ao evento.')
      return
    }
    if (!data) {
      setErro('Escolha a data do evento.')
      return
    }
    setSalvando(true)
    try {
      const art = artistas.find((a) => a.slug === artistaSlug)
      const payload = {
        tipo,
        titulo,
        descricao,
        data,
        artistaSlug: artistaSlug || null,
        artistaNome: art?.nome ?? null,
      }
      if (editando && evento) await atualizarEvento(evento.id, payload)
      else await criarEvento(payload, uid)
      await onSalvo(data)
    } catch (err) {
      const msg =
        err instanceof FirebaseError && err.code === 'permission-denied'
          ? 'Sem permissão. Confirme que você é da equipe e que as regras do Firestore estão publicadas.'
          : 'Não foi possível salvar o evento.'
      setErro(msg)
      setSalvando(false)
    }
  }

  async function remover() {
    if (!evento || !onExcluido || excluindo) return
    if (!window.confirm(`Excluir o evento “${evento.titulo}”? Isso não tem volta.`)) return
    setExcluindo(true)
    setErro(null)
    try {
      await excluirEvento(evento.id)
      await onExcluido()
    } catch {
      setErro('Não foi possível excluir o evento.')
      setExcluindo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm"
        onClick={ocupado ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-dialogo-titulo"
        className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40">
          <h2 id="ev-dialogo-titulo" className="font-bold text-ink-100">
            {editando ? 'Editar evento' : 'Novo evento'}
          </h2>
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
          <div role="group" aria-labelledby="ev-tipo-rotulo">
            <div id="ev-tipo-rotulo" className="block text-sm font-medium text-ink-300 mb-1.5">
              Tipo
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  // Sem `aria-pressed`, qual tipo está escolhido existia só na
                  // cor da borda — invisível para leitor de tela e para quem não
                  // distingue a cor.
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    'px-2 py-2 rounded-lg text-xs font-semibold border transition-colors',
                    tipo === t
                      ? cn(eventoTipoMeta[t].text, 'border-current bg-bg-800')
                      : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                  )}
                >
                  {eventoTipoMeta[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ev-titulo" className="block text-sm font-medium text-ink-300 mb-1.5">
              Título
            </label>
            <input
              id="ev-titulo"
              ref={tituloRef}
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Lançamento do single “Madrugada”"
              className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-data" className="block text-sm font-medium text-ink-300 mb-1.5">
                Data
              </label>
              <input
                id="ev-data"
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="ev-artista" className="block text-sm font-medium text-ink-300 mb-1.5">
                Artista (opcional)
              </label>
              <select
                id="ev-artista"
                value={artistaSlug}
                onChange={(e) => setArtistaSlug(e.target.value)}
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="">— Nenhum —</option>
                {artistas.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ev-desc" className="block text-sm font-medium text-ink-300 mb-1.5">
              Descrição (opcional)
            </label>
            <textarea
              id="ev-desc"
              rows={2}
              value={descricao ?? ''}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes do evento…"
              className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
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

          <div className="flex items-center gap-2">
            {editando && onExcluido && (
              <button
                type="button"
                onClick={remover}
                disabled={excluindo || salvando}
                aria-label="Excluir evento"
                className="shrink-0 p-2.5 rounded-lg border border-bg-700/50 text-ink-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-60 transition-colors"
              >
                {excluindo ? (
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="w-4 h-4" aria-hidden />
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={salvando || excluindo}
              aria-busy={salvando}
              className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {salvando && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />}
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

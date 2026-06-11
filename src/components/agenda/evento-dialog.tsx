'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import {
  atualizarEvento,
  criarEvento,
  eventoTipoMeta,
  type EventoAgenda,
  type EventoTipo,
} from '@/lib/agenda/client'
import { cn } from '@/lib/utils'

const TIPOS = Object.keys(eventoTipoMeta) as EventoTipo[]

/** Formulário de criar/editar evento da agenda. */
export function EventoDialog({
  evento,
  uid,
  onClose,
  onSalvo,
}: {
  evento: EventoAgenda | null
  uid: string
  onClose: () => void
  onSalvo: (dataEvento?: string) => void | Promise<void>
}) {
  const editando = !!evento
  const [tipo, setTipo] = useState<EventoTipo>(evento?.tipo ?? 'release')
  const [titulo, setTitulo] = useState(evento?.titulo ?? '')
  const [data, setData] = useState(evento?.data ?? '')
  const [descricao, setDescricao] = useState(evento?.descricao ?? '')
  const [artistaSlug, setArtistaSlug] = useState(evento?.artistaSlug ?? '')
  const [artistas, setArtistas] = useState<ArtistaDoc[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
  }, [])

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40">
          <div className="font-bold text-ink-100">{editando ? 'Editar evento' : 'Novo evento'}</div>
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
            <div className="block text-sm font-medium text-ink-300 mb-1.5">Tipo</div>
            <div className="grid grid-cols-4 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
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

          <button
            type="submit"
            disabled={salvando}
            aria-busy={salvando}
            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando && <RefreshCw className="w-4 h-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar evento'}
          </button>
        </form>
      </div>
    </div>
  )
}

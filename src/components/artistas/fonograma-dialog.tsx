'use client'

import { useState, type FormEvent } from 'react'
import { RefreshCw, X } from 'lucide-react'
import {
  isrcValido,
  salvarFonograma,
  type Fonograma,
} from '@/lib/fonogramas/client'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/** Formulário de cadastrar/editar fonograma do artista. */
export function FonogramaDialog({
  slug,
  fonograma,
  onClose,
  onSalvo,
}: {
  slug: string
  fonograma: Fonograma | null
  onClose: () => void
  onSalvo: () => void | Promise<void>
}) {
  const editando = !!fonograma
  const [isrc, setIsrc] = useState(fonograma?.isrc ?? '')
  const [titulo, setTitulo] = useState(fonograma?.titulo ?? '')
  const [album, setAlbum] = useState(fonograma?.album ?? '')
  const [upc, setUpc] = useState(fonograma?.upc ?? '')
  const [releaseDate, setReleaseDate] = useState(fonograma?.releaseDate ?? '')
  const [link, setLink] = useState(fonograma?.link ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)
    if (!isrcValido(isrc)) {
      setErro('O ISRC tem 12 caracteres, como BKU822500012.')
      return
    }
    if (!titulo.trim()) {
      setErro('Informe o título da faixa.')
      return
    }
    setSalvando(true)
    try {
      await salvarFonograma(slug, {
        isrc: isrc.trim().toUpperCase(),
        titulo,
        album,
        upc,
        releaseDate: releaseDate || null,
        link: link.trim() || null,
      })
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error && err.message !== 'falha' ? err.message : 'Não foi possível salvar a faixa.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl">
          <div className="font-bold text-ink-100">{editando ? 'Editar faixa' : 'Nova faixa'}</div>
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
            <label htmlFor="fg-isrc" className={rotulo}>
              ISRC
            </label>
            <input
              id="fg-isrc"
              type="text"
              required
              maxLength={12}
              value={isrc}
              // ISRC é a CHAVE do doc: mudar num doc existente criaria outra faixa
              // em vez de corrigir esta. Edição de ISRC é apagar e cadastrar de novo.
              readOnly={editando}
              onChange={(e) => setIsrc(e.target.value.toUpperCase())}
              placeholder="BKU822500012"
              className={cn(campo, 'num uppercase', editando && 'opacity-60 cursor-not-allowed')}
            />
            {editando && (
              <p className="text-[11px] text-ink-500 mt-1.5">
                O ISRC identifica a faixa e não muda. Para corrigi-lo, remova esta e cadastre outra.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="fg-titulo" className={rotulo}>
              Título
            </label>
            <input
              id="fg-titulo"
              type="text"
              required
              value={titulo ?? ''}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Madrugada"
              className={campo}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fg-album" className={rotulo}>
                Álbum
              </label>
              <input
                id="fg-album"
                type="text"
                value={album ?? ''}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Single, EP…"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="fg-lanc" className={rotulo}>
                Lançamento
              </label>
              <input
                id="fg-lanc"
                type="date"
                value={releaseDate ?? ''}
                onChange={(e) => setReleaseDate(e.target.value)}
                className={cn(campo, '[color-scheme:dark]')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="fg-upc" className={rotulo}>
              UPC (opcional)
            </label>
            <input
              id="fg-upc"
              type="text"
              inputMode="numeric"
              value={upc ?? ''}
              onChange={(e) => setUpc(e.target.value)}
              placeholder="717931990460"
              className={cn(campo, 'num')}
            />
          </div>

          <div>
            <label htmlFor="fg-link" className={rotulo}>
              Link para ouvir (opcional)
            </label>
            <input
              id="fg-link"
              type="url"
              value={link ?? ''}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className={campo}
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
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar faixa'}
          </button>
        </form>
      </div>
    </div>
  )
}

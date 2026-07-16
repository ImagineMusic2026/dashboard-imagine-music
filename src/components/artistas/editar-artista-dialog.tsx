'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2, Save, Trash2, X } from 'lucide-react'
import { auth } from '@/lib/firebase'
import {
  INPUT,
  RedeLabel,
  GeneroCombobox,
  CamposProjeto,
  projetoDeDoc,
  type DadosProjeto,
} from '@/components/artistas/artista-form-fields'
import type { ArtistaDoc, RedeSocialDoc } from '@/lib/artistas/client'

/** URL inicial do campo: a url salva ou, faltando ela, uma reconstruída do handle/id. */
function urlInicial(
  rede: RedeSocialDoc | null | undefined,
  tipo: 'spotify' | 'youtube' | 'instagram' | 'tiktok'
): string {
  if (!rede) return ''
  if (rede.url) return rede.url
  if (rede.handle) {
    if (tipo === 'youtube') return `https://youtube.com/@${rede.handle}`
    if (tipo === 'instagram') return `https://instagram.com/${rede.handle}`
    if (tipo === 'tiktok') return `https://tiktok.com/@${rede.handle}`
  }
  if (rede.id) {
    if (tipo === 'spotify') return `https://open.spotify.com/artist/${rede.id}`
    if (tipo === 'youtube') return `https://youtube.com/channel/${rede.id}`
  }
  return ''
}

/**
 * Edição de um artista já cadastrado (admin). Pré-preenche com os dados atuais.
 * Esvaziar um campo de rede REMOVE aquele vínculo no salvar; trocar a URL
 * re-mapeia. O slug não muda — renomear preserva os vínculos.
 */
export function EditarArtistaDialog({
  artista,
  onClose,
  onSaved,
  onDeleted,
}: {
  artista: ArtistaDoc
  onClose: () => void
  onSaved: () => void
  /** Chamado após excluir o artista (ex.: sair do perfil que deixou de existir). */
  onDeleted?: () => void
}) {
  const [nome, setNome] = useState(artista.nome ?? '')
  const [genero, setGenero] = useState(artista.genero ?? '')
  const [spotifyUrl, setSpotifyUrl] = useState(urlInicial(artista.redes?.spotify, 'spotify'))
  const [youtubeUrl, setYoutubeUrl] = useState(urlInicial(artista.redes?.youtube, 'youtube'))
  const [instagramUrl, setInstagramUrl] = useState(urlInicial(artista.redes?.instagram, 'instagram'))
  const [tiktokUrl, setTiktokUrl] = useState(urlInicial(artista.redes?.tiktok, 'tiktok'))
  const [projeto, setProjeto] = useState<DadosProjeto>(() => projetoDeDoc(artista))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro(null)
    if (!nome.trim()) {
      setErro('Informe o nome do artista.')
      return
    }
    setEnviando(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/artistas/atualizar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: artista.slug,
          nome,
          genero,
          spotifyUrl,
          youtubeUrl,
          instagramUrl,
          tiktokUrl,
          ...projeto,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível salvar as alterações.')
      onSaved()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao salvar.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleExcluir() {
    if (excluindo) return
    setErro(null)
    setExcluindo(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/artistas/excluir', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: artista.slug }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível excluir o artista.')
      ;(onDeleted ?? onSaved)()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao excluir.')
      setExcluindo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      {/* `max-h`/`overflow` porque o bloco Projeto deixou o form mais alto que telas baixas. */}
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 shrink-0">
          <div className="min-w-0">
            <div className="font-bold text-ink-100">Editar artista</div>
            <div className="text-[11px] text-ink-500 num truncate">{artista.slug}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form className="p-5 space-y-4 overflow-y-auto" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="edit-nome" className="block text-sm font-medium text-ink-300 mb-1.5">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              id="edit-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do artista"
              className={INPUT}
              autoFocus
            />
            <p className="text-[11px] text-ink-500 mt-1">
              O identificador (slug) não muda ao renomear — o histórico e os vínculos são preservados.
            </p>
          </div>

          <div>
            <label htmlFor="art-genero" className="block text-sm font-medium text-ink-300 mb-1.5">
              Gênero <span className="text-ink-500 font-normal text-xs">· opcional</span>
            </label>
            <GeneroCombobox value={genero} onChange={setGenero} />
          </div>

          <div>
            <RedeLabel tipo="spotify" cor="text-emerald-400" htmlFor="edit-spotify" />
            <input
              id="edit-spotify"
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder="https://open.spotify.com/artist/..."
              className={INPUT}
            />
          </div>

          <div>
            <RedeLabel tipo="youtube" cor="text-red-400" htmlFor="edit-youtube" />
            <input
              id="edit-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/@canal"
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <RedeLabel tipo="instagram" cor="text-fuchsia-400" htmlFor="edit-instagram" />
              <input
                id="edit-instagram"
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="@ ou link"
                className={INPUT}
              />
            </div>
            <div>
              <RedeLabel tipo="tiktok" cor="text-cyan-400" htmlFor="edit-tiktok" />
              <input
                id="edit-tiktok"
                type="text"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="@ ou link"
                className={INPUT}
              />
            </div>
          </div>

          <p className="text-[11px] text-ink-500 leading-relaxed">
            <strong className="text-ink-300 font-semibold">Esvazie um campo</strong> de rede para removê-lo do artista.
            Trocar a URL refaz a identificação (re-mapeia o canal/perfil).
          </p>

          <CamposProjeto valor={projeto} onChange={setProjeto} idPrefixo="edit" />

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !nome.trim()}
              aria-busy={enviando}
              className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {enviando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          {/* Zona de perigo — exclusão definitiva (confirmação em 2 passos). */}
          <div className="pt-3 mt-1 border-t border-bg-700/40">
            {!confirmando ? (
              <button
                type="button"
                onClick={() => {
                  setErro(null)
                  setConfirmando(true)
                }}
                className="w-full flex items-center justify-center gap-2 text-[13px] text-red-400/80 hover:text-red-300 hover:bg-red-500/5 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir artista
              </button>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-3">
                <div className="flex items-start gap-2 text-[13px] text-red-200/90">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    Excluir <strong className="font-semibold">{artista.nome}</strong> remove o cadastro,
                    as métricas e todo o histórico.{' '}
                    <strong className="font-semibold">Não dá pra desfazer.</strong>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={excluindo}
                    className="flex-1 bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExcluir}
                    disabled={excluindo}
                    aria-busy={excluindo}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {excluindo ? 'Excluindo…' : 'Excluir definitivamente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

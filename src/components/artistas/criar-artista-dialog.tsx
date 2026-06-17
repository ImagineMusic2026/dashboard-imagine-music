'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Loader2, UserPlus, X } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { cn } from '@/lib/utils'

type RedeRes = { url: string; id: string | null; handle: string | null } | null

type Resultado = {
  slug: string
  nome: string
  genero: string | null
  jaExistia: boolean
  redes: { spotify: RedeRes; youtube: RedeRes; instagram: RedeRes; tiktok: RedeRes }
  avisos: string[]
}

const INPUT =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

const GENEROS = ['Sertanejo', 'Piseiro', 'Forró', 'Pagode', 'Funk', 'Gospel', 'MPB', 'Pop', 'Rock', 'Rap', 'Arrocha', 'Brega', 'Axé', 'Eletrônica']

function RedeLabel({ tipo, cor, htmlFor }: { tipo: PlataformaTipo; cor: string; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-1.5 capitalize">
      <span className={cn('w-4 h-4 block', cor)}>
        <PlataformaIcon tipo={tipo} />
      </span>
      {tipo}
      <span className="text-ink-500 font-normal text-xs lowercase">· opcional</span>
    </label>
  )
}

export function CriarArtistaDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState('')
  const [genero, setGenero] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

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
      const res = await fetch('/api/artistas/criar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, genero, spotifyUrl, youtubeUrl, instagramUrl, tiktokUrl }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível salvar o artista.')
      setResultado(data as Resultado)
      onCreated()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao salvar.')
    } finally {
      setEnviando(false)
    }
  }

  function adicionarOutro() {
    setNome('')
    setGenero('')
    setSpotifyUrl('')
    setYoutubeUrl('')
    setInstagramUrl('')
    setTiktokUrl('')
    setResultado(null)
    setErro(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40">
          <div className="font-bold text-ink-100">{resultado ? 'Artista salvo' : 'Adicionar artista'}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {resultado ? (
          <ResultadoArtista resultado={resultado} onOutro={adicionarOutro} onConcluir={onClose} />
        ) : (
          <form className="p-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="art-nome" className="block text-sm font-medium text-ink-300 mb-1.5">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                id="art-nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do artista"
                className={INPUT}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="art-genero" className="block text-sm font-medium text-ink-300 mb-1.5">
                Gênero <span className="text-ink-500 font-normal text-xs">· opcional</span>
              </label>
              <input
                id="art-genero"
                type="text"
                list="generos-sugestoes"
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
                placeholder="Ex.: Sertanejo, Piseiro, Forró…"
                className={INPUT}
              />
              <datalist id="generos-sugestoes">
                {GENEROS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>

            <div>
              <RedeLabel tipo="spotify" cor="text-emerald-400" htmlFor="art-spotify" />
              <input
                id="art-spotify"
                type="url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/artist/..."
                className={INPUT}
              />
            </div>

            <div>
              <RedeLabel tipo="youtube" cor="text-red-400" htmlFor="art-youtube" />
              <input
                id="art-youtube"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/@canal"
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <RedeLabel tipo="instagram" cor="text-fuchsia-400" htmlFor="art-instagram" />
                <input
                  id="art-instagram"
                  type="text"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="@ ou link"
                  className={INPUT}
                />
              </div>
              <div>
                <RedeLabel tipo="tiktok" cor="text-cyan-400" htmlFor="art-tiktok" />
                <input
                  id="art-tiktok"
                  type="text"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="@ ou link"
                  className={INPUT}
                />
              </div>
            </div>

            <p className="text-[11px] text-ink-500 leading-relaxed">
              Cole o link do perfil — o sistema extrai sozinho o ID do Spotify e os @ de cada rede. Só o nome é
              obrigatório.
            </p>

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
              disabled={enviando || !nome.trim()}
              aria-busy={enviando}
              className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {enviando ? 'Salvando…' : 'Salvar artista'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ResultadoArtista({
  resultado,
  onOutro,
  onConcluir,
}: {
  resultado: Resultado
  onOutro: () => void
  onConcluir: () => void
}) {
  const r = resultado
  const linhas: { tipo: PlataformaTipo; cor: string; valor: string | null }[] = [
    { tipo: 'spotify', cor: 'text-emerald-400', valor: r.redes.spotify?.id ? `ID ${r.redes.spotify.id}` : null },
    {
      tipo: 'youtube',
      cor: 'text-red-400',
      valor: r.redes.youtube ? (r.redes.youtube.id ?? (r.redes.youtube.handle ? `@${r.redes.youtube.handle}` : 'link salvo')) : null,
    },
    { tipo: 'instagram', cor: 'text-fuchsia-400', valor: r.redes.instagram?.handle ? `@${r.redes.instagram.handle}` : null },
    { tipo: 'tiktok', cor: 'text-cyan-400', valor: r.redes.tiktok?.handle ? `@${r.redes.tiktok.handle}` : null },
  ]

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 grid place-items-center shrink-0">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-ink-100">{r.nome}</div>
          <div className="text-[12px] text-ink-500 num">
            {r.jaExistia ? 'já existia — dados atualizados' : 'criado'} · {r.slug}
          </div>
          {r.genero && <div className="text-[12px] text-ink-400 mt-0.5">{r.genero}</div>}
        </div>
      </div>

      <div className="space-y-1.5">
        {linhas.map(({ tipo, cor, valor }) => (
          <div key={tipo} className="flex items-center gap-2 text-sm">
            <span className={cn('w-4 h-4 block shrink-0', valor ? cor : 'text-ink-700')}>
              <PlataformaIcon tipo={tipo} />
            </span>
            <span className="capitalize text-ink-300 w-20 shrink-0">{tipo}</span>
            <span className={cn('num truncate', valor ? 'text-ink-200' : 'text-ink-600')}>{valor ?? 'não informado'}</span>
          </div>
        ))}
      </div>

      {r.avisos.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200/90 space-y-1">
            {r.avisos.map((a, i) => (
              <div key={i}>{a}</div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onOutro}
          className="flex-1 bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          Adicionar outro
        </button>
        <button
          type="button"
          onClick={onConcluir}
          className="flex-1 bg-violet-500 hover:bg-violet-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          Concluir
        </button>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Lock, Users2, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import type { RosterArtist } from '@/lib/roster/types'
import { cn } from '@/lib/utils'

type Resumo = {
  totais: { total: number; comSpotifyId: number; comYoutube: number; comInstagram: number; comTiktok: number }
  avisos: string[]
  artistas: RosterArtist[]
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'text-[10px] px-1.5 py-0.5 rounded num',
        ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-bg-800 text-ink-600'
      )}
    >
      {label}
    </span>
  )
}

export function ImportadorRoster() {
  const { role, loading } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resumo | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)

  const ehAdmin = role === 'admin'

  const enviar = useCallback(async (file: File) => {
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    setEnviando(true)
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Envie a planilha .xlsx do cadastro.')
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/importar/roster', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível importar o cadastro.')
      setResultado(data.resumo as Resumo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao importar.')
    } finally {
      setEnviando(false)
    }
  }, [])

  const abrirSeletor = () => inputRef.current?.click()
  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void enviar(file)
  }

  if (loading) return null
  if (!ehAdmin) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex items-center gap-3 text-sm text-ink-400">
        <Lock className="w-4 h-4 text-ink-600" /> Importação restrita a administradores.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void enviar(file)
          e.target.value = ''
        }}
      />

      <div
        onClick={enviando ? undefined : abrirSeletor}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          enviando ? 'cursor-wait' : 'cursor-pointer',
          arrastando ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-bg-700/60 bg-bg-900/30 hover:bg-bg-900/50'
        )}
      >
        {enviando ? (
          <>
            <Loader2 className="w-9 h-9 text-cyan-400 mx-auto mb-3 animate-spin" />
            <h3 className="font-semibold text-ink-100">Processando {nomeArquivo}…</h3>
          </>
        ) : (
          <>
            <Users2 className="w-9 h-9 text-ink-500 mx-auto mb-3" />
            <h3 className="font-semibold text-ink-100">Arraste a planilha de cadastro (redes sociais)</h3>
            <p className="text-sm text-ink-400 mt-1">
              ou clique pra escolher · extrai Spotify ID, YouTube, Instagram e TikTok de cada artista
            </p>
          </>
        )}
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-200/90">{erro}</div>
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar">
            <X className="w-4 h-4 text-red-300/60 hover:text-red-300" />
          </button>
        </div>
      )}

      {resultado && <ResultadoRoster resumo={resultado} onFechar={() => setResultado(null)} />}
    </div>
  )
}

function ResultadoRoster({ resumo, onFechar }: { resumo: Resumo; onFechar: () => void }) {
  const t = resumo.totais
  return (
    <div className="bg-bg-900 border border-cyan-500/30 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-bg-700/30 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 grid place-items-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="font-bold text-ink-100 text-lg">{fmtInt(t.total)} artistas cadastrados</div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              Spotify ID {t.comSpotifyId}/{t.total} · YouTube {t.comYoutube}/{t.total} · Instagram{' '}
              {t.comInstagram}/{t.total} · TikTok {t.comTiktok}/{t.total}
            </div>
          </div>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="shrink-0">
          <X className="w-4 h-4 text-ink-500 hover:text-ink-300" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-bg-700/30">
        {resumo.artistas.map((a) => (
          <div key={a.slug} className="flex items-center gap-3 px-5 py-2.5">
            <span className="font-medium text-sm text-ink-100 w-44 truncate shrink-0">{a.nome}</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              <Chip ok={!!a.spotify?.id} label={a.spotify?.id ? `spotify:${a.spotify.id.slice(0, 6)}…` : 'spotify ✕'} />
              <Chip ok={!!a.youtube?.url} label="youtube" />
              <Chip ok={!!a.instagram?.handle} label={a.instagram?.handle ? `@${a.instagram.handle}` : 'ig ✕'} />
              <Chip ok={!!a.tiktok?.handle} label={a.tiktok?.handle ? `@${a.tiktok.handle}` : 'tiktok ✕'} />
            </div>
          </div>
        ))}
      </div>

      {resumo.avisos.length > 0 && (
        <div className="border-t border-bg-700/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200/90 space-y-1">
            {resumo.avisos.map((a, i) => (
              <div key={i}>{a}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

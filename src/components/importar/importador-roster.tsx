'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AlertTriangle, CheckCircle2, FileDown, Loader2, Lock, Users2, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { RevisarRosterDialog } from '@/components/importar/revisar-roster-dialog'
import type { AnaliseRoster, DecisoesRoster, RosterArtist } from '@/lib/roster/types'
import { cn } from '@/lib/utils'

type Resumo = {
  totais: { total: number; comSpotifyId: number; comYoutube: number; comInstagram: number; comTiktok: number }
  avisos: string[]
  artistas: RosterArtist[]
}

type Recente = {
  id: string
  arquivoNome: string
  tamanhoBytes: number
  total: number
  criadoEmISO: string | null
  criadoPorEmail: string
}

type Revisao = {
  analise: AnaliseRoster
  arquivoNome: string
  tamanhoBytes: number
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Uma rede com decisão "manter" fica FORA da importação (a conta do painel é
 * preservada) — mas no card de resultado ela apareceria como ausente ("✕").
 * Aqui repomos, só pra exibição, a conta mantida e recalculamos os totais.
 */
function reporContasMantidas(resumo: Resumo, analise: AnaliseRoster, decisoes: DecisoesRoster): Resumo {
  const porSlug = new Map(analise.artistas.map((x) => [x.artista.slug, x]))
  const artistas = resumo.artistas.map((a) => {
    const dec = decisoes[a.slug]
    const conflitos = porSlug.get(a.slug)?.conflitos
    if (!dec || !conflitos) return a
    const patch: Partial<RosterArtist> = {}
    for (const c of conflitos) {
      if (dec[c.rede] === 'manter') patch[c.rede] = c.atual
    }
    return { ...a, ...patch }
  })
  return {
    ...resumo,
    artistas,
    totais: {
      total: artistas.length,
      comSpotifyId: artistas.filter((a) => a.spotify?.id).length,
      comYoutube: artistas.filter((a) => a.youtube?.url).length,
      comInstagram: artistas.filter((a) => a.instagram?.url).length,
      comTiktok: artistas.filter((a) => a.tiktok?.url).length,
    },
  }
}

const fmtTamanho = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)}MB` : b >= 1024 ? `${(b / 1024).toFixed(0)}KB` : `${b}B`

const formatarData = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

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
  const [analiseTotais, setAnaliseTotais] = useState<AnaliseRoster['totais'] | null>(null)
  const [revisao, setRevisao] = useState<Revisao | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [baixandoModelo, setBaixandoModelo] = useState(false)
  const [recentes, setRecentes] = useState<Recente[]>([])

  const ehAdmin = role === 'admin'

  const carregarRecentes = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch('/api/importar/roster', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.cadastros) setRecentes(data.cadastros)
    } catch {
      /* lista é secundária */
    }
  }, [])

  useEffect(() => {
    if (ehAdmin) void carregarRecentes()
  }, [ehAdmin, carregarRecentes])

  /** Fase 2: grava a importação com as decisões de conflito (se houver). */
  const confirmar = useCallback(
    async (rev: Revisao, decisoes: DecisoesRoster) => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/importar/roster/confirmar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arquivoNome: rev.arquivoNome,
          tamanhoBytes: rev.tamanhoBytes,
          artistas: rev.analise.artistas.map((x) => x.artista),
          decisoes,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível importar o cadastro.')
      setResultado(reporContasMantidas(data.resumo as Resumo, rev.analise, decisoes))
      setAnaliseTotais(rev.analise.totais)
      void carregarRecentes()
    },
    [carregarRecentes]
  )

  /**
   * Fase 1: envia a planilha pra ANÁLISE (nada é gravado). Sem conflito com o
   * cadastro atual, confirma direto; com conflito, abre a revisão um a um.
   */
  const enviar = useCallback(
    async (file: File) => {
      setErro(null)
      setResultado(null)
      setAnaliseTotais(null)
      setNomeArquivo(file.name)
      setEnviando(true)
      try {
        if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Envie a planilha .xlsx do cadastro.')
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/importar/roster/analisar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Não foi possível analisar a planilha.')
        const analise = data.analise as AnaliseRoster
        const rev: Revisao = { analise, arquivoNome: file.name, tamanhoBytes: file.size }
        if (analise.totais.comConflito > 0) {
          setRevisao(rev)
        } else {
          await confirmar(rev, {})
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro inesperado ao importar.')
      } finally {
        setEnviando(false)
      }
    },
    [confirmar]
  )

  const baixarModelo = useCallback(async () => {
    if (baixandoModelo) return
    setErro(null)
    setBaixandoModelo(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/importar/roster/modelo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Não foi possível gerar o modelo.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'modelo-cadastro-artistas.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao baixar o modelo.')
    } finally {
      setBaixandoModelo(false)
    }
  }, [baixandoModelo])

  const abrirSeletor = () => inputRef.current?.click()
  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastando(false)
    if (enviando) return // o clique já é bloqueado; sem isso o drop dispararia 2 importações em paralelo
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

      <div className="flex justify-end -mt-2">
        <button
          type="button"
          onClick={() => void baixarModelo()}
          disabled={baixandoModelo}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
        >
          {baixandoModelo ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileDown className="w-3.5 h-3.5" />
          )}
          Baixar modelo da planilha (.xlsx)
        </button>
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

      {resultado && (
        <ResultadoRoster
          resumo={resultado}
          analiseTotais={analiseTotais}
          onFechar={() => {
            setResultado(null)
            setAnaliseTotais(null)
          }}
        />
      )}

      {revisao && (
        <RevisarRosterDialog
          analise={revisao.analise}
          arquivoNome={revisao.arquivoNome}
          onCancelar={() => setRevisao(null)}
          onConfirmar={async (decisoes) => {
            await confirmar(revisao, decisoes)
            setRevisao(null)
          }}
        />
      )}

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
          <h3 className="font-bold text-ink-100">Importações recentes</h3>
          <span className="text-[11px] text-ink-500 num">{recentes.length} no total</span>
        </div>
        {recentes.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">
            Nenhuma importação de cadastro ainda.
          </div>
        ) : (
          <div className="divide-y divide-bg-700/30">
            {recentes.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors">
                <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-cyan-500/15 text-cyan-400">
                  <Users2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-ink-100 truncate">{c.arquivoNome}</span>
                    <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      PROCESSADO
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 num mt-0.5">
                    {c.criadoPorEmail} · {fmtTamanho(c.tamanhoBytes)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-sm font-bold text-ink-200">{fmtInt(c.total)} artistas</div>
                  <div className="text-[11px] text-ink-500 num">{formatarData(c.criadoEmISO)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultadoRoster({
  resumo,
  analiseTotais,
  onFechar,
}: {
  resumo: Resumo
  analiseTotais: AnaliseRoster['totais'] | null
  onFechar: () => void
}) {
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
            {analiseTotais && (
              <div className="text-[12px] text-ink-500 mt-0.5">
                {analiseTotais.novos} novos · {analiseTotais.atualizados} atualizados ·{' '}
                {analiseTotais.iguais} sem mudança
                {analiseTotais.comConflito > 0 && <> · {analiseTotais.comConflito} revisados</>}
              </div>
            )}
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

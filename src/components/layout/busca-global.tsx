'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { SEV, ICONE_ALERTA } from '@/components/alertas/alerta-linha'
import { corAvatarDe, iniciaisDe, listarArtistas } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { derivarAlertas, type SeveridadeAlerta } from '@/lib/alertas/derivar'
import { cn } from '@/lib/utils'

type Artista = { tipo: 'artista'; slug: string; nome: string }
type Alerta = {
  tipo: 'alerta'
  slug: string
  nome: string
  descricao: string
  sev: SeveridadeAlerta
  categoria: string
  url: string | null
}
type Conteudo = {
  tipo: 'conteudo'
  titulo: string
  nome: string
  plataforma: 'youtube' | 'instagram'
  url: string | null
}
type Resultado = Artista | Alerta | Conteudo

const LIMITE = 6
const ROTULO: Record<Resultado['tipo'], string> = {
  artista: 'Artistas',
  alerta: 'Alertas',
  conteudo: 'Conteúdos',
}

/**
 * Busca global (⌘K): procura em artistas, alertas e conteúdos — todos derivados
 * das MESMAS libs do resto do painel (sem índice novo). Carrega os dados uma vez
 * na 1ª abertura; navega por teclado (setas/Enter/Esc). O `aberto`/`onFechar`
 * são controlados pela topbar.
 */
export function BuscaGlobal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [carregado, setCarregado] = useState(false)
  const [artistas, setArtistas] = useState<{ slug: string; nome: string }[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [conteudos, setConteudos] = useState<Conteudo[]>([])

  // Carrega os dados uma vez, na 1ª abertura.
  useEffect(() => {
    if (!aberto || carregado) return
    let vivo = true
    ;(async () => {
      try {
        const [arts, mapa] = await Promise.all([listarArtistas(), listarMetricasSociais()])
        if (!vivo) return
        const nomePorSlug = new Map(arts.map((a) => [a.slug, a.nome]))
        setArtistas(arts.map((a) => ({ slug: a.slug, nome: a.nome })))
        setAlertas(
          derivarAlertas(mapa, nomePorSlug).map((a) => ({
            tipo: 'alerta',
            slug: a.artistaSlug,
            nome: a.artistaNome,
            descricao: a.descricao,
            sev: a.severidade,
            categoria: a.categoria,
            url: a.url,
          })),
        )
        const cont: Conteudo[] = []
        for (const [slug, doc] of Array.from(mapa)) {
          const n = nomePorSlug.get(slug) ?? slug
          for (const v of doc.youtube?.videosRecentes ?? [])
            cont.push({ tipo: 'conteudo', titulo: v.titulo, nome: n, plataforma: 'youtube', url: v.url })
          for (const p of doc.instagram?.postsRecentes ?? [])
            cont.push({
              tipo: 'conteudo',
              titulo: p.legenda?.trim() || '(sem legenda)',
              nome: n,
              plataforma: 'instagram',
              url: p.permalink,
            })
        }
        setConteudos(cont)
        setCarregado(true)
      } catch {
        /* sem dados — a busca apenas não mostra resultados */
      }
    })()
    return () => {
      vivo = false
    }
  }, [aberto, carregado])

  // Reseta e foca ao abrir.
  useEffect(() => {
    if (!aberto) return
    setQ('')
    setSel(0)
    const id = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(id)
  }, [aberto])

  const resultados = useMemo<Resultado[]>(() => {
    const termo = q.trim().toLowerCase()
    if (!termo) return []
    const arts: Resultado[] = artistas
      .filter((a) => a.nome.toLowerCase().includes(termo))
      .slice(0, LIMITE)
      .map((a) => ({ tipo: 'artista', slug: a.slug, nome: a.nome }))
    const als = alertas
      .filter((a) => a.nome.toLowerCase().includes(termo) || a.descricao.toLowerCase().includes(termo))
      .slice(0, LIMITE)
    const conts = conteudos
      .filter((c) => c.titulo.toLowerCase().includes(termo) || c.nome.toLowerCase().includes(termo))
      .slice(0, LIMITE)
    return [...arts, ...als, ...conts]
  }, [q, artistas, alertas, conteudos])

  useEffect(() => {
    setSel(0)
  }, [q])

  // Mantém o item selecionado visível ao navegar com as setas.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!aberto) return null

  function ativar(r: Resultado) {
    if (r.tipo === 'artista') router.push(`/artistas/${r.slug}`)
    else if (r.tipo === 'alerta') {
      if (r.url?.startsWith('/')) router.push(r.url)
      else if (r.url) window.open(r.url, '_blank', 'noopener')
      else router.push('/alertas')
    } else if (r.tipo === 'conteudo' && r.url) {
      window.open(r.url, '_blank', 'noopener')
    }
    onFechar()
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onFechar()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = resultados[sel]
      if (r) ativar(r)
    }
  }

  const termo = q.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm animate-fade-in" onClick={onFechar} />

      <div className="relative w-full max-w-xl bg-bg-900 border border-bg-700/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-bg-700/40">
          <Search className="w-4 h-4 text-ink-500 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar artista, alerta, conteúdo…"
            className="flex-1 bg-transparent py-3.5 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
          <kbd className="text-[10px] text-ink-500 bg-bg-800 px-1.5 py-0.5 rounded shrink-0">esc</kbd>
        </div>

        <div ref={listaRef} className="max-h-[60vh] overflow-y-auto py-2">
          {!termo ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-500">
              Digite para buscar artistas, alertas e conteúdos.
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-500">
              Nenhum resultado para “{termo}”.
            </p>
          ) : (
            resultados.map((r, i) => {
              const cabecalho = i === 0 || resultados[i - 1].tipo !== r.tipo
              return (
                <div key={`${r.tipo}-${i}`}>
                  {cabecalho && (
                    <div className="px-4 pt-3 pb-1 text-[10px] tracking-wider text-ink-500 font-semibold uppercase">
                      {ROTULO[r.tipo]}
                    </div>
                  )}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseMove={() => setSel(i)}
                    onClick={() => ativar(r)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                      sel === i ? 'bg-violet-500/10' : 'hover:bg-bg-800/40',
                    )}
                  >
                    <Linha r={r} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-bg-700/40 flex items-center gap-4 text-[11px] text-ink-600">
          <span>
            <kbd className="text-ink-400">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="text-ink-400">↵</kbd> abrir
          </span>
          <span>
            <kbd className="text-ink-400">esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  )
}

function Linha({ r }: { r: Resultado }) {
  if (r.tipo === 'artista') {
    return (
      <>
        <AvatarFallback iniciais={iniciaisDe(r.nome)} gradient={corAvatarDe(r.slug)} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink-100 font-medium truncate">{r.nome}</div>
        </div>
        <span className="text-[11px] text-ink-600 shrink-0">Artista</span>
      </>
    )
  }
  if (r.tipo === 'alerta') {
    const sev = SEV[r.sev]
    const Icone = ICONE_ALERTA[r.categoria] ?? Search
    return (
      <>
        <span className={cn('w-7 h-7 rounded-lg grid place-items-center shrink-0', sev.badgeBg)}>
          <Icone className={cn('w-4 h-4', sev.badgeText)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink-100 font-medium truncate">{r.nome}</div>
          <div className="text-[12px] text-ink-400 truncate">{r.descricao}</div>
        </div>
        <span className={cn('text-[10px] font-bold tracking-wider shrink-0', sev.badgeText)}>{sev.label}</span>
      </>
    )
  }
  return (
    <>
      <span
        className={cn(
          'w-7 h-7 rounded-lg grid place-items-center shrink-0',
          r.plataforma === 'youtube' ? 'text-red-400 bg-red-500/10' : 'text-fuchsia-400 bg-fuchsia-500/10',
        )}
      >
        <span className="w-4 h-4 block">
          <PlataformaIcon tipo={r.plataforma as PlataformaTipo} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink-100 font-medium truncate">{r.titulo}</div>
        <div className="text-[12px] text-ink-500 truncate">{r.nome}</div>
      </div>
      <span className="text-[11px] text-ink-600 shrink-0 capitalize">{r.plataforma}</span>
    </>
  )
}

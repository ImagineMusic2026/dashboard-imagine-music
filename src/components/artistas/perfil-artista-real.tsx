'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Loader2, Pencil, Plug } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { HealthScoreArtistaCard } from '@/components/artistas/health-score-card'
import { ResumoExecutivoArtista } from '@/components/artistas/resumo-executivo-artista'
import { InsightsArtistaCard } from '@/components/artistas/insights-artista-card'
import { ComparativoCanaisCard } from '@/components/artistas/comparativo-canais-card'
import { InstagramArtistaCard } from '@/components/artistas/instagram-artista-card'
import { TikTokArtistaCard } from '@/components/artistas/tiktok-artista-card'
import { YouTubeArtistaCard } from '@/components/artistas/youtube-artista-card'
import { StreamingArtistaCard } from '@/components/artistas/streaming-artista-card'
import { StreamingAnaliticoCard } from '@/components/artistas/streaming-analitico-card'
import { ConectarPlataforma } from '@/components/artistas/conectar-plataforma'
import { ReceitaArtistaCard } from '@/components/artistas/receita-artista-card'
import { ReceitaGate } from '@/components/auth/receita-gate'
import { EditarArtistaDialog } from '@/components/artistas/editar-artista-dialog'
import { ProjetoArtistaCard } from '@/components/artistas/projeto-artista-card'
import { DiagnosticoArtistaCard } from '@/components/artistas/diagnostico-artista-card'
import { useAuth } from '@/components/auth/auth-provider'
import {
  corAvatarDe,
  getArtista,
  iniciaisDe,
  type ArtistaDoc,
  type RedeSocialDoc,
} from '@/lib/artistas/client'
import { cn } from '@/lib/utils'

type EstadoReal = { st: 'load' } | { st: 'erro' } | { st: 'vazio' } | { st: 'ok'; a: ArtistaDoc }

const LINKS: { tipo: PlataformaTipo; nome: string; cor: string; get: (a: ArtistaDoc) => RedeSocialDoc | null | undefined }[] = [
  { tipo: 'spotify', nome: 'Spotify', cor: 'text-emerald-400', get: (a) => a.redes?.spotify },
  { tipo: 'youtube', nome: 'YouTube', cor: 'text-red-400', get: (a) => a.redes?.youtube },
  { tipo: 'instagram', nome: 'Instagram', cor: 'text-fuchsia-400', get: (a) => a.redes?.instagram },
  { tipo: 'tiktok', nome: 'TikTok', cor: 'text-cyan-400', get: (a) => a.redes?.tiktok },
]

export function PerfilArtistaReal({
  slug,
  mostrarVoltar = true,
}: {
  slug: string
  /** Esconde o link "← Artistas" (usado no portal do artista, que não tem roster). */
  mostrarVoltar?: boolean
}) {
  const { role } = useAuth()
  const router = useRouter()
  const ehAdmin = role === 'admin'
  const [estado, setEstado] = useState<EstadoReal>({ st: 'load' })
  const [editando, setEditando] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let vivo = true
    getArtista(slug)
      .then((a) => {
        if (!vivo) return
        setEstado(a ? { st: 'ok', a } : { st: 'vazio' })
      })
      .catch(() => vivo && setEstado({ st: 'erro' }))
    return () => {
      vivo = false
    }
  }, [slug, nonce])

  if (estado.st === 'load') {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando artista…
      </div>
    )
  }

  if (estado.st === 'erro' || estado.st === 'vazio') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">
          {estado.st === 'vazio' ? 'Artista não encontrado' : 'Não foi possível carregar'}
        </h1>
        <p className="text-sm text-ink-400 mt-2">
          {estado.st === 'vazio'
            ? `Nenhum artista com o identificador "${slug}". Ele pode não ter sido importado ainda.`
            : 'Verifique se você é admin e se as regras do Firestore estão deployadas.'}
        </p>
        <Link href="/artistas" className="inline-block mt-4 text-violet-400 hover:text-violet-300 text-sm">
          ← Voltar pra lista
        </Link>
      </div>
    )
  }

  const a = estado.a
  const links = LINKS.map((l) => ({ ...l, rede: l.get(a) })).filter((l) => l.rede?.url)

  return (
    <div className="space-y-6 animate-fade-in">
      {mostrarVoltar && (
        <Link href="/artistas" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200">
          <ArrowLeft className="w-4 h-4" /> Artistas
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
          <AvatarFallback iniciais={iniciaisDe(a.nome)} gradient={corAvatarDe(a.slug)} size="xl" />
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] tracking-wider font-semibold uppercase text-ink-400 mb-1">
            <span>{a.label ?? 'Imagine Music'}</span>
            <span className="text-ink-600">·</span>
            <span className="text-cyan-400">CADASTRO REAL</span>
          </div>
          <h1 className="text-3xl font-bold text-ink-100">{a.nome}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {links.length ? (
              links.map((l) => (
                <a
                  key={l.tipo}
                  href={l.rede!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-[12px] text-ink-200 transition-colors"
                >
                  <span className={cn('w-3.5 h-3.5 block', l.cor)}>
                    <PlataformaIcon tipo={l.tipo} />
                  </span>
                  {l.nome}
                  <ExternalLink className="w-3 h-3 text-ink-500" />
                </a>
              ))
            ) : (
              <span className="text-[12px] text-ink-500">Sem links de redes cadastrados.</span>
            )}
          </div>
        </div>
        </div>

        {/* Conexões — gera link de autorização (admin) ou o próprio artista conecta.
            Cada ícone abre um popover com a explicação e o botão. Some pra marketing. */}
        <div className="flex items-center gap-2 shrink-0">
          <ConectarPlataforma plataforma="tiktok" slug={a.slug} />
          <ConectarPlataforma plataforma="youtube" slug={a.slug} />
          {ehAdmin && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-xs font-semibold transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Faixa executiva — o artista em 10 segundos (KPIs cross-plataforma). */}
      <ResumoExecutivoArtista slug={a.slug} nome={a.nome} />

      {/* O que merece atenção — alertas do próprio artista + diagnóstico do Health. */}
      <InsightsArtistaCard slug={a.slug} nome={a.nome} />

      {/* Health Score — score real consolidado (mesma lib da home) */}
      <HealthScoreArtistaCard slug={a.slug} nome={a.nome} />

      {/* Canais — comparativo lado a lado; clique rola até o card (âncoras abaixo). */}
      <ComparativoCanaisCard slug={a.slug} />

      {/* Instagram — métricas reais via Meta (visíveis a todos os membros) */}
      <div id="card-instagram" className="scroll-mt-20">
        <InstagramArtistaCard slug={a.slug} />
      </div>

      {/* TikTok — métricas reais via Display API (visíveis a todos os membros) */}
      <div id="card-tiktok" className="scroll-mt-20">
        <TikTokArtistaCard slug={a.slug} />
      </div>

      {/* YouTube — base pública (Data API) + Analytics (OAuth) para quem conectar */}
      <div id="card-youtube" className="scroll-mt-20">
        <YouTubeArtistaCard slug={a.slug} />
      </div>

      {/* Streaming — plays/skips reais via OneRPM (não sensível, visível a todos). */}
      <div id="card-streaming" className="scroll-mt-20">
        <StreamingArtistaCard slug={a.slug} />
      </div>

      {/* Análise de streaming (Fase 1): faixas por skip + geografia. */}
      <StreamingAnaliticoCard slug={a.slug} />

      {/* Receita — só admin (lê a coleção `receitas`); o card cuida do estado vazio. */}
      <ReceitaGate>
        <ReceitaArtistaCard slug={a.slug} fallbackItems={[]} />
      </ReceitaGate>

      {/* Projeto — cadastro comercial, SÓ staff (o portal do artista renderiza este
          mesmo perfil). O card se autoprotege e some quando nada foi preenchido. */}
      <ProjetoArtistaCard slug={a.slug} />

      {/* Diagnóstico — o que o artista respondeu no portal. Também só staff. */}
      <DiagnosticoArtistaCard slug={a.slug} />

      {/* Redes cadastradas */}
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30 font-bold text-ink-100">Redes sociais</div>
        <div className="divide-y divide-bg-700/30">
          {LINKS.map((l) => {
            const rede = l.get(a)
            return (
              <div key={l.tipo} className="flex items-center gap-3 px-5 py-3">
                <span className={cn('w-5 h-5 block shrink-0', rede?.url ? l.cor : 'text-ink-700')}>
                  <PlataformaIcon tipo={l.tipo} />
                </span>
                <span className="text-sm text-ink-200 w-24 shrink-0">{l.nome}</span>
                {rede?.url ? (
                  <a
                    href={rede.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] num text-violet-400 hover:text-violet-300 truncate"
                  >
                    {rede.handle ? `@${rede.handle}` : rede.id ? `id: ${rede.id}` : rede.url}
                  </a>
                ) : (
                  <span className="text-[12px] text-ink-600">— sem link</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pendente de integração */}
      <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-bg-800 grid place-items-center shrink-0">
          <Plug className="w-5 h-5 text-ink-500" />
        </div>
        <div>
          <div className="font-semibold text-ink-200 text-sm">Demais métricas aguardando integração</div>
          <p className="text-[13px] text-ink-400 mt-0.5 max-w-2xl">
            Instagram (via Meta), TikTok e YouTube já são coletados (cards acima) e alimentam o
            Health Score. Spotify entra conforme as próximas integrações forem conectadas. O
            cadastro de redes acima é a chave pra buscar esses números.
          </p>
        </div>
      </div>

      {editando && ehAdmin && (
        <EditarArtistaDialog
          artista={a}
          onClose={() => setEditando(false)}
          onSaved={() => setNonce((n) => n + 1)}
          onDeleted={() => router.push('/artistas')}
        />
      )}
    </div>
  )
}

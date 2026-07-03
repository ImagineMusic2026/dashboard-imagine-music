'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, HeartPulse, ShieldCheck } from 'lucide-react'
import { AlertaLinha } from '@/components/alertas/alerta-linha'
import { derivarAlertas, type AlertaDerivado } from '@/lib/alertas/derivar'
import { derivarHealthScores, motivoDominante } from '@/lib/health/score'
import { getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import { cn } from '@/lib/utils'

/**
 * "O que merece atenção" — os alertas REAIS do próprio artista dentro do
 * perfil, com a mesma derivação (e o mesmo componente de linha) da página
 * /alertas: derivarAlertas sobre um mapa de UM artista, zero leitura extra
 * (o doc vem do cache do perfil). Quando os alertas são poucos, entra uma
 * linha de diagnóstico com o pilar mais fraco do Health Score e uma ação
 * sugerida. Sem nada a apontar, o card diz isso honestamente.
 */

type Estado =
  | { st: 'load' }
  | { st: 'vazio' }
  | { st: 'ok'; alertas: AlertaDerivado[]; motivo: string | null }

const MAX_LINHAS = 4

/** Ação sugerida por diagnóstico do pilar mais fraco (réguas da metodologia). */
const ACAO_MOTIVO: Record<string, { dica: string; href: string | null; acao: string | null }> = {
  'Perdendo seguidores': { dica: 'Vale investigar as quedas recentes.', href: '/alertas', acao: 'Ver alertas' },
  'Engajamento baixo': { dica: 'Compare os formatos que mais respondem.', href: '/conteudo', acao: 'Ver conteúdo' },
  'Postando pouco': { dica: 'Planeje as próximas publicações.', href: '/agenda', acao: 'Abrir agenda' },
  'Audiência pequena': { dica: 'Colabs e divulgação cruzada ajudam a ampliar a base.', href: null, acao: null },
  'Streaming baixo': { dica: 'Veja faixas e skips na análise de streaming abaixo.', href: '#card-streaming', acao: 'Ir pro streaming' },
}

export function InsightsArtistaCard({ slug, nome }: { slug: string; nome: string }) {
  const [estado, setEstado] = useState<Estado>({ st: 'load' })

  useEffect(() => {
    let vivo = true
    getMetricasSociaisCached(slug)
      .then((doc) => {
        if (!vivo) return
        if (!doc) return setEstado({ st: 'vazio' })
        const alertas = derivarAlertas(new Map([[slug, doc]]), new Map([[slug, nome]]))
          .slice(0, MAX_LINHAS)
          .map((a) => redirecionarAcao(a, slug))
        // Diagnóstico do pilar mais fraco complementa quando há poucos alertas —
        // mas só quando o pilar está de fato fraco (<50): as frases do
        // motivoDominante ("Perdendo seguidores") seriam falsas num pilar ok.
        let motivo: string | null = null
        if (alertas.length < 3) {
          const saude = derivarHealthScores(new Map([[slug, doc]]), new Map([[slug, nome]]))[0]
          if (saude) {
            const piorValor = Object.values(saude.breakdown).reduce<number | null>(
              (min, v) => (v == null ? min : min == null || v < min ? v : min),
              null,
            )
            if (piorValor != null && piorValor < 50) motivo = motivoDominante(saude.breakdown)
          }
        }
        setEstado({ st: 'ok', alertas, motivo })
      })
      .catch(() => vivo && setEstado({ st: 'vazio' }))
    return () => {
      vivo = false
    }
  }, [slug, nome])

  if (estado.st === 'load') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-center gap-2 text-sm text-ink-400">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Procurando alertas do artista…
      </div>
    )
  }

  if (estado.st === 'vazio') return null

  const { alertas, motivo } = estado

  if (!alertas.length && !motivo) {
    return (
      <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 grid place-items-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-[13px] text-ink-400">
          Nenhum alerta agora — os indicadores do artista estão estáveis.{' '}
          <Link href="/alertas" className="text-violet-400 hover:text-violet-300">
            Ver todos os alertas →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-ink-100">O que merece atenção</span>
        </div>
        <Link href="/alertas" className="text-[12px] font-semibold text-violet-400 hover:text-violet-300">
          Ver todos →
        </Link>
      </div>
      <div className="divide-y divide-bg-700/30">
        {alertas.map((a) => (
          <AlertaLinha key={a.id} a={a} />
        ))}
        {motivo && <Diagnostico motivo={motivo} />}
      </div>
    </div>
  )
}

/**
 * Dentro do perfil, "Ver artista → /artistas/{slug}" apontaria pra própria
 * página. Troca por uma âncora do card da fonte do alerta (streaming/IG/YT);
 * sem destino melhor, a ação some. Alertas com link de conteúdo ficam como estão.
 */
function redirecionarAcao(a: AlertaDerivado, slug: string): AlertaDerivado {
  if (a.url !== `/artistas/${slug}`) return a
  if (a.categoria === 'viralizacao_streaming' || a.categoria === 'queda_streaming') {
    return { ...a, url: '#card-streaming', acaoSugerida: 'Ver streaming' }
  }
  // Ids de seguidores carregam a plataforma: marco|cresc|queda-{instagram|youtube}-{slug}.
  if (a.categoria.endsWith('_seguidores')) {
    if (a.id.includes('-instagram-')) return { ...a, url: '#card-instagram', acaoSugerida: 'Ver Instagram' }
    if (a.id.includes('-youtube-')) return { ...a, url: '#card-youtube', acaoSugerida: 'Ver YouTube' }
  }
  return { ...a, url: null }
}

/** Linha de diagnóstico do Health (não é um alerta — é o pilar mais fraco). */
function Diagnostico({ motivo }: { motivo: string }) {
  const acao = ACAO_MOTIVO[motivo]
  return (
    <div className="relative flex items-start gap-3 p-4">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500/70" />
      <div className="w-7 h-7 rounded-lg bg-violet-500/15 grid place-items-center shrink-0">
        <HeartPulse className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 rounded', 'bg-violet-500/15 text-violet-400')}>
            DIAGNÓSTICO
          </span>
          <div className="text-[13px] text-ink-300 mt-1.5">
            Pilar mais fraco do Health Score: <span className="font-semibold text-ink-100">{motivo}</span>
            {acao?.dica ? ` — ${acao.dica}` : ''}
          </div>
        </div>
        {acao?.href && acao.acao && (
          <a
            href={acao.href}
            className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-start sm:self-center transition-colors"
          >
            {acao.acao} →
          </a>
        )}
      </div>
    </div>
  )
}

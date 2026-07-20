'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import type { ArtistaDoc } from '@/lib/artistas/client'
import { corBarraAcesso, nivelAcesso, rotuloNivel } from '@/lib/artistas/acesso'
import { cn } from '@/lib/utils'

/** Cor da marca por rede (quando cadastrada). */
const CORES: Record<string, string> = {
  spotify: 'text-emerald-400',
  youtube: 'text-red-400',
  instagram: 'text-fuchsia-400',
  tiktok: 'text-cyan-400',
}

type RedeKey = 'spotify' | 'youtube' | 'instagram' | 'tiktok'

/**
 * Card "Acesso & integrações" do perfil — substitui o antigo "Redes sociais".
 * Mostra o NÍVEL de integração (barra) + o status por rede, mantendo os
 * @handles/links. A régua e o cálculo vivem em `@/lib/artistas/acesso`.
 */
export function AcessoIntegracoesCard({ artista }: { artista: ArtistaDoc }) {
  const [metricas, setMetricas] = useState<MetricasSociaisDoc | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    getMetricasSociaisCached(artista.slug)
      .then((m) => {
        if (vivo) setMetricas(m)
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [artista.slug])

  const nivel = nivelAcesso(artista.redes, metricas)
  const rotulo = rotuloNivel(nivel)
  const pctLabel = Math.round(nivel.pct * 100)

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30">
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-ink-100">Acesso & integrações</div>
          <span
            className={cn(
              'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full border',
              rotulo.classe,
            )}
          >
            {carregando ? '…' : rotulo.label.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex-1 h-2 rounded-full bg-bg-700/60 overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all', corBarraAcesso(nivel.pct, nivel.totalIntegravel))}
              style={{ width: carregando ? '0%' : `${nivel.totalIntegravel ? Math.max(4, pctLabel) : 0}%` }}
            />
          </div>
          <span className="text-[12px] num text-ink-400 shrink-0">
            {carregando
              ? '—'
              : nivel.totalIntegravel
                ? `${nivel.conectados}/${nivel.totalIntegravel} conectadas`
                : 'sem redes integráveis'}
          </span>
        </div>
      </div>

      <div className="divide-y divide-bg-700/30">
        {nivel.canais.map((c) => {
          const rede = artista.redes?.[c.tipo as RedeKey]
          return (
            <div key={c.tipo} className="flex items-center gap-3 px-5 py-3">
              <span className={cn('w-5 h-5 block shrink-0', c.cadastrado ? CORES[c.tipo] : 'text-ink-700')}>
                <PlataformaIcon tipo={c.tipo} />
              </span>
              <span className="text-sm text-ink-200 w-20 sm:w-24 shrink-0">{c.nome}</span>
              {rede?.url ? (
                <a
                  href={rede.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] num text-violet-400 hover:text-violet-300 truncate min-w-0 inline-flex items-center gap-1"
                >
                  <span className="truncate">
                    {rede.handle ? `@${rede.handle}` : rede.id ? `id: ${rede.id}` : rede.url}
                  </span>
                  <ExternalLink className="w-3 h-3 text-ink-500 shrink-0" />
                </a>
              ) : (
                <span className="text-[12px] text-ink-600">— sem link</span>
              )}
              <span className={cn('ml-auto shrink-0 text-[11px] font-semibold', c.classe)}>
                {c.rotulo}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

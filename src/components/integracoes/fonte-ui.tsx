'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Primitives compartilhados da página de Integrações: card compacto (grid) +
 * modal de detalhes ("ver mais"), além de tiles, chips e badges. Cada fonte
 * (Meta, TikTok, YouTube, OneRPM, Spotify) monta seu próprio conteúdo a partir
 * daqui, garantindo um visual unificado.
 */

export const BADGES = {
  conectado: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  erro: 'text-red-400 bg-red-500/15 border-red-500/30',
  neutro: 'text-ink-400 bg-ink-500/10 border-ink-500/30',
  pendente: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
} as const

/** Badge a partir do status real da integração (conectado/erro/não conectado). */
export function statusBadge(carregando: boolean, status?: string): { texto: string; classe: string } {
  if (carregando) return { texto: '···', classe: BADGES.neutro }
  if (status === 'conectado') return { texto: 'CONECTADO', classe: BADGES.conectado }
  if (status === 'erro') return { texto: 'ERRO', classe: BADGES.erro }
  return { texto: 'NÃO CONECTADO', classe: BADGES.neutro }
}

export const BTN_PRIMARIO =
  'flex items-center gap-1.5 text-[13px] font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-2 rounded-lg transition-colors'
export const BTN_SECUNDARIO =
  'flex items-center gap-1.5 text-[13px] text-ink-200 hover:text-white border border-bg-700/60 hover:bg-bg-800 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-2 rounded-lg transition-colors'

export function BadgePill({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={cn('text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full border', classe)}>
      {texto}
    </span>
  )
}

/** Card compacto exibido no grid. O conteúdo detalhado fica no FonteModal. */
export function FonteCardCompacta({
  icon,
  corIcone,
  nome,
  descricao,
  badge,
  resumo,
  onVerMais,
  atenuado = false,
}: {
  icon: ReactNode
  corIcone: string
  nome: string
  descricao: string
  badge: { texto: string; classe: string }
  resumo?: ReactNode
  onVerMais: () => void
  atenuado?: boolean
}) {
  return (
    <div className={cn('bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex flex-col', atenuado && 'opacity-80')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-xl grid place-items-center shrink-0', corIcone)}>
          <span className="w-6 h-6 block">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base text-ink-100 truncate leading-tight">{nome}</div>
          <div className="mt-1">
            <BadgePill {...badge} />
          </div>
        </div>
      </div>
      <p className="text-[12px] text-ink-400 leading-snug mt-3">{descricao}</p>
      <div className="mt-auto pt-4 border-t border-bg-700/40 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-500 num truncate">{resumo}</span>
        <button
          type="button"
          onClick={onVerMais}
          className="shrink-0 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Ver mais →
        </button>
      </div>
    </div>
  )
}

/** Modal de detalhes da fonte (o "card maior"). Fecha no X, no fundo ou Esc. */
export function FonteModal({
  icon,
  corIcone,
  nome,
  subtitle,
  badge,
  onClose,
  children,
  footer,
}: {
  icon: ReactNode
  corIcone: string
  nome: string
  subtitle?: string
  badge?: { texto: string; classe: string }
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-bg-700/40">
          <div className={cn('w-11 h-11 rounded-xl grid place-items-center shrink-0', corIcone)}>
            <span className="w-6 h-6 block">{icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">{nome}</span>
              {badge && <BadgePill {...badge} />}
            </div>
            {subtitle && <p className="text-[12px] text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-bg-700/40 bg-bg-950/30 flex items-center justify-end gap-2 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function StatTile({ valor, label, cor }: { valor: ReactNode; label: string; cor?: string }) {
  return (
    <div className="bg-bg-950/60 rounded-lg p-3">
      <div className={cn('num text-xl font-bold leading-none', cor ?? 'text-ink-100')}>{valor}</div>
      <div className="text-[11px] text-ink-500 mt-1.5">{label}</div>
    </div>
  )
}

export function ChipsColeta({ titulo = 'O QUE É COLETADO', itens }: { titulo?: string; itens: string[] }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.15em] text-ink-500 font-bold mb-2">{titulo}</div>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <span
            key={i}
            className="text-[12px] text-ink-300 bg-bg-800 border border-bg-700/60 rounded-md px-2.5 py-1"
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MensagemAcao({ msg }: { msg: { tipo: 'ok' | 'erro'; texto: string } }) {
  return (
    <div
      className={cn(
        'text-[12px] rounded-lg px-3 py-2 border',
        msg.tipo === 'ok'
          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
          : 'text-red-300 bg-red-500/10 border-red-500/30',
      )}
    >
      {msg.texto}
    </div>
  )
}

/** "há quanto tempo" a partir de um ISO. */
export function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

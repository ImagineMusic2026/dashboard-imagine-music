'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContaVinculadaRef } from '@/lib/artistas/client'

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

/** Quantas contas o preview inline mostra antes de oferecer "Ver todas". */
const PREVIEW_CONTAS = 6

/** Uma linha da lista de contas: @handle + nome (ou nome + detalhe quando não há handle). */
function LinhaConta({ conta, corHandle }: { conta: ContaVinculadaRef; corHandle: string }) {
  const temHandle = !!conta.handle
  const primario = temHandle ? `@${conta.handle}` : conta.nome
  const secundario = temHandle ? conta.nome : conta.detalhe
  return (
    <li className="flex items-center justify-between gap-3 px-1.5 py-1.5">
      <span className={cn('num text-[12px] truncate', temHandle ? corHandle : 'text-ink-200')}>{primario}</span>
      {secundario && (
        <span className={cn('text-[11px] truncate text-right shrink-0 max-w-[45%]', temHandle ? 'text-ink-500' : corHandle)}>
          {secundario}
        </span>
      )}
    </li>
  )
}

/** Modal maior ("card") dedicado às contas, com busca. Fica por cima do FonteModal. */
function ModalContas({
  icon,
  corIcone,
  nomeFonte,
  rotulo,
  corHandle,
  contas,
  onClose,
}: {
  icon: ReactNode
  corIcone: string
  nomeFonte: string
  rotulo: string
  corHandle: string
  contas: ContaVinculadaRef[]
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')

  // Esc fecha SÓ este modal: captura roda antes do listener (bubble) do FonteModal
  // por baixo e interrompe a propagação, então o modal da integração não fecha junto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const q = busca.trim().toLowerCase()
  const filtradas = q
    ? contas.filter((c) => c.nome.toLowerCase().includes(q) || (c.handle ?? '').toLowerCase().includes(q))
    : contas

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-bg-700/40">
          <div className={cn('w-10 h-10 rounded-xl grid place-items-center shrink-0', corIcone)}>
            <span className="w-5 h-5 block">{icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-ink-100">{nomeFonte}</div>
            <p className="text-[12px] text-ink-400 mt-0.5">
              <span className="capitalize">{rotulo}</span> · {contas.length}
            </p>
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

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou @…"
              autoFocus
              className="w-full bg-bg-950/60 border border-bg-700/50 rounded-lg pl-9 pr-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {filtradas.length === 0 ? (
            <div className="text-[12px] text-ink-500 py-6 text-center">Nada encontrado para “{busca}”.</div>
          ) : (
            <ul className="divide-y divide-bg-700/30">
              {filtradas.map((c) => (
                <LinhaConta key={c.slug} conta={c} corHandle={corHandle} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Painel "ver contas" reaproveitado por todas as fontes: um toggle que expande a
 * lista (até {PREVIEW_CONTAS}) dentro do FonteModal e, quando há mais, um "Ver
 * todas" que abre o ModalContas (card maior com busca). A lista é carregada sob
 * demanda; `recarregarSinal` invalida o cache (ex.: após "descobrir"/"sincronizar").
 */
export function PainelContasVinculadas({
  total,
  rotulo,
  carregar,
  recarregarSinal,
  icon,
  corIcone,
  nomeFonte,
  corHandle = 'text-emerald-300',
}: {
  total: number
  rotulo: string
  carregar: () => Promise<ContaVinculadaRef[]>
  recarregarSinal?: unknown
  icon: ReactNode
  corIcone: string
  nomeFonte: string
  corHandle?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [verTudo, setVerTudo] = useState(false)
  const [contas, setContas] = useState<ContaVinculadaRef[] | null>(null)
  const [carregando, setCarregando] = useState(false)

  const carregarRef = useRef(carregar)
  carregarRef.current = carregar

  const carregarContas = useRef(() => {
    setCarregando(true)
    carregarRef
      .current()
      .then(setContas)
      .catch(() => setContas([]))
      .finally(() => setCarregando(false))
  }).current

  // Invalida o cache quando a integração muda (o card passa um novo `status`).
  useEffect(() => {
    setContas(null)
  }, [recarregarSinal])

  // Carrega quando o painel abre (ou reabre após invalidar) e ainda não há cache.
  useEffect(() => {
    if (aberto && contas === null && !carregando) carregarContas()
  }, [aberto, contas, carregando, carregarContas])

  if (total <= 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex items-center gap-1 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
      >
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', aberto && 'rotate-180')} />
        {aberto ? `Ocultar ${rotulo}` : `Ver ${rotulo} (${contas?.length ?? total})`}
      </button>

      {aberto && (
        <div className="mt-2 rounded-lg border border-bg-700/40 bg-bg-950/40 p-1.5">
          {carregando ? (
            <div className="flex items-center gap-2 text-[12px] text-ink-500 px-1.5 py-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
            </div>
          ) : !contas || contas.length === 0 ? (
            <div className="text-[12px] text-ink-500 px-1.5 py-1.5">Nenhuma conta encontrada.</div>
          ) : (
            <>
              <ul className="divide-y divide-bg-700/30">
                {contas.slice(0, PREVIEW_CONTAS).map((c) => (
                  <LinhaConta key={c.slug} conta={c} corHandle={corHandle} />
                ))}
              </ul>
              {contas.length > PREVIEW_CONTAS && (
                <button
                  type="button"
                  onClick={() => setVerTudo(true)}
                  className="w-full mt-1 text-center text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors py-1.5"
                >
                  Ver todas as {contas.length} →
                </button>
              )}
            </>
          )}
        </div>
      )}

      {verTudo && contas && (
        <ModalContas
          icon={icon}
          corIcone={corIcone}
          nomeFonte={nomeFonte}
          rotulo={rotulo}
          corHandle={corHandle}
          contas={contas}
          onClose={() => setVerTudo(false)}
        />
      )}
    </div>
  )
}

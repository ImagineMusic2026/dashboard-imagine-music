'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, GitCompareArrows, Loader2, X } from 'lucide-react'
import type {
  AnaliseArtista,
  AnaliseRoster,
  DecisoesRoster,
  RedeKey,
  RedeSocial,
} from '@/lib/roster/types'
import { cn } from '@/lib/utils'

const REDE_LABEL: Record<RedeKey, { nome: string; cor: string }> = {
  spotify: { nome: 'Spotify', cor: 'text-emerald-400' },
  youtube: { nome: 'YouTube', cor: 'text-red-400' },
  instagram: { nome: 'Instagram', cor: 'text-fuchsia-400' },
  tiktok: { nome: 'TikTok', cor: 'text-cyan-400' },
}

/** Identidade "principal" pra exibir: @handle > id > url. */
function identidade(r: RedeSocial): string {
  if (r.handle) return `@${r.handle}`
  if (r.id) return r.id
  return r.url || '—'
}

function OpcaoConta({
  titulo,
  rede,
  selecionado,
  onEscolher,
}: {
  titulo: string
  rede: RedeSocial
  selecionado: boolean
  onEscolher: () => void
}) {
  const principal = identidade(rede)
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={selecionado}
      className={cn(
        'text-left rounded-lg border p-3 min-w-0 transition-colors',
        selecionado
          ? 'border-cyan-500/60 bg-cyan-500/10'
          : 'border-bg-700/50 bg-bg-800/30 hover:bg-bg-800/60'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-bold tracking-wider uppercase',
            selecionado ? 'text-cyan-300' : 'text-ink-500'
          )}
        >
          {titulo}
        </span>
        {selecionado && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
      </div>
      <div className="text-sm font-semibold text-ink-100 mt-1 truncate num">{principal}</div>
      {rede.url && rede.url !== principal && (
        <div className="text-[11px] text-ink-500 truncate mt-0.5">{rede.url}</div>
      )}
    </button>
  )
}

/**
 * Revisão dos DUPLICADOS da importação: um artista por vez, e pra cada rede em
 * conflito (o painel tem uma conta, a planilha traz outra) o usuário escolhe
 * manter a atual ou trocar pela da planilha. Nada é gravado até o "Confirmar
 * importação" da última etapa — cancelar descarta tudo.
 */
export function RevisarRosterDialog({
  analise,
  arquivoNome,
  onCancelar,
  onConfirmar,
}: {
  analise: AnaliseRoster
  arquivoNome: string
  onCancelar: () => void
  /** Grava a importação com as decisões; deve LANÇAR em caso de falha. */
  onConfirmar: (decisoes: DecisoesRoster) => Promise<void>
}) {
  const conflitados = analise.artistas.filter((a) => a.status === 'conflito')
  const [idx, setIdx] = useState(0)
  const [decisoes, setDecisoes] = useState<DecisoesRoster>(() => {
    // Padrão seguro: manter o que já está no painel.
    const d: DecisoesRoster = {}
    for (const a of conflitados) {
      d[a.artista.slug] = Object.fromEntries(a.conflitos.map((c) => [c.rede, 'manter' as const]))
    }
    return d
  })
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const atual: AnaliseArtista | undefined = conflitados[idx]
  const ultimo = idx >= conflitados.length - 1
  const t = analise.totais

  const escolher = (slug: string, rede: RedeKey, valor: 'manter' | 'trocar') =>
    setDecisoes((d) => ({ ...d, [slug]: { ...d[slug], [rede]: valor } }))

  async function handleConfirmar() {
    if (confirmando) return
    setErro(null)
    setConfirmando(true)
    try {
      await onConfirmar(decisoes)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao confirmar a importação.')
      setConfirmando(false)
    }
  }

  if (!atual) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-lg bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-bg-700/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-ink-100">Revisar duplicados</span>
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5 truncate">
              {arquivoNome} · {t.novos} novos · {t.atualizados} atualizações · {t.iguais} sem mudança ·{' '}
              <span className="text-amber-400 font-semibold">{t.comConflito} com conflito</span>
            </div>
          </div>
          <button
            type="button"
            onClick={confirmando ? undefined : onCancelar}
            aria-label="Cancelar importação"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-ink-100 truncate">{atual.artista.nome}</div>
              <div className="text-[11px] text-ink-500 num truncate">
                {atual.artista.slug}
                {atual.nomeAtual && atual.nomeAtual !== atual.artista.nome && (
                  <> · no painel como &quot;{atual.nomeAtual}&quot;</>
                )}
              </div>
            </div>
            <span className="text-[11px] text-ink-500 num shrink-0">
              artista {idx + 1} de {conflitados.length}
            </span>
          </div>

          <p className="text-[12px] text-ink-400 leading-relaxed">
            Este artista <strong className="text-ink-200 font-semibold">já existe no painel</strong> com
            contas diferentes das da planilha. Escolha, rede por rede, qual vale.
          </p>

          {atual.conflitos.map((c) => (
            <div key={c.rede} className="space-y-1.5">
              <div className={cn('text-[11px] font-bold tracking-wider uppercase', REDE_LABEL[c.rede].cor)}>
                {REDE_LABEL[c.rede].nome}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <OpcaoConta
                  titulo="Manter · no painel"
                  rede={c.atual}
                  selecionado={decisoes[atual.artista.slug]?.[c.rede] !== 'trocar'}
                  onEscolher={() => escolher(atual.artista.slug, c.rede, 'manter')}
                />
                <OpcaoConta
                  titulo="Trocar · da planilha"
                  rede={c.novo}
                  selecionado={decisoes[atual.artista.slug]?.[c.rede] === 'trocar'}
                  onEscolher={() => escolher(atual.artista.slug, c.rede, 'trocar')}
                />
              </div>
            </div>
          ))}

          {atual.redesNovas.length > 0 && (
            <p className="text-[11px] text-ink-500">
              Sem conflito (só preenche o que estava vazio):{' '}
              {atual.redesNovas.map((r) => REDE_LABEL[r].nome).join(', ')}.
            </p>
          )}

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-bg-700/40">
          <button
            type="button"
            onClick={onCancelar}
            disabled={confirmando}
            className="text-[13px] text-red-400/80 hover:text-red-300 px-2 py-2 rounded-lg hover:bg-red-500/5 transition-colors disabled:opacity-50"
          >
            Cancelar importação
          </button>
          <div className="flex-1" />
          {idx > 0 && (
            <button
              type="button"
              onClick={() => setIdx((i) => i - 1)}
              disabled={confirmando}
              className="flex items-center gap-1.5 bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          )}
          {ultimo ? (
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={confirmando}
              aria-busy={confirmando}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {confirmando ? 'Importando…' : 'Confirmar importação'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIdx((i) => i + 1)}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

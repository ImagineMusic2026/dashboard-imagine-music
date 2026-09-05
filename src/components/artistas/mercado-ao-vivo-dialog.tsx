'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { salvarMercadoAoVivo } from '@/lib/artistas/client'
import { NIVEIS_MERCADO_AO_VIVO } from '@/lib/iaos/ige'
import { cn } from '@/lib/utils'

/**
 * Seleção declaratória de **Mercado ao Vivo** (IAOS-DOC-02 v1.2, componente de
 * 10% do IGE).
 *
 * A equipe escolhe a DESCRIÇÃO que representa o momento do projeto; a nota não
 * aparece em lugar nenhum da escolha — é a regra da metodologia ("a equipe não
 * calcula manualmente o score"). Mostrar o número aqui convidaria a escolher pela
 * nota em vez de pela realidade.
 */
export function MercadoAoVivoDialog({
  slug,
  nome,
  nivelAtual,
  onClose,
  onSalvo,
}: {
  slug: string
  nome: string
  nivelAtual: number | null
  onClose: () => void
  onSalvo: () => void | Promise<void>
}) {
  const [selecionado, setSelecionado] = useState<number | null>(nivelAtual)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar(nivel: number | null) {
    if (salvando) return
    setErro(null)
    setSalvando(true)
    try {
      await salvarMercadoAoVivo(slug, nivel)
      await onSalvo()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao salvar.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Declarar mercado ao vivo de ${nome}`}
        className="relative w-full max-w-2xl bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl z-10">
          <div className="min-w-0">
            <div className="font-bold text-ink-100">Mercado ao vivo</div>
            <p className="text-[12px] text-ink-500 mt-0.5">
              Escolha a descrição que melhor representa o momento de {nome}. Na dúvida entre dois
              níveis, selecione o menor até haver evidência do superior.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {NIVEIS_MERCADO_AO_VIVO.map((n) => {
            const ativo = selecionado === n.nivel
            return (
              <button
                key={n.nivel}
                type="button"
                onClick={() => setSelecionado(n.nivel)}
                aria-pressed={ativo}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-colors',
                  ativo
                    ? 'bg-violet-500/10 border-violet-500/40'
                    : 'bg-bg-950 border-bg-700/40 hover:border-bg-700/80',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full border grid place-items-center shrink-0',
                      ativo ? 'border-violet-400' : 'border-bg-700',
                    )}
                    aria-hidden
                  >
                    {ativo && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                  </span>
                  <span className={cn('text-sm font-semibold', ativo ? 'text-violet-200' : 'text-ink-100')}>
                    {n.titulo}
                  </span>
                </div>
                <p className="text-[12px] text-ink-400 mt-1.5 pl-6 leading-relaxed">{n.referencia}</p>
              </button>
            )
          })}
        </div>

        {erro && (
          <div className="mx-4 mb-2 text-[12px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <div className="flex items-center gap-2 px-5 py-4 border-t border-bg-700/40 sticky bottom-0 bg-bg-900 rounded-b-2xl">
          {nivelAtual != null && (
            <button
              type="button"
              onClick={() => confirmar(null)}
              disabled={salvando}
              className="text-xs text-ink-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Desfazer declaração
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-ink-300 hover:text-ink-100 hover:bg-bg-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => selecionado != null && confirmar(selecionado)}
            disabled={salvando || selecionado == null}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-bg-950 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
            Declarar
          </button>
        </div>
      </div>
    </div>
  )
}

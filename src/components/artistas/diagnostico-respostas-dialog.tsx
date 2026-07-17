'use client'

import { useEffect } from 'react'
import { Check, ClipboardList, X } from 'lucide-react'
import type { DiagnosticoDoc } from '@/lib/diagnostico/client'
import { NOME_CURTO, progressoDe, questionario, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { cn } from '@/lib/utils'

function dataCurta(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * As respostas do artista num modal, e não expandidas no perfil.
 *
 * São 16–22 perguntas de texto livre: abertas na página, empurravam todo o resto do
 * perfil pra baixo, e o tamanho ainda dependia do quanto o artista escreveu. Aqui a
 * leitura fica contida e a rolagem é do modal.
 *
 * Mantém a ordem e as seções do questionário — é assim que o diagnóstico se lê. As
 * não respondidas ficam, discretas: saber o que ficou em branco também é informação.
 */
export function DiagnosticoRespostasDialog({
  tipo,
  artistaNome,
  doc,
  onFechar,
}: {
  tipo: TipoDiagnostico
  artistaNome: string
  doc: DiagnosticoDoc | undefined
  onFechar: () => void
}) {
  const q = questionario(tipo)
  const prog = progressoDe(tipo, doc?.respostas)
  const enviado = doc?.status === 'enviado'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Respostas de ${artistaNome} — questionário ${NOME_CURTO[tipo]}`}
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-bg-700/40 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 grid place-items-center shrink-0">
              <ClipboardList className="w-5 h-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ink-100 truncate">
                Questionário · {NOME_CURTO[tipo]}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-[12px] text-ink-400 truncate">{artistaNome}</span>
                <span className="text-ink-700">·</span>
                {enviado ? (
                  <span className="flex items-center gap-1 text-[10px] tracking-wider font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                    <Check className="w-2.5 h-2.5" />
                    ENVIADO {dataCurta(doc?.enviadoEmMs ?? null)}
                  </span>
                ) : (
                  <span className="text-[10px] tracking-wider font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                    RASCUNHO
                  </span>
                )}
                <span className="text-[12px] text-ink-500 num">
                  {prog.respondidas} de {prog.total}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-1 bg-bg-800 shrink-0">
          <div
            className={cn('h-full transition-all', prog.pct === 100 ? 'bg-emerald-500' : 'bg-violet-500')}
            style={{ width: `${prog.pct}%` }}
          />
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {q.secoes.map((secao, i) => (
            <section key={secao.titulo ?? i} className="space-y-4">
              {secao.titulo && (
                <h3 className="text-[11px] tracking-[0.18em] font-bold text-violet-400 uppercase">{secao.titulo}</h3>
              )}
              {secao.perguntas.map((p) => {
                const r = (doc?.respostas?.[p.id] ?? '').trim()
                return (
                  <div key={p.id}>
                    <div className="text-[12px] font-semibold text-ink-400 mb-1">{p.rotulo}</div>
                    {r ? (
                      // `whitespace-pre-wrap`: texto do artista, as quebras são dele.
                      <p className="text-[13px] text-ink-200 leading-relaxed whitespace-pre-wrap">{r}</p>
                    ) : (
                      <p className="text-[13px] text-ink-600 italic">— sem resposta</p>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

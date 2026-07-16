'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ClipboardList } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ehStaff } from '@/lib/permissions'
import { getDiagnostico, type DiagnosticoDoc } from '@/lib/diagnostico/client'
import { NOME_CURTO, perguntasDe, progressoDe, TIPOS, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { cn } from '@/lib/utils'

/**
 * O que o ARTISTA respondeu no questionário de estruturação, para a equipe ler.
 *
 * Só staff: as regras já negam a leitura de diagnóstico alheio, mas este card vive
 * dentro de `PerfilArtistaReal`, que o portal do artista renderiza igual — sem o
 * gate, o artista veria um bloco "diagnóstico" redundante no próprio perfil (ele
 * responde pelo /diagnostico). Some inteiro enquanto ninguém respondeu nada.
 */
export function DiagnosticoArtistaCard({ slug }: { slug: string }) {
  const { role, loading } = useAuth()
  const staff = !loading && ehStaff(role)
  const [docs, setDocs] = useState<Partial<Record<TipoDiagnostico, DiagnosticoDoc>>>({})
  const [aberto, setAberto] = useState<TipoDiagnostico | null>(null)

  useEffect(() => {
    if (!staff) return
    let vivo = true
    Promise.all(TIPOS.map((t) => getDiagnostico(slug, t).catch(() => null)))
      .then((lista) => {
        if (!vivo) return
        const out: Partial<Record<TipoDiagnostico, DiagnosticoDoc>> = {}
        lista.forEach((d, i) => {
          if (d) out[TIPOS[i]] = d
        })
        setDocs(out)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [slug, staff])

  if (!staff) return null

  const comAlgo = TIPOS.filter((t) => progressoDe(t, docs[t]?.respostas).respondidas > 0)
  if (!comAlgo.length) return null

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 font-bold text-ink-100 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-violet-400 shrink-0" />
        Questionário de estruturação
        <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/50">
          RESPONDIDO PELO ARTISTA
        </span>
      </div>

      <div className="divide-y divide-bg-700/30">
        {comAlgo.map((tipo) => {
          const doc = docs[tipo]
          const prog = progressoDe(tipo, doc?.respostas)
          const estaAberto = aberto === tipo
          return (
            <div key={tipo}>
              <button
                type="button"
                onClick={() => setAberto(estaAberto ? null : tipo)}
                aria-expanded={estaAberto}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-bg-800/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-ink-100">{NOME_CURTO[tipo]}</span>
                    {doc?.status === 'enviado' ? (
                      <span className="flex items-center gap-1 text-[10px] tracking-wider font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" />
                        ENVIADO
                      </span>
                    ) : (
                      <span className="text-[10px] tracking-wider font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                        RASCUNHO
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-500 num mt-0.5">
                    {prog.respondidas} de {prog.total} respondidas
                  </div>
                </div>
                <ChevronDown
                  className={cn('w-4 h-4 text-ink-500 shrink-0 transition-transform', estaAberto && 'rotate-180')}
                />
              </button>

              {estaAberto && (
                <div className="px-5 pb-5 space-y-4">
                  {perguntasDe(tipo).map((p) => {
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

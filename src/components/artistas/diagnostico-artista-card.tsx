'use client'

import { useEffect, useState } from 'react'
import { Check, ClipboardList } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ehStaff } from '@/lib/permissions'
import { getDiagnostico, type DiagnosticoDoc } from '@/lib/diagnostico/client'
import { NOME_CURTO, progressoDe, TIPOS, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { DiagnosticoRespostasDialog } from '@/components/artistas/diagnostico-respostas-dialog'
import { cn } from '@/lib/utils'

/**
 * O que o ARTISTA respondeu no questionário de estruturação, para a equipe ler.
 *
 * O card é só o resumo — as respostas abrem num modal. São 16–22 perguntas de texto
 * livre; expandidas aqui, empurravam todo o resto do perfil pra baixo.
 *
 * Só staff: as regras já negam a leitura de diagnóstico alheio, mas este card vive
 * dentro de `PerfilArtistaReal`, que o portal do artista renderiza igual — sem o
 * gate, o artista veria um bloco "diagnóstico" redundante no próprio perfil (ele
 * responde pelo /diagnostico). Some inteiro enquanto ninguém respondeu nada.
 */
export function DiagnosticoArtistaCard({ slug, nome }: { slug: string; nome: string }) {
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
    <>
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
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setAberto(tipo)}
                className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-bg-800/40 transition-colors group"
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
                  <div className="h-1 rounded-full bg-bg-800 mt-2 overflow-hidden max-w-xs">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        prog.pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                      )}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[12px] text-violet-400 group-hover:text-violet-300 shrink-0 transition-colors">
                  Ver respostas →
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {aberto && (
        <DiagnosticoRespostasDialog
          tipo={aberto}
          artistaNome={nome}
          doc={docs[aberto]}
          onFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}

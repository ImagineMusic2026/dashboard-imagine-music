'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ClipboardList, Paperclip, Pencil } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ehStaff } from '@/lib/permissions'
import { getDiagnostico, type DiagnosticoDoc } from '@/lib/diagnostico/client'
import { NOME_CURTO, progressoDe, TIPOS, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { DiagnosticoRespostasDialog } from '@/components/artistas/diagnostico-respostas-dialog'
import { cn } from '@/lib/utils'

/**
 * O questionário de estruturação visto pela EQUIPE: o que já foi respondido, e o
 * caminho pra preencher o que falta.
 *
 * As respostas abrem num modal e o preenchimento numa página própria — são 16–22
 * perguntas de texto livre; expandidas aqui, empurravam todo o resto do perfil pra
 * baixo.
 *
 * Só staff: as regras já negam a leitura de diagnóstico alheio, mas este card vive
 * dentro de `PerfilArtistaReal`, que o portal do artista renderiza igual — sem o
 * gate, o artista veria um bloco "diagnóstico" redundante no próprio perfil (ele
 * responde pelo /diagnostico).
 *
 * Aparece mesmo VAZIO pra quem pode preencher: antes ele sumia enquanto ninguém
 * tivesse respondido, o que agora esconderia justamente a porta de entrada.
 */
export function DiagnosticoArtistaCard({ slug, nome }: { slug: string; nome: string }) {
  const { role, pode, loading } = useAuth()
  const staff = !loading && ehStaff(role)
  const podeEditar = staff && pode('editarArtistas')
  const [docs, setDocs] = useState<Partial<Record<TipoDiagnostico, DiagnosticoDoc>>>({})
  const [carregado, setCarregado] = useState(false)
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
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [slug, staff])

  if (!staff) return null
  // Enquanto não carregou, nada: o card apareceria com "0 de 22" e saltaria pro
  // número real um instante depois.
  if (!carregado) return null

  const comAlgo = TIPOS.filter((t) => progressoDe(t, docs[t]?.respostas).respondidas > 0)
  // Nada respondido e sem permissão pra preencher: o card não teria o que mostrar
  // nem o que oferecer.
  if (!comAlgo.length && !podeEditar) return null

  return (
    <>
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="flex items-center gap-2 font-bold text-ink-100">
            <ClipboardList className="w-4 h-4 text-violet-400 shrink-0" />
            Questionário de estruturação
          </div>
          <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
            {podeEditar
              ? 'O artista responde pelo portal — e a equipe pode preencher aqui o que já veio por fora (reunião, WhatsApp, formulário antigo).'
              : 'Respondido pelo artista no portal, ou preenchido pela equipe.'}
          </p>
        </div>

        <div className="divide-y divide-bg-700/30">
          {TIPOS.map((tipo) => {
            const doc = docs[tipo]
            const prog = progressoDe(tipo, doc?.respostas)
            const temResposta = prog.respondidas > 0
            // Sem resposta e sem permissão: a linha vira ruído.
            if (!temResposta && !podeEditar) return null
            const daEquipe = doc?.origem === 'equipe'
            return (
              <div key={tipo} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-ink-100">{NOME_CURTO[tipo]}</span>
                    {!temResposta ? (
                      <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/50">
                        NÃO RESPONDIDO
                      </span>
                    ) : doc?.status === 'enviado' ? (
                      <span className="flex items-center gap-1 text-[10px] tracking-wider font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" />
                        {daEquipe ? 'CONCLUÍDO' : 'ENVIADO'}
                      </span>
                    ) : (
                      <span className="text-[10px] tracking-wider font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                        RASCUNHO
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-500 mt-0.5">
                    {temResposta ? (
                      <>
                        <span className="num">
                          {prog.respondidas} de {prog.total} respondidas
                        </span>
                        {' · '}
                        {daEquipe ? 'preenchido pela equipe' : 'respondido pelo artista'}
                      </>
                    ) : (
                      <>
                        <span className="num">{prog.total}</span> perguntas — nada respondido ainda
                      </>
                    )}
                    {/* Fora do ramo "tem resposta" de propósito: dá pra anexar o
                        original ANTES de transcrever, e aí é o único que existe. */}
                    {doc?.arquivoUrl && (
                      <>
                        {' · '}
                        <a
                          href={doc.arquivoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          original
                        </a>
                      </>
                    )}
                  </div>
                  {temResposta && (
                    <div className="h-1 rounded-full bg-bg-800 mt-2 overflow-hidden max-w-xs">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          prog.pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                        )}
                        style={{ width: `${prog.pct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Duas ações lado a lado, e não a linha inteira clicável: pressável
                    dentro de pressável vira foco duplo no leitor de tela. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {temResposta && (
                    <button
                      type="button"
                      onClick={() => setAberto(tipo)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-violet-400 hover:text-violet-300 hover:bg-bg-800 transition-colors"
                    >
                      Ver respostas
                    </button>
                  )}
                  {podeEditar && (
                    <Link
                      href={`/artistas/${slug}/questionario/${tipo}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-xs font-semibold transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {temResposta ? 'Editar' : 'Preencher'}
                    </Link>
                  )}
                </div>
              </div>
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

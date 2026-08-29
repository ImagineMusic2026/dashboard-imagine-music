'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ContratoDialog } from '@/components/artistas/contrato-dialog'
import {
  dataCurta,
  diasEntre,
  excluirContrato,
  hojeISO,
  listarContratos,
  situacaoDe,
  situacaoMeta,
  tipoContratoMeta,
  type Contrato,
} from '@/lib/contratos/client'
import { cn } from '@/lib/utils'

type Dialogo = null | { modo: 'novo' } | { modo: 'editar'; contrato: Contrato }

/**
 * Bloco "Contratos" do perfil: a ficha de cada contrato (tipo, vigência,
 * percentual, observações) e o link do PDF digitalizado.
 *
 * ⚠️ SÓ QUEM TEM A CAPACIDADE `contratos` — padrão admin. Este componente vive
 * dentro de `PerfilArtistaReal`, que o portal do artista (/meu-perfil) renderiza
 * igualzinho; por isso ele se autoprotege e não aparece pra quem não pode. A
 * barreira real é a regra do Firestore sobre `projetos/{slug}/contratos`.
 *
 * Diferente do card de Projeto, aparece MESMO vazio (pra quem pode): "nenhum
 * contrato cadastrado" é a informação, e é dali que sai o botão de cadastrar.
 */
export function ContratosArtistaCard({ slug }: { slug: string }) {
  const { user, pode, loading } = useAuth()
  const podeVer = !loading && pode('contratos')
  const [contratos, setContratos] = useState<Contrato[] | null>(null)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setContratos(await listarContratos(slug))
    } catch {
      // Sem permissão / offline: o card some em vez de mostrar erro no perfil.
      setContratos(null)
    }
  }, [slug])

  useEffect(() => {
    if (!podeVer) return
    carregar()
  }, [podeVer, carregar])

  if (!podeVer || contratos === null) return null

  async function remover(c: Contrato) {
    setExcluindo(c.id)
    try {
      await excluirContrato(slug, c.id)
    } finally {
      await carregar()
      setExcluindo(null)
    }
  }

  const hoje = hojeISO()

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center gap-2">
        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="font-bold text-ink-100">Contratos</span>
        <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/50">
          INTERNO
        </span>
        <button
          type="button"
          onClick={() => setDialogo({ modo: 'novo' })}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {contratos.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-500">
          Nenhum contrato cadastrado ainda. Use <span className="text-violet-300">Novo</span> para
          registrar a vigência e apontar o PDF digitalizado.
        </div>
      ) : (
        <ul className="divide-y divide-bg-700/30">
          {contratos.map((c) => {
            const situacao = situacaoDe(c, hoje)
            const meta = situacaoMeta[situacao]
            const faltam = c.fim && situacao === 'a-vencer' ? diasEntre(hoje, c.fim) : null
            return (
              <li key={c.id} className={cn('p-5 group', excluindo === c.id && 'opacity-50')}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-ink-100">
                        {tipoContratoMeta[c.tipo]?.label ?? 'Contrato'}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                          meta.chip,
                        )}
                      >
                        {meta.label}
                        {faltam != null && ` · ${faltam}d`}
                      </span>
                      {c.percentual != null && (
                        <span className="text-[11px] num text-ink-400">{c.percentual}%</span>
                      )}
                    </div>

                    {c.titulo && <div className="text-[12px] text-ink-400 mt-0.5">{c.titulo}</div>}

                    <div className="text-[12px] text-ink-500 num mt-1">
                      {dataCurta(c.inicio)} → {c.fim ? dataCurta(c.fim) : 'prazo indeterminado'}
                    </div>

                    {c.observacoes && (
                      <p className="text-[12px] text-ink-400 mt-1.5 leading-relaxed whitespace-pre-wrap">
                        {c.observacoes}
                      </p>
                    )}

                    {c.arquivoUrl && (
                      <a
                        href={c.arquivoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 mt-2 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir documento
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setDialogo({ modo: 'editar', contrato: c })}
                      aria-label={`Editar contrato de ${tipoContratoMeta[c.tipo]?.label ?? 'contrato'}`}
                      className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 hover:text-ink-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(c)}
                      aria-label={`Excluir contrato de ${tipoContratoMeta[c.tipo]?.label ?? 'contrato'}`}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-ink-500 hover:text-red-400 transition-colors"
                    >
                      {excluindo === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialogo && user?.uid && (
        <ContratoDialog
          slug={slug}
          contrato={dialogo.modo === 'editar' ? dialogo.contrato : null}
          uid={user.uid}
          onClose={() => setDialogo(null)}
          onSalvo={async () => {
            setDialogo(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

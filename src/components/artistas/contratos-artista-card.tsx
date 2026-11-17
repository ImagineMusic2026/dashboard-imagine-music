'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Link2,
  Link2Off,
  Loader2,
  Pencil,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ContratoDialog } from '@/components/artistas/contrato-dialog'
import { GerarContratoDialog } from '@/components/artistas/gerar-contrato-dialog'
import { AssinarImagineDialog } from '@/components/artistas/assinar-imagine-dialog'
import { imprimirContrato } from '@/lib/contratos/imprimir'
import { renderizar, valoresAutomaticos } from '@/lib/contratos/modelo'
import {
  dataCurta,
  diasEntre,
  ehGerado,
  estadoDe,
  estadoMeta,
  excluirContrato,
  hojeISO,
  listarContratos,
  situacaoDe,
  situacaoMeta,
  tipoContratoMeta,
  type Contrato,
} from '@/lib/contratos/client'
import { criarLinkContrato, linksDoArtista, revogarLinkContrato, urlDoLinkContrato } from '@/lib/contratos/links'
import { copiarTexto } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type Dialogo =
  | null
  | { modo: 'novo' }
  | { modo: 'gerar' }
  | { modo: 'editar'; contrato: Contrato }
  | { modo: 'assinar'; contrato: Contrato }

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
export function ContratosArtistaCard({ slug, nome }: { slug: string; nome?: string }) {
  const { user, pode, loading } = useAuth()
  const podeVer = !loading && pode('contratos')
  const [contratos, setContratos] = useState<Contrato[] | null>(null)
  /** `contratoId` → token do link público ativo. */
  const [links, setLinks] = useState<Record<string, string>>({})
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    let lista: Contrato[]
    try {
      lista = await listarContratos(slug)
      setContratos(lista)
    } catch {
      // Sem permissão / offline: o card some em vez de mostrar erro no perfil.
      setContratos(null)
      return
    }
    // A consulta dos links só acontece se houver contrato GERADO. Contrato
    // anexado não tem link, e esta é a aba mais cara do perfil — não vale uma
    // leitura por perfil aberto pra descobrir que não há nada pra descobrir.
    if (!lista.some(ehGerado)) {
      setLinks({})
      return
    }
    try {
      setLinks(await linksDoArtista(slug))
    } catch {
      // Link é acessório: sem ele o card mostra o contrato e esconde o botão de
      // copiar, em vez de sumir inteiro.
      setLinks({})
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
      // O link morre junto: um token apontando pra contrato apagado abriria uma
      // página de assinatura sem documento.
      const token = links[c.id]
      if (token) await revogarLinkContrato(token).catch(() => {})
      await excluirContrato(slug, c.id)
    } finally {
      await carregar()
      setExcluindo(null)
    }
  }

  /** Gera o link se ainda não houver, e já copia — um gesto só, como no questionário. */
  async function copiarLink(c: Contrato) {
    if (!user?.uid) return
    setOcupado(c.id)
    try {
      const token = links[c.id] ?? (await criarLinkContrato(slug, c.id, user.uid)).token
      setLinks((atual) => ({ ...atual, [c.id]: token }))
      const url = urlDoLinkContrato(token)
      if (!(await copiarTexto(url))) window.prompt('Copie o link do contrato:', url)
      setCopiado(c.id)
      window.setTimeout(() => setCopiado((x) => (x === c.id ? null : x)), 1500)
    } catch {
      window.alert('Não consegui gerar o link. Tente de novo.')
    } finally {
      setOcupado(null)
    }
  }

  async function revogarLink(c: Contrato) {
    const token = links[c.id]
    if (!token) return
    if (!window.confirm('Revogar o link? Quem tiver o endereço deixa de conseguir assinar.')) return
    setOcupado(c.id)
    try {
      await revogarLinkContrato(token)
      setLinks((atual) => {
        const proximo = { ...atual }
        delete proximo[c.id]
        return proximo
      })
    } finally {
      setOcupado(null)
    }
  }

  /**
   * O texto do contrato, montado do snapshot gravado.
   *
   * Vem do documento, não do modelo atual da configuração: é o que foi emitido
   * e, se já houver assinatura, é o que foi assinado. A data sai de `emitidoEm`,
   * congelada — por isso o mesmo contrato imprime igual hoje e daqui a um ano.
   */
  function textoDe(c: Contrato): string {
    return renderizar(c.textoModelo ?? '', {
      ...valoresAutomaticos({
        artistaNome: nome || slug,
        inicio: c.inicio ?? null,
        fim: c.fim ?? null,
        percentual: c.percentual ?? null,
        dataDocumento: c.emitidoEm ?? null,
      }),
      ...(c.valores ?? {}),
    })
  }

  function baixar(c: Contrato) {
    imprimirContrato({
      modeloNome: c.modeloNome || 'Contrato',
      artistaNome: nome || slug,
      tipoLabel: tipoContratoMeta[c.tipo]?.label ?? 'Contrato',
      texto: textoDe(c),
      emitidoEm: c.emitidoEm ?? null,
      vigencia: { inicio: c.inicio, fim: c.fim ?? null },
      assinaturaArtista: c.assinaturaArtista ?? null,
      assinaturaImagine: c.assinaturaImagine ?? null,
    })
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
          onClick={() => setDialogo({ modo: 'gerar' })}
          title="Emite o contrato a partir de um modelo e gera o link pro artista assinar"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors"
        >
          <FileSignature className="w-3.5 h-3.5" /> Gerar contrato
        </button>
        <button
          type="button"
          onClick={() => setDialogo({ modo: 'novo' })}
          title="Registra a ficha de um contrato que já existe, com o link do PDF no Drive"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-xs font-semibold transition-colors"
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
            const gerado = ehGerado(c)
            const estado = gerado ? estadoDe(c, !!links[c.id]) : null
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
                      {estado && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                            estadoMeta[estado].chip,
                          )}
                        >
                          {estadoMeta[estado].label}
                        </span>
                      )}
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

                    {gerado && !c.assinaturaArtista && (
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => copiarLink(c)}
                          disabled={ocupado === c.id}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-60 transition-colors"
                        >
                          {ocupado === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                          ) : copiado === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" aria-hidden />
                          )}
                          {copiado === c.id
                            ? 'Link copiado'
                            : links[c.id]
                              ? 'Copiar o link de assinatura'
                              : 'Gerar o link de assinatura'}
                        </button>
                        {links[c.id] && (
                          <button
                            type="button"
                            onClick={() => revogarLink(c)}
                            disabled={ocupado === c.id}
                            className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-red-400 disabled:opacity-60 transition-colors"
                          >
                            <Link2Off className="w-3.5 h-3.5" aria-hidden />
                            Revogar
                          </button>
                        )}
                      </div>
                    )}

                    {gerado && (
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {c.assinaturaArtista && !c.assinaturaImagine && (
                          <button
                            type="button"
                            onClick={() => setDialogo({ modo: 'assinar', contrato: c })}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            <PenLine className="w-3.5 h-3.5" aria-hidden />
                            Assinar como Imagine
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => baixar(c)}
                          className="inline-flex items-center gap-1.5 text-[12px] text-ink-400 hover:text-ink-100 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden />
                          Baixar PDF
                        </button>
                      </div>
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

      {dialogo?.modo === 'assinar' && (
        <AssinarImagineDialog
          slug={slug}
          contratoId={dialogo.contrato.id}
          texto={textoDe(dialogo.contrato)}
          onClose={() => setDialogo(null)}
          onAssinado={async () => {
            setDialogo(null)
            await carregar()
          }}
        />
      )}

      {dialogo && dialogo.modo !== 'gerar' && dialogo.modo !== 'assinar' && user?.uid && (
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

      {dialogo?.modo === 'gerar' && user?.uid && (
        <GerarContratoDialog
          slug={slug}
          artistaNome={nome || slug}
          uid={user.uid}
          onClose={() => setDialogo(null)}
          onGerado={async (url) => {
            setDialogo(null)
            await carregar()
            window.alert(
              url
                ? `Contrato emitido. O link já está na área de transferência:\n\n${url}`
                : 'Contrato emitido, mas não consegui gerar o link agora. Use "Gerar o link de assinatura" no contrato.',
            )
          }}
        />
      )}
    </div>
  )
}

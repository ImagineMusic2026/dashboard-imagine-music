'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Disc3, ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ehStaff } from '@/lib/permissions'
import { FonogramaDialog } from '@/components/artistas/fonograma-dialog'
import {
  lancamentoCurto,
  listarFonogramas,
  origemMeta,
  removerFonograma,
  type Fonograma,
} from '@/lib/fonogramas/client'
import { cn } from '@/lib/utils'

type Dialogo = null | { modo: 'novo' } | { modo: 'editar'; fonograma: Fonograma }

/** Quantas faixas aparecem antes de "Ver todas" — o maior artista tem 266. */
const PREVIA = 8
/** A partir daqui a lista ganha busca (rolar 100 faixas atrás de uma não serve). */
const MIN_BUSCA = 12

/**
 * Bloco "Fonogramas" do perfil: a obra do artista — ISRC, título, álbum,
 * lançamento e UPC.
 *
 * A fonte é `catalogo-faixas` filtrado por `artistaSlug` (ver `@/lib/fonogramas`),
 * e cada faixa mostra de ONDE veio, porque a confiança muda: `Catálogo` é o CSV
 * oficial da OneRPM, `Streaming` é o ISRC que apareceu no relatório de streaming
 * e o painel atribuiu, `Manual` é o que a equipe cadastrou.
 *
 * ⚠️ SÓ STAFF: este componente vive dentro de `PerfilArtistaReal`, que o portal do
 * artista renderiza igual. Some sozinho pra quem não é da equipe.
 */
export function FonogramasArtistaCard({ slug }: { slug: string }) {
  const { role, pode, loading } = useAuth()
  const staff = !loading && ehStaff(role)
  const podeEditar = staff && pode('editarArtistas')
  const [faixas, setFaixas] = useState<Fonograma[] | null>(null)
  const [expandido, setExpandido] = useState(false)
  const [busca, setBusca] = useState('')
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setFaixas(await listarFonogramas(slug))
    } catch {
      // Sem permissão / offline: o card some em vez de sujar o perfil com erro.
      setFaixas(null)
    }
  }, [slug])

  useEffect(() => {
    if (!staff) return
    carregar()
  }, [staff, carregar])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return faixas ?? []
    return (faixas ?? []).filter(
      (f) =>
        (f.titulo ?? '').toLowerCase().includes(termo) ||
        (f.album ?? '').toLowerCase().includes(termo) ||
        f.isrc.toLowerCase().includes(termo),
    )
  }, [faixas, busca])

  if (!staff || faixas === null) return null

  async function remover(f: Fonograma) {
    setRemovendo(f.isrc)
    try {
      await removerFonograma(f.isrc)
    } finally {
      await carregar()
      setRemovendo(null)
    }
  }

  const visiveis = expandido || busca.trim() ? filtradas : filtradas.slice(0, PREVIA)
  const ocultas = filtradas.length - visiveis.length

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center gap-2 flex-wrap">
        <Disc3 className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="font-bold text-ink-100">Fonogramas</span>
        <span className="text-[10px] num bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded font-semibold">
          {faixas.length}
        </span>

        {faixas.length >= MIN_BUSCA && (
          <div className="relative ml-auto">
            <Search
              className="w-3.5 h-3.5 text-ink-500 absolute left-2.5 top-1/2 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar faixa…"
              aria-label="Buscar faixa"
              className="bg-bg-950 border border-bg-700/50 rounded-lg pl-7 pr-3 py-1.5 text-xs text-ink-200 w-40 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        )}

        {podeEditar && (
          <button
            type="button"
            onClick={() => setDialogo({ modo: 'novo' })}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-xs font-semibold transition-colors',
              faixas.length < MIN_BUSCA && 'ml-auto',
            )}
          >
            <Plus className="w-3.5 h-3.5" /> Nova
          </button>
        )}
      </div>

      {faixas.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-500">
          Nenhum fonograma atribuído a este artista. O catálogo oficial da OneRPM veio
          incompleto — o que faltar pode ser cadastrado à mão.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-500">Nenhuma faixa com esse termo.</div>
      ) : (
        <ul className="divide-y divide-bg-700/30">
          {visiveis.map((f) => {
            const origem = origemMeta[f.atribuicao ?? 'catalogo']
            const lanc = lancamentoCurto(f.releaseDate)
            return (
              <li
                key={f.isrc}
                className={cn(
                  'px-5 py-3 flex items-start gap-3 group hover:bg-bg-800/20 transition-colors',
                  removendo === f.isrc && 'opacity-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-ink-100 font-medium truncate">
                      {f.titulo ?? <span className="text-ink-500 italic">sem título</span>}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                        origem.chip,
                      )}
                      title={origem.titulo}
                    >
                      {origem.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 num mt-0.5 flex flex-wrap gap-x-3">
                    <span>{f.isrc}</span>
                    {f.album && <span className="truncate max-w-[220px]">{f.album}</span>}
                    {lanc && <span>{lanc}</span>}
                    {f.upc && <span className="text-ink-600">UPC {f.upc}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {f.link && (
                    <a
                      href={f.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ouvir ${f.titulo ?? f.isrc}`}
                      className="p-1.5 rounded-md hover:bg-bg-800 text-ink-500 hover:text-violet-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {podeEditar && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setDialogo({ modo: 'editar', fonograma: f })}
                        aria-label={`Editar ${f.titulo ?? f.isrc}`}
                        className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 hover:text-ink-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(f)}
                        aria-label={`Remover ${f.titulo ?? f.isrc} do perfil`}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-ink-500 hover:text-red-400 transition-colors"
                      >
                        {removendo === f.isrc ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {ocultas > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="w-full py-2.5 text-[12px] font-semibold text-ink-400 hover:text-violet-300 hover:bg-bg-800/40 border-t border-bg-700/30 transition-colors"
        >
          Ver todas as {filtradas.length} faixas
        </button>
      )}
      {expandido && !busca.trim() && filtradas.length > PREVIA && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          className="w-full py-2.5 text-[12px] font-semibold text-ink-400 hover:text-violet-300 hover:bg-bg-800/40 border-t border-bg-700/30 transition-colors"
        >
          Mostrar menos
        </button>
      )}

      {dialogo && (
        <FonogramaDialog
          slug={slug}
          fonograma={dialogo.modo === 'editar' ? dialogo.fonograma : null}
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

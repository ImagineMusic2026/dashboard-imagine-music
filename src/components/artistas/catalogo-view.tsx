'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Disc3, Loader2, Search } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import {
  corAvatarDe,
  iniciaisDe,
  listarArtistas,
  type ArtistaDoc,
} from '@/lib/artistas/client'
import { cn } from '@/lib/utils'

type Filtro = 'todos' | 'com' | 'sem'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'com', label: 'Com catálogo' },
  { key: 'sem', label: 'Sem catálogo' },
]

/**
 * Catálogo do selo por artista — quantos fonogramas cada um tem mapeado.
 *
 * Responde a pergunta que o catálogo incompleto da OneRPM criou: de quem já
 * sabemos a obra e de quem não sabemos. Quem não tem nenhuma faixa é o que
 * precisa ser cobrado da OneRPM ou cadastrado à mão.
 *
 * Lê o CONTADOR gravado em `artistas/{slug}.fonogramas`, não o catálogo: o
 * roster já vem cacheado, então esta tela custa zero leitura a mais. A lista de
 * faixas em si só é carregada no perfil do artista, uma por vez.
 */
export function CatalogoView() {
  const [artistas, setArtistas] = useState<ArtistaDoc[] | null>(null)
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    listarArtistas()
      .then(setArtistas)
      .catch(() => setErro(true))
  }, [])

  const { lista, total, comCatalogo, naoContados } = useMemo(() => {
    const todos = artistas ?? []
    const termo = busca.trim().toLowerCase()
    const lista = todos
      .filter((a) => {
        const n = a.fonogramas ?? 0
        if (filtro === 'com' && n === 0) return false
        if (filtro === 'sem' && n > 0) return false
        return !termo || a.nome.toLowerCase().includes(termo)
      })
      .sort((a, b) => (b.fonogramas ?? 0) - (a.fonogramas ?? 0))
    return {
      lista,
      total: todos.reduce((s, a) => s + (a.fonogramas ?? 0), 0),
      comCatalogo: todos.filter((a) => (a.fonogramas ?? 0) > 0).length,
      // Artista importado depois da última rodada do script ainda não tem número.
      naoContados: todos.filter((a) => a.fonogramas === undefined).length,
    }
  }, [artistas, busca, filtro])

  const maior = lista[0]?.fonogramas ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Catálogo</h1>
        <p className="text-sm text-ink-400 mt-1">
          Fonogramas mapeados por artista. Abra o artista para ver as faixas.
        </p>
      </div>

      {erro ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-amber-200/90">Não consegui carregar o roster.</div>
        </div>
      ) : artistas === null ? (
        <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando catálogo…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Kpi rotulo="Faixas mapeadas" valor={total.toLocaleString('pt-BR')} />
            <Kpi rotulo="Artistas com catálogo" valor={`${comCatalogo} de ${artistas.length}`} />
            <Kpi
              rotulo="Sem nenhuma faixa"
              valor={String(artistas.length - comCatalogo)}
              alerta={artistas.length - comCatalogo > 0}
            />
          </div>

          {naoContados > 0 && (
            <p className="text-[12px] text-ink-500">
              {naoContados} artista{naoContados === 1 ? '' : 's'} ainda não foram contados — rode{' '}
              <code className="text-ink-300">scripts/atribuir-fonogramas.mjs</code> depois de
              importar catálogo novo.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar artista…"
                aria-label="Buscar artista"
                className="bg-bg-900 border border-bg-700/50 rounded-lg pl-8 pr-3 py-2 text-xs text-ink-200 w-48 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div className="flex items-center gap-1 bg-bg-800 rounded-lg p-1">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFiltro(f.key)}
                  aria-pressed={filtro === f.key}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    filtro === f.key
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'text-ink-400 hover:text-ink-100',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
            {lista.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-500">
                Nenhum artista com esses filtros.
              </div>
            ) : (
              <ul className="divide-y divide-bg-700/30">
                {lista.map((a) => {
                  const n = a.fonogramas ?? 0
                  return (
                    <li key={a.slug}>
                      <Link
                        href={`/artistas/${a.slug}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-bg-800/30 transition-colors"
                      >
                        <AvatarFallback
                          iniciais={iniciaisDe(a.nome)}
                          gradient={corAvatarDe(a.slug)}
                          size="sm"
                          fotoUrl={a.fotoUrl}
                        />
                        <span className="text-sm text-ink-100 font-medium truncate flex-1 min-w-0">
                          {a.nome}
                        </span>

                        {/* Barra proporcional ao maior do roster — dá a escala de
                            relance sem precisar ler todos os números. */}
                        <span
                          className="hidden sm:block w-32 h-1.5 rounded-full bg-bg-800 overflow-hidden shrink-0"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-violet-500/70"
                            style={{ width: maior ? `${Math.max(2, (n / maior) * 100)}%` : '0%' }}
                          />
                        </span>

                        <span
                          className={cn(
                            'num text-xs font-semibold w-16 text-right shrink-0',
                            n === 0 ? 'text-ink-600' : 'text-ink-200',
                          )}
                        >
                          {n === 0 ? '—' : `${n} faixa${n === 1 ? '' : 's'}`}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl px-4 py-3">
      <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase flex items-center gap-1.5">
        <Disc3 className="w-3 h-3" aria-hidden />
        {rotulo}
      </div>
      <div className={cn('num text-2xl font-bold mt-1', alerta ? 'text-amber-400' : 'text-ink-100')}>
        {valor}
      </div>
    </div>
  )
}

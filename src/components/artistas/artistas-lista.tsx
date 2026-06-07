'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, DollarSign, Loader2, Lock, Search } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { ReceitaGate } from '@/components/auth/receita-gate'
import { corAvatarDe, iniciaisDe, listarArtistas, temReceita, type ArtistaDoc } from '@/lib/artistas/client'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

const REDES: { tipo: PlataformaTipo; cor: string; get: (a: ArtistaDoc) => boolean }[] = [
  { tipo: 'spotify', cor: 'text-emerald-400', get: (a) => !!a.redes?.spotify?.url },
  { tipo: 'youtube', cor: 'text-red-400', get: (a) => !!a.redes?.youtube?.url },
  { tipo: 'instagram', cor: 'text-fuchsia-400', get: (a) => !!a.redes?.instagram?.url },
  { tipo: 'tiktok', cor: 'text-cyan-400', get: (a) => !!a.redes?.tiktok?.url },
]

export function ArtistasLista() {
  const { role, loading } = useAuth()
  const [artistas, setArtistas] = useState<ArtistaDoc[] | null>(null)
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')

  const ehAdmin = role === 'admin'

  useEffect(() => {
    if (!ehAdmin) return
    let vivo = true
    listarArtistas()
      .then((as) => vivo && setArtistas(as))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [ehAdmin])

  const filtrados = useMemo(() => {
    if (!artistas) return []
    const q = busca.trim().toLowerCase()
    return q ? artistas.filter((a) => a.nome.toLowerCase().includes(q)) : artistas
  }, [artistas, busca])

  const comReceita = useMemo(() => (artistas ?? []).filter(temReceita).length, [artistas])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  if (!ehAdmin) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-8 flex flex-col items-center text-center">
        <Lock className="w-6 h-6 text-ink-600 mb-3" />
        <h3 className="font-semibold text-ink-100">Lista restrita a administradores</h3>
        <p className="text-sm text-ink-400 mt-1 max-w-md">
          O cadastro de artistas carrega dados de receita — por enquanto, visível só para admins.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-100">Artistas</h1>
          <p className="text-sm text-ink-400 mt-1">
            {artistas === null ? (
              <span className="text-ink-500">carregando…</span>
            ) : (
              <>
                <span className="num text-ink-200">{artistas.length}</span> no cadastro
                <span> · </span>
                <span className="num text-ink-200">{comReceita}</span> com receita importada
              </>
            )}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por nome…"
            className="w-full pl-9 pr-3 py-2 bg-bg-800/50 border border-bg-700/40 rounded-lg text-sm text-ink-200 placeholder:text-ink-500 focus:outline-none focus:border-violet-500/40"
          />
        </div>
      </div>

      {erro ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            Não consegui carregar os artistas do Firestore. Confirme que as regras estão deployadas
            (<span className="num">firebase deploy --only firestore:rules</span>).
          </div>
        </div>
      ) : artistas === null ? (
        <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando artistas…
        </div>
      ) : (
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bg-700/40">
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-4 text-left">
                  Artista
                </th>
                <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-4 text-left">
                  Redes
                </th>
                <ReceitaGate>
                  <th className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-4 text-right">
                    Receita
                  </th>
                </ReceitaGate>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-700/30">
              {filtrados.map((a) => (
                <tr key={a.slug} className="hover:bg-bg-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/artistas/${a.slug}`} className="flex items-center gap-3 group">
                      <AvatarFallback iniciais={iniciaisDe(a.nome)} gradient={corAvatarDe(a.slug)} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-ink-100 group-hover:text-violet-300 transition-colors truncate">
                          {a.nome}
                        </div>
                        <div className="text-[11px] text-ink-500 num truncate">
                          {a.redes?.instagram?.handle ? `@${a.redes.instagram.handle}` : a.slug}
                        </div>
                      </div>
                    </Link>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {REDES.map(({ tipo, cor, get }) => {
                        const tem = get(a)
                        return (
                          <span
                            key={tipo}
                            title={`${tipo}${tem ? '' : ' (sem link)'}`}
                            className={cn('w-4 h-4 block', tem ? cor : 'text-ink-700')}
                          >
                            <PlataformaIcon tipo={tipo} />
                          </span>
                        )
                      })}
                    </div>
                  </td>

                  <ReceitaGate>
                    <td className="px-4 py-3 text-right">
                      {temReceita(a) ? (
                        <div>
                          <div className="num text-sm font-semibold text-emerald-400">
                            {formatCurrency(a.totalBRL ?? 0)}
                          </div>
                          <div className="text-[11px] num text-ink-500">
                            {formatNumber(a.streams ?? 0)} streams
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-600 num text-sm">—</span>
                      )}
                    </td>
                  </ReceitaGate>

                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/artistas/${a.slug}`}
                      className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
                    >
                      ver →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-ink-500">
                    Nenhum artista encontrado para “{busca}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2 text-[12px] text-ink-500">
        <DollarSign className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-600" />
        <span>
          Receita vem da OneRPM. Métricas sociais (seguidores, engajamento) virão das integrações —
          a planilha de redes trouxe os perfis, não os números.
        </span>
      </div>
    </div>
  )
}

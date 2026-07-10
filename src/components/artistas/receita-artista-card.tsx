'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { ChevronDown, DollarSign, Music2 } from 'lucide-react'
import { db } from '@/lib/firebase'
import type { ReceitaPlataforma } from '@/types'
import type { ReceitaArtistaDoc } from '@/lib/onerpm/types'
import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { ReceitaPlataformaItem } from '@/components/artistas/receita-plataforma-item'
import { formatarMoedas, receitaPorFaixaDisplay, receitaPorPlataformaDisplay } from '@/lib/onerpm/display'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

/** Líquido − repasse, moeda a moeda. O que efetivamente fica com o artista. */
function subtrairMoedas(
  net: Record<string, number>,
  repasse: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { ...net }
  for (const [moeda, v] of Object.entries(repasse)) out[moeda] = (out[moeda] ?? 0) - v
  return out
}

/** Mapeia o nome canônico da plataforma para o ícone. */
function iconeDaPlataforma(nome: string): PlataformaTipo {
  const s = nome.toLowerCase()
  if (s.includes('spotify')) return 'spotify'
  if (s.includes('apple')) return 'apple-music'
  if (s.includes('youtube')) return 'youtube'
  if (s.includes('deezer')) return 'deezer'
  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return 'meta'
  if (s.includes('tiktok')) return 'tiktok'
  return 'generica'
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'real'; dados: ReceitaArtistaDoc }
  | { tipo: 'mock' }

/**
 * Card "Receita por plataforma" do perfil do artista.
 * Lê dados REAIS da OneRPM em `receitas/{slug}` (coleção admin-only). Se não houver
 * receita: usa `fallbackItems` quando existir (artistas mock), senão mostra um
 * estado "sem receita importada". O componente só deve ser montado dentro do
 * <ReceitaGate> (admin).
 */
export function ReceitaArtistaCard({
  slug,
  fallbackItems,
}: {
  slug: string
  fallbackItems: ReceitaPlataforma[]
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [verFaixas, setVerFaixas] = useState(false)
  const [verTodasFaixas, setVerTodasFaixas] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'receitas', slug))
        if (!vivo) return
        const data = snap.exists() ? (snap.data() as ReceitaArtistaDoc) : null
        if (data?.receitaPorPlataforma?.length) {
          setEstado({ tipo: 'real', dados: data })
        } else {
          setEstado({ tipo: 'mock' })
        }
      } catch {
        // Sem permissão / offline / doc inexistente -> usa o mock.
        if (vivo) setEstado({ tipo: 'mock' })
      }
    })()
    return () => {
      vivo = false
    }
  }, [slug])

  if (estado.tipo === 'carregando') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 flex items-center gap-2 text-sm text-ink-400">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Carregando receita…
      </div>
    )
  }

  const real = estado.tipo === 'real' ? estado.dados : null
  // A receita por plataforma sai do `agregado` (por moeda). O `receitaPorPlataforma`
  // gravado é fallback pra docs antigos — ele trazia um valor único convertido.
  const items = real
    ? real.agregado
      ? receitaPorPlataformaDisplay(real.agregado)
      : real.receitaPorPlataforma
    : fallbackItems

  // Artista real sem receita importada (e sem mock de fallback): estado limpo.
  if (!real && items.length === 0) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 text-sm text-ink-400 flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-ink-600" />
        Sem receita importada para este artista ainda.
      </div>
    )
  }

  // Total do artista, por moeda original (nunca somado entre moedas).
  const netPorMoeda = real?.totais?.netPorMoeda ?? {}
  const repassePorMoeda = real?.repassePorMoeda ?? {}
  const temRepasse = Object.values(repassePorMoeda).some((v) => Math.abs(v) >= 0.005)

  // Receita por música (agrupa lançamentos), a partir do agregado por moeda.
  const faixas = real?.agregado ? receitaPorFaixaDisplay(real.agregado, real.nome) : []
  const faixasVisiveis = verTodasFaixas ? faixas : faixas.slice(0, 10)

  const periodoLabel = real
    ? real.periodo.transactionMonths.length
      ? `${real.periodo.transactionMonths[0]} → ${real.periodo.transactionMonths[real.periodo.transactionMonths.length - 1]}`
      : 'período importado'
    : 'abr/2026'

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="p-5 flex items-center justify-between border-b border-bg-700/30 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 grid place-items-center shrink-0">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100">Receita por plataforma</span>
              <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                {real ? 'FONTE: ONERPM' : 'FONTE: ONERPM · DDEX'}
              </span>
              {real && (
                <span className="text-[10px] tracking-wider font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  DADOS REAIS
                </span>
              )}
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              {real
                ? `Importado da OneRPM · líquido na moeda original (sem conversão)`
                : 'Dados oficiais de streaming · período de referência: abr/2026'}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
            {real ? `Total ${periodoLabel}` : 'Total 30D'}
          </div>
          {real ? (
            <div className="num text-lg font-bold text-emerald-400 leading-tight">
              {formatarMoedas(netPorMoeda)}
            </div>
          ) : (
            <>
              <div className="num text-2xl font-bold text-emerald-400">
                {formatCurrency(items.reduce((a, r) => a + (r.receita ?? 0), 0))}
              </div>
              <div className="text-[11px] text-emerald-400 num">↑ 24% vs. mês anterior</div>
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-bg-700/30">
        {items.map((item) => (
          <ReceitaPlataformaItem
            key={item.plataforma}
            item={item}
            icone={<PlataformaIcon tipo={iconeDaPlataforma(item.plataforma)} />}
          />
        ))}
      </div>

      {/* Receita por música — agrupa lançamentos; começa recolhida (pode ter centenas). */}
      {real && faixas.length > 0 && (
        <div className="border-t border-bg-700/30">
          <button
            type="button"
            onClick={() => setVerFaixas((v) => !v)}
            aria-expanded={verFaixas}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-5 py-3.5 border-l-2 transition-colors',
              verFaixas
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-amber-500/40 bg-amber-500/[0.06] hover:bg-amber-500/15'
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="w-6 h-6 rounded-md bg-amber-500/20 grid place-items-center shrink-0">
                <Music2 className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <span className="text-[11px] tracking-wider font-bold uppercase text-amber-300">
                Receita por faixa
              </span>
              <span className="text-[11px] text-ink-500 num truncate">· {faixas.length} músicas</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 shrink-0">
              <span className="hidden sm:inline">{verFaixas ? 'Recolher' : 'Ver por música'}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', verFaixas && 'rotate-180')} />
            </span>
          </button>

          {verFaixas && (
            <div className="px-5 pb-4">
              <div className="divide-y divide-bg-700/20">
                {faixasVisiveis.map((f) => (
                  <div key={f.titulo} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink-100 truncate">{f.titulo}</div>
                      <div className="text-[11px] text-ink-500 num">
                        {formatNumber(f.streams)} streams
                        {f.lancamentos > 1 && ` · ${f.lancamentos} lançamentos`}
                      </div>
                    </div>
                    <div className="num text-[13px] font-semibold text-ink-200 shrink-0 text-right">
                      {formatarMoedas(f.receitaPorMoeda)}
                    </div>
                  </div>
                ))}
              </div>
              {faixas.length > 10 && (
                <button
                  type="button"
                  onClick={() => setVerTodasFaixas((v) => !v)}
                  className="mt-3 text-[12px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  {verTodasFaixas ? 'Mostrar menos' : `Ver todas as ${faixas.length} músicas`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Split artista × selo — só aparece pra quem tem repasse na OneRPM. */}
      {real && temRepasse && (
        <div className="border-t border-bg-700/30 px-5 py-4 space-y-2">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
            Divisão com o selo
          </div>
          <Linha rotulo="Receita gerada" valor={formatarMoedas(netPorMoeda)} />
          <Linha rotulo="Repasse à Imagine" valor={`− ${formatarMoedas(repassePorMoeda)}`} sutil />
          <div className="pt-2 border-t border-bg-700/30">
            <Linha
              rotulo="Fica com o artista"
              valor={formatarMoedas(subtrairMoedas(netPorMoeda, repassePorMoeda))}
              destaque
            />
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-bg-700/30 flex items-center justify-between">
        <div className="text-[11px] text-ink-500 num">
          {real
            ? `Última importação OneRPM · ${real.streams.toLocaleString('pt-BR')} streams no período`
            : 'Última atualização DDEX: 02/05/2026 02:14 · próxima coleta: em 14h'}
        </div>
        <span className="text-violet-400/60 text-sm">Exportar relatório completo ↓</span>
      </div>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  sutil,
  destaque,
}: {
  rotulo: string
  valor: string
  sutil?: boolean
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={destaque ? 'font-semibold text-ink-100' : 'text-ink-400'}>{rotulo}</span>
      <span
        className={
          destaque
            ? 'num font-bold text-emerald-400'
            : sutil
              ? 'num text-amber-400/90'
              : 'num text-ink-200'
        }
      >
        {valor}
      </span>
    </div>
  )
}


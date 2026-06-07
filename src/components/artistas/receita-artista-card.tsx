'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { DollarSign } from 'lucide-react'
import { db } from '@/lib/firebase'
import type { ReceitaPlataforma } from '@/types'
import type { ReceitaArtistaDoc } from '@/lib/onerpm/types'
import type { PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { ReceitaPlataformaItem } from '@/components/artistas/receita-plataforma-item'
import { formatCurrency } from '@/lib/utils'

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
  const items = real ? real.receitaPorPlataforma : fallbackItems

  // Artista real sem receita importada (e sem mock de fallback): estado limpo.
  if (!real && items.length === 0) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 text-sm text-ink-400 flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-ink-600" />
        Sem receita importada para este artista ainda.
      </div>
    )
  }

  const total = items.reduce((acc, r) => acc + r.receita, 0)

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
                ? `Importado da OneRPM · ${fmtMoedas(real)} · líquido convertido (câmbio placeholder)`
                : 'Dados oficiais de streaming · período de referência: abr/2026'}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
            {real ? `Total ${periodoLabel}` : 'Total 30D'}
          </div>
          <div className="num text-2xl font-bold text-emerald-400">{formatCurrency(total)}</div>
          {!real && <div className="text-[11px] text-emerald-400 num">↑ 24% vs. mês anterior</div>}
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

function fmtMoedas(real: ReceitaArtistaDoc): string {
  const net = real.totais?.netPorMoeda ?? {}
  const partes = Object.entries(net)
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const simbolo = k === 'BRL' ? 'R$' : k === 'USD' ? 'US$' : k + ' '
      return `${simbolo} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    })
  return partes.length ? partes.join(' + ') : '—'
}

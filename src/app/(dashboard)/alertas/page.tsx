'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, Flame, MoonStar, Star } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { corAvatarDe, iniciaisDe, listarArtistas } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { derivarAlertas, type AlertaDerivado, type SeveridadeAlerta } from '@/lib/alertas/derivar'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const SEV: Record<SeveridadeAlerta, { label: string; borderL: string; badgeBg: string; badgeText: string }> = {
  critico: { label: 'CRÍTICO', borderL: 'bg-red-500', badgeBg: 'bg-red-500/15', badgeText: 'text-red-400' },
  atencao: { label: 'ATENÇÃO', borderL: 'bg-amber-500', badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-400' },
  oportunidade: { label: 'OPORTUNIDADE', borderL: 'bg-emerald-500', badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-400' },
  operacional: { label: 'OPERACIONAL', borderL: 'bg-blue-500', badgeBg: 'bg-blue-500/15', badgeText: 'text-blue-400' },
}

const ICONE: Record<string, LucideIcon> = {
  viralizacao: Flame,
  destaque: Star,
  sem_postar: MoonStar,
}

const PILLS: { key: 'todos' | SeveridadeAlerta; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'critico', label: 'Críticos' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'oportunidade', label: 'Oportunidades' },
]

export default function AlertasPage() {
  const [estado, setEstado] = useState<'load' | 'erro' | 'ok'>('load')
  const [alertas, setAlertas] = useState<AlertaDerivado[]>([])
  const [filtro, setFiltro] = useState<'todos' | SeveridadeAlerta>('todos')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [mapa, arts] = await Promise.all([listarMetricasSociais(), listarArtistas()])
        if (!vivo) return
        const nome = new Map(arts.map((a) => [a.slug, a.nome]))
        setAlertas(derivarAlertas(mapa, nome))
        setEstado('ok')
      } catch {
        if (vivo) setEstado('erro')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<SeveridadeAlerta, number> = { critico: 0, atencao: 0, oportunidade: 0, operacional: 0 }
    for (const a of alertas) c[a.severidade] += 1
    return c
  }, [alertas])

  const filtrados = useMemo(
    () => (filtro === 'todos' ? alertas : alertas.filter((a) => a.severidade === filtro)),
    [alertas, filtro],
  )

  if (estado === 'load') {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-16 justify-center">
        <span className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-transparent animate-spin" />
        Analisando os dados…
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Não foi possível carregar</h1>
        <p className="text-sm text-ink-400 mt-2">Verifique se você é membro ativo e se as regras do Firestore estão deployadas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink-100">Alertas</h1>
        <p className="text-sm text-ink-400 mt-1">
          <span className="num text-ink-200">{alertas.length} abertos</span>
          {counts.critico > 0 && <> · <span className="num text-red-400">{counts.critico} críticos</span></>}
          {counts.atencao > 0 && <> · <span className="num text-amber-400">{counts.atencao} atenção</span></>}
          {counts.oportunidade > 0 && <> · <span className="num text-emerald-400">{counts.oportunidade} oportunidades</span></>}
        </p>
        <p className="text-[12px] text-ink-500 mt-0.5">
          Gerados automaticamente a partir dos dados de YouTube e Instagram.
        </p>
      </div>

      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {PILLS.map((pill) => {
          const n = pill.key === 'todos' ? alertas.length : counts[pill.key]
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFiltro(pill.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                filtro === pill.key
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'bg-bg-800 text-ink-400 hover:text-ink-100 border-transparent',
              )}
            >
              {pill.label}
              <span className="ml-1.5 num text-ink-500">({n})</span>
            </button>
          )
        })}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-8 text-center">
          <p className="text-sm text-ink-300 font-medium">Nenhum alerta por aqui</p>
          <p className="text-[13px] text-ink-500 mt-1 max-w-md mx-auto">
            Conforme as sincronizações rodam, os destaques e quedas dos artistas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="divide-y divide-bg-700/30">
            {filtrados.map((a) => (
              <Linha key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Linha({ a }: { a: AlertaDerivado }) {
  const sev = SEV[a.severidade]
  const Icone = ICONE[a.categoria] ?? Bell
  const interno = a.url?.startsWith('/') ?? false

  const acao = a.url ? (
    interno ? (
      <Link href={a.url} className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-center transition-colors">
        {a.acaoSugerida} →
      </Link>
    ) : (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-sm font-semibold shrink-0 self-center transition-colors">
        {a.acaoSugerida} →
      </a>
    )
  ) : null

  return (
    <div className="relative flex items-start gap-3 p-4 hover:bg-bg-800/30 transition-colors">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', sev.borderL)} />
      <AvatarFallback iniciais={iniciaisDe(a.artistaNome)} gradient={corAvatarDe(a.artistaSlug)} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 rounded', sev.badgeBg, sev.badgeText)}>
            {sev.label}
          </span>
          <span className="text-[11px] text-ink-500 num">{tempoRel(a.ts)}</span>
        </div>
        <div className="font-semibold text-sm text-ink-100">{a.artistaNome}</div>
        <div className="text-[13px] text-ink-300 mt-0.5 flex items-start gap-1.5">
          <Icone className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', sev.badgeText)} />
          <span className="min-w-0">{a.descricao}</span>
        </div>
      </div>
      {acao}
    </div>
  )
}

function tempoRel(ms: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return `há ${Math.floor(d / 30)}m`
}

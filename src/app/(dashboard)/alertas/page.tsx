'use client'

import { useEffect, useMemo, useState } from 'react'
import { listarArtistas } from '@/lib/artistas/client'
import { listarMetricasSociais } from '@/lib/metricas-sociais/client'
import { derivarAlertas, type AlertaDerivado, type SeveridadeAlerta } from '@/lib/alertas/derivar'
import { filtrarPorPrefs } from '@/lib/alertas/preferencias'
import { AlertaLinha } from '@/components/alertas/alerta-linha'
import { cn } from '@/lib/utils'

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
        setAlertas(filtrarPorPrefs(derivarAlertas(mapa, nome)))
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
              <AlertaLinha key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

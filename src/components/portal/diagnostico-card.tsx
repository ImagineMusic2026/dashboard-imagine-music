'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ClipboardList, Check } from 'lucide-react'
import { getDiagnostico } from '@/lib/diagnostico/client'
import { NOME_CURTO, progressoDe, TIPOS, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { cn } from '@/lib/utils'

type Estado = { pct: number; respondidas: number; total: number; enviado: boolean }

/**
 * Convite pro artista responder os questionários de estruturação, no /meu-perfil.
 * Mostra o progresso de cada um pra ele saber onde parou — são ~40 perguntas no
 * total, e a ideia é que ele volte várias vezes.
 */
export function DiagnosticoCard({ slug }: { slug: string }) {
  const [estados, setEstados] = useState<Record<string, Estado>>({})

  useEffect(() => {
    let vivo = true
    Promise.all(
      TIPOS.map(async (tipo) => {
        const d = await getDiagnostico(slug, tipo).catch(() => null)
        const p = progressoDe(tipo, d?.respostas)
        return [tipo, { ...p, enviado: d?.status === 'enviado' }] as const
      })
    )
      .then((pares) => vivo && setEstados(Object.fromEntries(pares)))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [slug])

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30">
        <div className="flex items-center gap-2 font-bold text-ink-100">
          <ClipboardList className="w-4 h-4 text-violet-400 shrink-0" />
          Questionário de estruturação
        </div>
        <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
          É com essas respostas que a gente monta o seu plano estratégico. Pode responder aos poucos — salva sozinho.
        </p>
      </div>

      <div className="divide-y divide-bg-700/30">
        {TIPOS.map((tipo) => (
          <Linha key={tipo} tipo={tipo} estado={estados[tipo]} />
        ))}
      </div>
    </div>
  )
}

function Linha({ tipo, estado }: { tipo: TipoDiagnostico; estado?: Estado }) {
  const pct = estado?.pct ?? 0
  const completo = pct === 100
  return (
    <Link
      href={`/diagnostico/${tipo}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-bg-800/40 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-ink-100">{NOME_CURTO[tipo]}</span>
          {estado?.enviado && (
            <span className="flex items-center gap-1 text-[10px] tracking-wider font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <Check className="w-2.5 h-2.5" />
              ENVIADO
            </span>
          )}
        </div>
        <div className="text-[12px] text-ink-500 num mt-0.5">
          {estado ? `${estado.respondidas} de ${estado.total} respondidas` : 'carregando…'}
        </div>
        <div className="h-1 rounded-full bg-bg-800 mt-2 overflow-hidden max-w-xs">
          <div
            className={cn('h-full rounded-full transition-all duration-500', completo ? 'bg-emerald-500' : 'bg-violet-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-[12px] text-violet-400 group-hover:text-violet-300 flex items-center gap-1 shrink-0 transition-colors">
        {pct > 0 && !completo ? 'Continuar' : completo ? 'Revisar' : 'Responder'}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  )
}

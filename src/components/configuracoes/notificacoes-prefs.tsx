'use client'

import { useEffect, useState } from 'react'
import { Bell, Mail } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SEV, ICONE_ALERTA } from '@/components/alertas/alerta-linha'
import type { SeveridadeAlerta } from '@/lib/alertas/derivar'
import {
  CATEGORIAS_ALERTA,
  getSilenciados,
  setCategoriaAtiva,
  type CategoriaAlerta,
} from '@/lib/alertas/preferencias'
import { cn } from '@/lib/utils'

const META: Record<CategoriaAlerta, { label: string; descricao: string; sev: SeveridadeAlerta }> = {
  viralizacao: {
    label: 'Conteúdo viralizando',
    descricao: 'Posts e vídeos crescendo rápido nas primeiras horas.',
    sev: 'oportunidade',
  },
  destaque: {
    label: 'Conteúdo em destaque',
    descricao: 'Publicações muito acima da média do artista.',
    sev: 'oportunidade',
  },
  crescimento_seguidores: {
    label: 'Crescimento de seguidores',
    descricao: 'Aceleração de seguidores ou inscritos.',
    sev: 'oportunidade',
  },
  marco_seguidores: {
    label: 'Marcos de seguidores',
    descricao: 'Quando um artista cruza um número redondo.',
    sev: 'oportunidade',
  },
  sem_postar: {
    label: 'Artista sem postar',
    descricao: 'Quem passou de uma semana sem publicar.',
    sev: 'atencao',
  },
  queda_seguidores: {
    label: 'Queda de seguidores',
    descricao: 'Perda relevante de seguidores ou inscritos.',
    sev: 'critico',
  },
}

/** Aba "Notificações" das Configurações. Controla quais tipos de alerta notificam. */
export function NotificacoesPrefs() {
  // Set de categorias silenciadas; null enquanto não leu o localStorage (evita flash).
  const [silenciados, setSilenciados] = useState<Set<string> | null>(null)

  useEffect(() => {
    setSilenciados(getSilenciados())
  }, [])

  function alternar(cat: CategoriaAlerta, ativa: boolean) {
    setCategoriaAtiva(cat, ativa)
    setSilenciados((prev) => {
      const s = new Set(prev ?? [])
      if (ativa) s.delete(cat)
      else s.add(cat)
      return s
    })
  }

  const ativos = silenciados
    ? CATEGORIAS_ALERTA.filter((c) => !silenciados.has(c)).length
    : null

  return (
    <div className="space-y-4">
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="font-bold text-ink-100">Tipos de alerta</div>
          <p className="text-[12px] text-ink-400 mt-0.5">
            Escolha o que aparece no sino e no feed de Alertas.{' '}
            {ativos !== null && (
              <span className="text-ink-500">
                {ativos} de {CATEGORIAS_ALERTA.length} ativos.
              </span>
            )}
          </p>
        </div>

        <div className="divide-y divide-bg-700/30">
          {CATEGORIAS_ALERTA.map((cat) => {
            const m = META[cat]
            const sev = SEV[m.sev]
            const Icone = ICONE_ALERTA[cat] ?? Bell
            const ativa = silenciados ? !silenciados.has(cat) : true
            return (
              <div key={cat} className="flex items-center gap-3 sm:gap-4 p-4">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg grid place-items-center shrink-0',
                    sev.badgeBg,
                    sev.badgeText,
                  )}
                >
                  <Icone className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink-100">{m.label}</span>
                    <span
                      className={cn(
                        'hidden sm:inline-block text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded',
                        sev.badgeBg,
                        sev.badgeText,
                      )}
                    >
                      {sev.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-500 mt-0.5">{m.descricao}</p>
                </div>
                <Toggle
                  ligado={ativa}
                  carregando={silenciados === null}
                  onClick={() => alternar(cat, !ativa)}
                  rotulo={`Notificar sobre ${m.label}`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Canais — por ora só o painel; e-mail entra depois. */}
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30">
          <div className="font-bold text-ink-100">Canais de entrega</div>
          <p className="text-[12px] text-ink-400 mt-0.5">Por onde os alertas chegam.</p>
        </div>
        <div className="divide-y divide-bg-700/30">
          <Canal
            Icon={Bell}
            titulo="Painel (sino)"
            descricao="Aparecem no sino e no menu lateral, em tempo real."
            estado="ativo"
          />
          <Canal
            Icon={Mail}
            titulo="E-mail"
            descricao="Resumo dos alertas críticos por e-mail."
            estado="breve"
          />
        </div>
      </div>

      <p className="px-1 text-[11px] text-ink-500">Preferências salvas neste navegador.</p>
    </div>
  )
}

function Canal({
  Icon,
  titulo,
  descricao,
  estado,
}: {
  Icon: LucideIcon
  titulo: string
  descricao: string
  estado: 'ativo' | 'breve'
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 p-4">
      <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-bg-800 text-ink-400">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100">{titulo}</div>
        <p className="text-[12px] text-ink-500 mt-0.5">{descricao}</p>
      </div>
      {estado === 'ativo' ? (
        <span className="shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
          ATIVO
        </span>
      ) : (
        <span className="shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-bg-800 text-ink-500 border-bg-700/50">
          EM BREVE
        </span>
      )}
    </div>
  )
}

/** Toggle on/off no estilo do switch das permissões. */
function Toggle({
  ligado,
  carregando,
  onClick,
  rotulo,
}: {
  ligado: boolean
  carregando: boolean
  onClick: () => void
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onClick}
      disabled={carregando}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50',
        ligado ? 'bg-emerald-500/80' : 'bg-bg-700',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          ligado ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusYouTube } from '@/lib/metricas-sociais/client'
import type { IntegracaoYouTubeDoc } from '@/lib/metricas-sociais/types'
import { cn } from '@/lib/utils'

/**
 * Card REAL da integração YouTube na página de Integrações. Camada PÚBLICA:
 * admin usa "Descobrir canais" (resolve channelId dos links) e "Sincronizar".
 * Camada ANALYTICS (privada): conexão é por artista, no perfil/portal — aqui só
 * mostramos quantos já conectaram.
 */
type Acao = null | 'descobrir' | 'sincronizar'

export function YouTubeCard() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [status, setStatus] = useState<IntegracaoYouTubeDoc | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState<Acao>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setStatus(await getStatusYouTube())
    } catch {
      setStatus(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const executar = useCallback(
    async (qual: 'descobrir' | 'sincronizar') => {
      setAcao(qual)
      setMsg(null)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
        const res = await fetch(`/api/integracoes/youtube/${qual}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Falha na operação.')
        setMsg({
          tipo: 'ok',
          texto:
            qual === 'descobrir'
              ? `${data.mapeados} de ${data.totalArtistas} canal(is) mapeado(s)${data.novos?.length ? ` · ${data.novos.length} novo(s)` : ''}.`
              : `${data.sincronizados} canal(is) sincronizado(s)${data.comAnalytics ? ` · ${data.comAnalytics} com Analytics` : ''}${data.falhas ? ` · ${data.falhas} falha(s)` : ''}.`,
        })
        await recarregar()
      } catch (e) {
        setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
      } finally {
        setAcao(null)
      }
    },
    [recarregar],
  )

  const conectado = status?.status === 'conectado'
  const erro = status?.status === 'erro'
  const mapeados = status?.canaisMapeados ?? 0
  const total = status?.totalArtistas ?? 0
  const conectadas = status?.contasConectadas ?? 0
  const pct = total > 0 ? Math.min(100, (mapeados / total) * 100) : 0

  const badge = carregando
    ? { texto: '···', classe: 'text-ink-400 bg-ink-500/10 border-ink-500/30' }
    : conectado
      ? { texto: 'CONECTADO', classe: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' }
      : erro
        ? { texto: 'ERRO', classe: 'text-red-400 bg-red-500/15 border-red-500/30' }
        : { texto: 'NÃO CONECTADO', classe: 'text-ink-400 bg-ink-500/10 border-ink-500/30' }

  return (
    <div
      className={cn(
        'bg-bg-900 border rounded-xl overflow-hidden flex flex-col',
        erro ? 'border-red-500/30' : 'border-bg-700/40',
      )}
    >
      <div className="p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 text-red-400 bg-red-500/15">
          <span className="w-6 h-6 block">
            <PlataformaIcon tipo="youtube" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-ink-100 leading-none">YouTube</span>
            <span className={cn('text-[10px] tracking-wider font-bold px-1.5 py-0.5 rounded border', badge.classe)}>
              {badge.texto}
            </span>
          </div>
          <p className="text-[12px] text-ink-400 mt-1">Data API (público) + Analytics (por artista)</p>
        </div>
      </div>

      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400">Canais mapeados</span>
          <span className="num font-semibold text-ink-300">
            <span className={conectado ? 'text-emerald-400' : 'text-ink-300'}>{mapeados}</span>
            <span className="text-ink-500">/{total}</span>
          </span>
        </div>
        <div className="h-2 bg-bg-700 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="text-center">
            <div className="num font-bold text-base text-red-300">{mapeados}</div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">mapeados</div>
          </div>
          <div className="text-center">
            <div className="num font-bold text-base text-emerald-400">{conectadas}</div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">analytics</div>
          </div>
          <div className="text-center">
            <div className="num font-bold text-base text-ink-300">
              {status?.ultimaSincronizacao ? formatarQuando(status.ultimaSincronizacao) : '—'}
            </div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">última coleta</div>
          </div>
        </div>

        {msg && (
          <div
            className={cn(
              'mt-3 text-[12px] rounded-lg px-3 py-2 border',
              msg.tipo === 'ok'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-300 bg-red-500/10 border-red-500/30',
            )}
          >
            {msg.texto}
          </div>
        )}
        {!msg && erro && status?.erro && (
          <div className="mt-3 text-[12px] rounded-lg px-3 py-2 border text-red-300 bg-red-500/10 border-red-500/30">
            {status.erro}
          </div>
        )}

        {!carregando && (
          <div className="mt-3 text-[11px] rounded-lg px-3 py-2 border border-bg-700/40 bg-bg-950/40 text-ink-400 leading-snug">
            A base pública sai do cadastro de canais (Descobrir + Sincronizar). O{' '}
            <span className="text-emerald-300">Analytics</span> (tempo de exibição, retenção) é por
            artista — conecte no perfil do artista ou pelo portal dele.
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-bg-700/40 bg-bg-950/30 flex items-center justify-between gap-2">
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={() => executar('descobrir')}
              disabled={acao !== null}
              className="flex items-center gap-1.5 text-[12px] text-ink-200 hover:text-white disabled:opacity-50 transition-colors"
            >
              {acao === 'descobrir' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Descobrir canais
            </button>
            <button
              type="button"
              onClick={() => executar('sincronizar')}
              disabled={acao !== null || mapeados === 0}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-50 transition-colors"
              title={mapeados === 0 ? 'Descubra/mapeie canais primeiro' : undefined}
            >
              {acao === 'sincronizar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sincronizar agora
            </button>
          </>
        ) : (
          <span className="text-[11px] text-ink-500">Apenas administradores gerenciam a conexão.</span>
        )}
      </div>
    </div>
  )
}

function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

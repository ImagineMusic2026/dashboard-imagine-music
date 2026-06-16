'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusTikTok } from '@/lib/metricas-sociais/client'
import type { IntegracaoTikTokDoc } from '@/lib/metricas-sociais/types'
import { cn } from '@/lib/utils'

/**
 * Card REAL da integração TikTok na página de Integrações. Lê o status de
 * `integracoes/tiktok` no Firestore e oferece, para admins, a ação "Sincronizar
 * agora" (coleta as métricas de quem já autorizou). Diferente do Meta, NÃO há
 * "descobrir contas": cada artista autoriza individualmente (Login Kit) — no
 * próprio portal ou por um link gerado no perfil do artista.
 */
export function TikTokCard() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [status, setStatus] = useState<IntegracaoTikTokDoc | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setStatus(await getStatusTikTok())
    } catch {
      setStatus(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const sincronizar = useCallback(async () => {
    setSincronizando(true)
    setMsg(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/integracoes/tiktok/sincronizar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha na sincronização.')
      setMsg({
        tipo: 'ok',
        texto: `${data.sincronizados} conta(s) sincronizada(s)${data.falhas ? ` · ${data.falhas} falha(s)` : ''}.`,
      })
      await recarregar()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setSincronizando(false)
    }
  }, [recarregar])

  const conectado = status?.status === 'conectado'
  const erro = status?.status === 'erro'
  const conectadas = status?.contasConectadas ?? 0
  const total = status?.totalArtistas ?? 0
  const sincronizadas = status?.contasSincronizadas ?? 0
  const pct = total > 0 ? Math.min(100, (conectadas / total) * 100) : 0

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
        <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 text-cyan-400 bg-bg-950 border border-bg-700">
          <span className="w-6 h-6 block">
            <PlataformaIcon tipo="tiktok" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-ink-100 leading-none">TikTok</span>
            <span
              className={cn(
                'text-[10px] tracking-wider font-bold px-1.5 py-0.5 rounded border',
                badge.classe,
              )}
            >
              {badge.texto}
            </span>
          </div>
          <p className="text-[12px] text-ink-400 mt-1">Display API · seguidores, curtidas, engajamento</p>
        </div>
      </div>

      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400">Contas conectadas</span>
          <span className="num font-semibold text-ink-300">
            <span className={conectado ? 'text-emerald-400' : 'text-ink-300'}>{conectadas}</span>
            <span className="text-ink-500">/{total}</span>
          </span>
        </div>
        <div className="h-2 bg-bg-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="text-center">
            <div className="num font-bold text-base text-cyan-300">{conectadas}</div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">conectadas</div>
          </div>
          <div className="text-center">
            <div className="num font-bold text-base text-emerald-400">{sincronizadas}</div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">coletadas</div>
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

        {!carregando && conectadas === 0 && (
          <div className="mt-3 text-[11px] rounded-lg px-3 py-2 border border-bg-700/40 bg-bg-950/40 text-ink-400 leading-snug">
            Cada artista conecta a própria conta (Login Kit). Abra o perfil de um artista e use
            <span className="text-cyan-300"> “Gerar link de conexão”</span>, ou peça para o artista
            conectar pelo portal dele.
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-bg-700/40 bg-bg-950/30 flex items-center justify-between gap-2">
        {isAdmin ? (
          <>
            <span className="text-[11px] text-ink-500">Conexão por artista (perfil/portal)</span>
            <button
              type="button"
              onClick={sincronizar}
              disabled={sincronizando || conectadas === 0}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50 transition-colors"
              title={conectadas === 0 ? 'Conecte ao menos uma conta primeiro' : undefined}
            >
              {sincronizando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
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

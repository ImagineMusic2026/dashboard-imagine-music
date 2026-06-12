'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusMeta } from '@/lib/metricas-sociais/client'
import type { IntegracaoMetaDoc } from '@/lib/metricas-sociais/types'
import { cn } from '@/lib/utils'

/**
 * Card REAL da integração Instagram (Meta) na página de Integrações. Lê o status
 * de `integracoes/meta` no Firestore e, para admins, oferece as ações
 * "Descobrir contas" (mapeia @handle -> IG User ID) e "Sincronizar agora"
 * (coleta métricas). Substitui o card mock de Instagram.
 */

type AcaoEmAndamento = null | 'descobrir' | 'sincronizar'

type ResultadoDescoberta = {
  casados: { slug: string; username: string }[]
  contasNaoUsadas: string[]
}

export function MetaInstagramCard() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [status, setStatus] = useState<IntegracaoMetaDoc | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState<AcaoEmAndamento>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [descoberta, setDescoberta] = useState<ResultadoDescoberta | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setStatus(await getStatusMeta())
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
      setDescoberta(null)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
        const res = await fetch(`/api/integracoes/meta/${qual}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Falha na operação.')
        setMsg({
          tipo: 'ok',
          texto:
            qual === 'descobrir'
              ? `${data.mapeados} de ${data.totalArtistas} artista(s) vinculados · ${data.contasDescobertas} conta(s) encontradas no Meta.`
              : `${data.sincronizados} conta(s) sincronizada(s)${
                  data.falhas ? ` · ${data.falhas} falha(s)` : ''
                }.`,
        })
        if (qual === 'descobrir') {
          setDescoberta({
            casados: data.casados ?? [],
            contasNaoUsadas: data.contasNaoUsadas ?? [],
          })
        }
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
  const mapeadas = status?.contasMapeadas ?? 0
  const total = status?.totalArtistas ?? 0
  const sincronizadas = status?.contasSincronizadas ?? 0
  const pct = total > 0 ? Math.min(100, (mapeadas / total) * 100) : 0

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
        <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 text-white bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
          <span className="w-6 h-6 block">
            <PlataformaIcon tipo="instagram" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg text-ink-100 leading-none">Instagram</span>
            <span
              className={cn(
                'text-[10px] tracking-wider font-bold px-1.5 py-0.5 rounded border',
                badge.classe,
              )}
            >
              {badge.texto}
            </span>
          </div>
          <p className="text-[12px] text-ink-400 mt-1">Meta Graph API · seguidores, alcance, engajamento</p>
        </div>
      </div>

      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400">Contas vinculadas</span>
          <span className="num font-semibold text-ink-300">
            <span className={conectado ? 'text-emerald-400' : 'text-ink-300'}>{mapeadas}</span>
            <span className="text-ink-500">/{total}</span>
          </span>
        </div>
        <div className="h-2 bg-bg-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="text-center">
            <div className="num font-bold text-base text-fuchsia-300">{mapeadas}</div>
            <div className="text-[10px] text-ink-500 uppercase tracking-wider">vinculadas</div>
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

        {descoberta && (descoberta.casados.length > 0 || descoberta.contasNaoUsadas.length > 0) && (
          <div className="mt-3 space-y-2">
            {descoberta.casados.length > 0 && (
              <div className="text-[11px] rounded-lg px-3 py-2 border border-bg-700/40 bg-bg-950/40">
                <div className="text-ink-400 font-semibold mb-1.5">
                  Vinculados ({descoberta.casados.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {descoberta.casados.map((c) => (
                    <span
                      key={c.slug}
                      className="num text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5"
                    >
                      @{c.username}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {descoberta.contasNaoUsadas.length > 0 && (
              <div className="text-[11px] rounded-lg px-3 py-2 border border-amber-500/30 bg-amber-500/5">
                <div className="text-amber-400 font-semibold mb-1">
                  Encontradas no Meta, sem artista correspondente ({descoberta.contasNaoUsadas.length})
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {descoberta.contasNaoUsadas.map((u) => (
                    <span
                      key={u}
                      className="num text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5"
                    >
                      @{u}
                    </span>
                  ))}
                </div>
                <div className="text-amber-200/70 text-[10px] leading-snug">
                  Provável @ digitado diferente no cadastro do artista — ajuste o handle pra casar.
                </div>
              </div>
            )}
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
              {acao === 'descobrir' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Descobrir contas
            </button>
            <button
              type="button"
              onClick={() => executar('sincronizar')}
              disabled={acao !== null || mapeadas === 0}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
              title={mapeadas === 0 ? 'Descubra/vincule contas primeiro' : undefined}
            >
              {acao === 'sincronizar' ? (
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

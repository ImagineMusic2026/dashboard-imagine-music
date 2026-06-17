'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusMeta } from '@/lib/metricas-sociais/client'
import type { IntegracaoMetaDoc } from '@/lib/metricas-sociais/types'
import {
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  ChipsColeta,
  FonteCardCompacta,
  FonteModal,
  MensagemAcao,
  StatTile,
  formatarQuando,
  statusBadge,
} from './fonte-ui'

/**
 * Card REAL da integração Instagram (Meta). Lê `integracoes/meta` no Firestore;
 * no modal "ver mais", admins têm "Descobrir contas" (@handle -> IG User ID) e
 * "Sincronizar agora" (coleta métricas).
 */
const ICONE = <PlataformaIcon tipo="instagram" />
const COR_ICONE = 'text-white bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500'

type AcaoEmAndamento = null | 'descobrir' | 'sincronizar'
type ResultadoDescoberta = { casados: { slug: string; username: string }[]; contasNaoUsadas: string[] }

export function MetaInstagramCard() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [aberto, setAberto] = useState(false)
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
              ? `${data.mapeados} de ${data.totalArtistas} artista(s) vinculados · ${data.contasDescobertas} conta(s) no Meta.`
              : `${data.sincronizados} conta(s) sincronizada(s)${data.falhas ? ` · ${data.falhas} falha(s)` : ''}.`,
        })
        if (qual === 'descobrir') {
          setDescoberta({ casados: data.casados ?? [], contasNaoUsadas: data.contasNaoUsadas ?? [] })
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
  const mapeadas = status?.contasMapeadas ?? 0
  const total = status?.totalArtistas ?? 0
  const sincronizadas = status?.contasSincronizadas ?? 0
  const badge = statusBadge(carregando, status?.status)

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="Instagram"
        descricao="Meta Graph API · seguidores, alcance, engajamento"
        badge={badge}
        resumo={carregando ? '···' : `${mapeadas} vinculada(s)`}
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="Instagram"
          subtitle="Meta Graph API · coleta diária automática"
          badge={badge}
          onClose={() => setAberto(false)}
          footer={
            isAdmin ? (
              <>
                <button type="button" onClick={() => executar('descobrir')} disabled={acao !== null} className={BTN_SECUNDARIO}>
                  {acao === 'descobrir' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Descobrir contas
                </button>
                <button
                  type="button"
                  onClick={() => executar('sincronizar')}
                  disabled={acao !== null || mapeadas === 0}
                  className={BTN_PRIMARIO}
                  title={mapeadas === 0 ? 'Descubra/vincule contas primeiro' : undefined}
                >
                  {acao === 'sincronizar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sincronizar agora
                </button>
              </>
            ) : (
              <span className="text-[11px] text-ink-500">Apenas administradores gerenciam a conexão.</span>
            )
          }
        >
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              valor={
                <>
                  <span className={conectado ? 'text-emerald-400' : 'text-ink-100'}>{mapeadas}</span>
                  <span className="text-ink-500 text-sm">/{total}</span>
                </>
              }
              label="contas vinculadas"
            />
            <StatTile valor={sincronizadas} label="coletadas" cor="text-emerald-400" />
            <StatTile valor={status?.ultimaSincronizacao ? formatarQuando(status.ultimaSincronizacao) : '—'} label="última atualização" />
          </div>

          <ChipsColeta itens={['seguidores', 'alcance', 'visualizações', 'engajamento']} />

          {msg && <MensagemAcao msg={msg} />}
          {!msg && status?.status === 'erro' && status?.erro && <MensagemAcao msg={{ tipo: 'erro', texto: status.erro }} />}

          {descoberta && (descoberta.casados.length > 0 || descoberta.contasNaoUsadas.length > 0) && (
            <div className="space-y-2">
              {descoberta.casados.length > 0 && (
                <div className="text-[11px] rounded-lg px-3 py-2 border border-bg-700/40 bg-bg-950/40">
                  <div className="text-ink-400 font-semibold mb-1.5">Vinculados ({descoberta.casados.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {descoberta.casados.map((c) => (
                      <span key={c.slug} className="num text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                        @{c.username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {descoberta.contasNaoUsadas.length > 0 && (
                <div className="text-[11px] rounded-lg px-3 py-2 border border-amber-500/30 bg-amber-500/5">
                  <div className="text-amber-400 font-semibold mb-1">No Meta, sem artista correspondente ({descoberta.contasNaoUsadas.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {descoberta.contasNaoUsadas.map((u) => (
                      <span key={u} className="num text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                        @{u}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-ink-500 leading-snug">
            Um token de System User lê todas as contas vinculadas. Use “Descobrir contas” para casar os @ do cadastro com o Meta.
          </p>
        </FonteModal>
      )}
    </>
  )
}

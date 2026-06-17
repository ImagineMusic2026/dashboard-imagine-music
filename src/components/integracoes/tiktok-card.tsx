'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusTikTok } from '@/lib/metricas-sociais/client'
import type { IntegracaoTikTokDoc } from '@/lib/metricas-sociais/types'
import {
  BTN_PRIMARIO,
  ChipsColeta,
  FonteCardCompacta,
  FonteModal,
  MensagemAcao,
  StatTile,
  formatarQuando,
  statusBadge,
} from './fonte-ui'

/**
 * Card REAL da integração TikTok. Lê `integracoes/tiktok`; no modal, admins têm
 * "Sincronizar agora". Diferente do Meta, NÃO há "descobrir contas": cada
 * artista autoriza individualmente (Login Kit), no portal ou por link.
 */
const ICONE = <PlataformaIcon tipo="tiktok" />
const COR_ICONE = 'text-cyan-400 bg-bg-950 border border-bg-700'

export function TikTokCard() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [aberto, setAberto] = useState(false)
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
  const conectadas = status?.contasConectadas ?? 0
  const total = status?.totalArtistas ?? 0
  const sincronizadas = status?.contasSincronizadas ?? 0
  const badge = statusBadge(carregando, status?.status)

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="TikTok"
        descricao="Display API · seguidores, curtidas, vídeos"
        badge={badge}
        resumo={carregando ? '···' : `${conectadas} conectada(s)`}
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="TikTok"
          subtitle="Display API · conexão por artista (Login Kit)"
          badge={badge}
          onClose={() => setAberto(false)}
          footer={
            isAdmin ? (
              <button
                type="button"
                onClick={sincronizar}
                disabled={sincronizando || conectadas === 0}
                className={BTN_PRIMARIO}
                title={conectadas === 0 ? 'Conecte ao menos uma conta primeiro' : undefined}
              >
                {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sincronizar agora
              </button>
            ) : (
              <span className="text-[11px] text-ink-500">Apenas administradores gerenciam a conexão.</span>
            )
          }
        >
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              valor={
                <>
                  <span className={conectado ? 'text-cyan-300' : 'text-ink-100'}>{conectadas}</span>
                  <span className="text-ink-500 text-sm">/{total}</span>
                </>
              }
              label="contas conectadas"
            />
            <StatTile valor={sincronizadas} label="coletadas" cor="text-emerald-400" />
            <StatTile valor={status?.ultimaSincronizacao ? formatarQuando(status.ultimaSincronizacao) : '—'} label="última atualização" />
          </div>

          <ChipsColeta itens={['seguidores', 'curtidas', 'vídeos', 'views', 'comentários', 'shares']} />

          {msg && <MensagemAcao msg={msg} />}
          {!msg && status?.status === 'erro' && status?.erro && <MensagemAcao msg={{ tipo: 'erro', texto: status.erro }} />}

          <p className="text-[11px] text-ink-500 leading-snug">
            Cada artista conecta a própria conta (Login Kit). Abra o perfil de um artista e use
            <span className="text-cyan-300"> “Gerar link de conexão”</span>, ou peça para o artista conectar pelo portal dele.
          </p>
        </FonteModal>
      )}
    </>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { listarContasVinculadas } from '@/lib/artistas/client'
import { getStatusYouTube } from '@/lib/metricas-sociais/client'
import type { IntegracaoYouTubeDoc } from '@/lib/metricas-sociais/types'
import {
  BTN_PRIMARIO,
  BTN_SECUNDARIO,
  ChipsColeta,
  FonteCardCompacta,
  FonteModal,
  MensagemAcao,
  PainelContasVinculadas,
  StatTile,
  formatarQuando,
  statusBadge,
} from './fonte-ui'

/**
 * Card REAL da integração YouTube. Camada PÚBLICA (Data API): admin "Descobrir
 * canais" + "Sincronizar". Camada ANALYTICS (privada): conexão por artista no
 * perfil/portal — aqui só mostramos quantos já conectaram.
 */
const ICONE = <PlataformaIcon tipo="youtube" />
const COR_ICONE = 'text-red-400 bg-red-500/15'

export function YouTubeCard() {
  const { pode } = useAuth()
  const isAdmin = pode('integracoes')

  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<IntegracaoYouTubeDoc | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState<null | 'descobrir' | 'sincronizar'>(null)
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
  const mapeados = status?.canaisMapeados ?? 0
  const total = status?.totalArtistas ?? 0
  const comAnalytics = status?.contasConectadas ?? 0
  const badge = statusBadge(carregando, status?.status)

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="YouTube"
        descricao="Data API (público) + Analytics (por artista)"
        badge={badge}
        resumo={carregando ? '···' : `${mapeados} canal(is)`}
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="YouTube"
          subtitle="Data API (público) + Analytics (por artista)"
          badge={badge}
          onClose={() => setAberto(false)}
          footer={
            isAdmin ? (
              <>
                <button type="button" onClick={() => executar('descobrir')} disabled={acao !== null} className={BTN_SECUNDARIO}>
                  {acao === 'descobrir' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Descobrir canais
                </button>
                <button
                  type="button"
                  onClick={() => executar('sincronizar')}
                  disabled={acao !== null || mapeados === 0}
                  className={BTN_PRIMARIO}
                  title={mapeados === 0 ? 'Descubra/mapeie canais primeiro' : undefined}
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
                  <span className={conectado ? 'text-emerald-400' : 'text-ink-100'}>{mapeados}</span>
                  <span className="text-ink-500 text-sm">/{total}</span>
                </>
              }
              label="canais mapeados"
            />
            <StatTile valor={comAnalytics} label="com Analytics" cor="text-emerald-400" />
            <StatTile valor={status?.ultimaSincronizacao ? formatarQuando(status.ultimaSincronizacao) : '—'} label="última atualização" />
          </div>

          <PainelContasVinculadas
            total={mapeados}
            rotulo="canais mapeados"
            carregar={() => listarContasVinculadas('youtube')}
            recarregarSinal={status}
            icon={ICONE}
            corIcone={COR_ICONE}
            nomeFonte="YouTube"
            corHandle="text-red-300"
          />

          <ChipsColeta itens={['inscritos', 'views', 'vídeos', 'tempo de exibição', 'retenção']} />

          {msg && <MensagemAcao msg={msg} />}
          {!msg && status?.status === 'erro' && status?.erro && <MensagemAcao msg={{ tipo: 'erro', texto: status.erro }} />}

          <p className="text-[11px] text-ink-500 leading-snug">
            A base pública sai do cadastro de canais (Descobrir + Sincronizar). O{' '}
            <span className="text-emerald-300">Analytics</span> (tempo de exibição, retenção) é por artista — conecte no perfil do artista ou pelo portal dele.
          </p>
        </FonteModal>
      )}
    </>
  )
}

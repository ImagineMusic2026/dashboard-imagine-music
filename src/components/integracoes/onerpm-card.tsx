'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PlayCircle, RefreshCw } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusOneRpm } from '@/lib/metricas-sociais/client'
import type { IntegracaoOneRpmDoc } from '@/lib/metricas-sociais/types'
import { formatNumber } from '@/lib/utils'
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
 * Card REAL da integração OneRPM (streaming via SFTP). Lê `integracoes/onerpm`;
 * no modal, admins têm "Sincronizar agora" (baixa os últimos dias do feed de
 * trends). A carga histórica (backfill) é feita por script; aqui é o incremento.
 * NÃO é receita — essa continua no relatório mensal, em coleção separada.
 */
const ICONE = <PlayCircle className="w-full h-full" />
const COR_ICONE = 'text-white bg-gradient-to-br from-amber-500 to-orange-600'

export function OneRpmCard() {
  const { pode } = useAuth()
  const isAdmin = pode('integracoes')

  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<IntegracaoOneRpmDoc | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setStatus(await getStatusOneRpm())
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
      const res = await fetch('/api/integracoes/onerpm/sincronizar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha na sincronização.')
      setMsg({
        tipo: 'ok',
        texto: `${data.gravados} artista(s) atualizado(s) · ${data.arquivos} arquivo(s).`,
      })
      await recarregar()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setSincronizando(false)
    }
  }, [recarregar])

  const conectado = status?.status === 'conectado'
  const artistas = status?.artistasSincronizados ?? 0
  const badge = statusBadge(carregando, status?.status)
  const resumo = carregando
    ? '···'
    : conectado
      ? `${formatNumber(status?.streamsJanela ?? 0)} streams · ${artistas} artistas`
      : 'aguardando 1ª coleta'

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="OneRPM"
        descricao="Distribuidora · streaming por faixa (SFTP)"
        badge={badge}
        resumo={resumo}
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="OneRPM"
          subtitle="Feed de trends (CSV diário) via SFTP"
          badge={badge}
          onClose={() => setAberto(false)}
          footer={
            isAdmin ? (
              <button type="button" onClick={sincronizar} disabled={sincronizando} className={BTN_PRIMARIO}>
                {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sincronizar agora
              </button>
            ) : (
              <span className="text-[11px] text-ink-500">Apenas administradores gerenciam a coleta.</span>
            )
          }
        >
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              valor={<span className={conectado ? 'text-amber-300' : 'text-ink-100'}>{artistas}</span>}
              label="artistas atualizados"
            />
            <StatTile valor={conectado ? formatNumber(status?.streamsJanela ?? 0) : '—'} label={`streams (${status?.janelaDias ?? 35}d)`} cor="text-emerald-400" />
            <StatTile valor={status?.ultimaSincronizacao ? formatarQuando(status.ultimaSincronizacao) : '—'} label="última atualização" />
          </div>

          <ChipsColeta titulo="O QUE COBRE" itens={['streams', 'skips', 'países', 'plataformas', 'por faixa (ISRC)']} />

          {msg && <MensagemAcao msg={msg} />}
          {!msg && status?.status === 'erro' && status?.erro && <MensagemAcao msg={{ tipo: 'erro', texto: status.erro }} />}

          <p className="text-[11px] text-ink-500 leading-snug">
            O feed vem por arquivo (CSV diário via SFTP), não por API ao vivo — o sync diário mantém
            atualizado{status?.ultimoDia ? ` (último dia disponível: ${status.ultimoDia})` : ''}. A
            <span className="text-amber-300"> receita</span> (R$) continua no relatório mensal, em coleção separada.
          </p>
        </FonteModal>
      )}
    </>
  )
}

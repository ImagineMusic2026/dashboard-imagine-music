'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PlayCircle, RefreshCw } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getStatusOneRpm, getStatusTikTokUgc, listarArtistasComStreaming } from '@/lib/metricas-sociais/client'
import type { IntegracaoOneRpmDoc, IntegracaoTikTokUgcDoc } from '@/lib/metricas-sociais/types'
import { invalidarCachesDeLeitura } from '@/lib/cache-leitura'
import { cn, formatNumber } from '@/lib/utils'
import {
  BTN_PRIMARIO,
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
  const [tiktok, setTiktok] = useState<IntegracaoTikTokUgcDoc | null>(null)
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
    // Sync separado (feed de TikTok por faixa): falhar aqui não pode apagar o
    // status do streaming, que é o dado principal do card.
    getStatusTikTokUgc()
      .then(setTiktok)
      .catch(() => setTiktok(null))
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
      // O sync reescreve as métricas — as listas do painel precisam reler.
      invalidarCachesDeLeitura()
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

          <PainelContasVinculadas
            total={artistas}
            rotulo="artistas com streaming"
            carregar={listarArtistasComStreaming}
            recarregarSinal={status}
            icon={ICONE}
            corIcone={COR_ICONE}
            nomeFonte="OneRPM"
            corHandle="text-amber-300"
          />

          <ChipsColeta titulo="O QUE COBRE" itens={['streams', 'skips', 'países', 'plataformas', 'por faixa (ISRC)']} />

          {msg && <MensagemAcao msg={msg} />}
          {!msg && status?.status === 'erro' && status?.erro && <MensagemAcao msg={{ tipo: 'erro', texto: status.erro }} />}

          {/* Pasta do feed que o sync não consegue ler. Sincronizar ignorando é o
              certo (o resto do streaming entra), mas precisa APARECER: foi
              exatamente uma pasta nova e silenciosa que segurou o sync por 10 dias. */}
          {!!status?.lojasIgnoradas?.length && (
            <div className="text-[12px] rounded-lg px-3 py-2 border text-amber-200 bg-amber-500/10 border-amber-500/30">
              <strong>
                {status.lojasIgnoradas.length === 1
                  ? 'Uma pasta do feed foi ignorada'
                  : `${status.lojasIgnoradas.length} pastas do feed foram ignoradas`}
              </strong>{' '}
              por não ter formato de streaming:{' '}
              {status.lojasIgnoradas.map((l) => l.loja).join(', ')}. O restante sincronizou
              normalmente.
            </div>
          )}

          {/* Feed de TikTok por faixa: mesma fonte, execução própria (cron às 5h05).
              Mostrado aqui pra não repetir a história de agosto — um sync que a tela
              não exibe é um sync que pode ficar semanas quebrado sem ninguém ver. */}
          {tiktok && (
            <div
              className={cn(
                'text-[12px] rounded-lg px-3 py-2 border flex flex-wrap items-center gap-x-2 gap-y-1',
                tiktok.status === 'erro'
                  ? 'text-red-300 bg-red-500/10 border-red-500/30'
                  : 'text-ink-300 bg-bg-800/60 border-bg-700/40',
              )}
            >
              <span className="font-semibold text-ink-100">TikTok por faixa</span>
              {tiktok.status === 'erro' ? (
                <span>{tiktok.erro ?? 'falhou na última execução'}</span>
              ) : (
                <span className="num">
                  {formatNumber(tiktok.viewsJanela ?? 0)} views · {tiktok.artistasSincronizados ?? 0}{' '}
                  artistas
                  {tiktok.ultimaSincronizacao
                    ? ` · há ${formatarQuando(tiktok.ultimaSincronizacao)}`
                    : ''}
                </span>
              )}
            </div>
          )}

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

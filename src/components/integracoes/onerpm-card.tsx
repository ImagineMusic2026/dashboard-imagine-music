'use client'

import { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { BADGES, ChipsColeta, FonteCardCompacta, FonteModal } from './fonte-ui'
import { cn } from '@/lib/utils'

/**
 * Card do OneRPM — fonte oficial de receita/streaming via SFTP no padrão DDEX
 * (DSR). NÃO está coletando ainda (aguardando a documentação do feed de trends
 * + arquivo de exemplo), então mostramos o status honesto, sem números.
 */
const ICONE = <PlayCircle className="w-full h-full" />
const COR_ICONE = 'text-white bg-gradient-to-br from-amber-500 to-orange-600'
const BADGE = { texto: 'CONFIGURANDO', classe: BADGES.pendente }

function Passo({ ok, texto, detalhe }: { ok?: boolean; texto: string; detalhe?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5', ok ? 'bg-emerald-400' : 'bg-amber-400')} />
      <div>
        <div className={cn('text-[13px]', ok ? 'text-ink-200' : 'text-ink-300')}>{texto}</div>
        {detalhe && <div className="text-[11px] text-ink-500">{detalhe}</div>}
      </div>
    </div>
  )
}

export function OneRpmCard() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="OneRPM"
        descricao="Distribuidora · receita e streaming (DDEX)"
        badge={BADGE}
        resumo="acesso SFTP ok"
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="OneRPM"
          subtitle="Distribuidora oficial · relatórios via padrão DDEX (DSR)"
          badge={BADGE}
          onClose={() => setAberto(false)}
        >
          <div className="space-y-2.5">
            <Passo ok texto="Acesso ao servidor (SFTP) confirmado" />
            <Passo texto="Documentação do feed de trends (DSR) + arquivo de exemplo" detalhe="aguardando o contato da OneRPM" />
            <Passo texto="Primeira coleta de receita e streams" detalhe="depois da documentação" />
          </div>

          <ChipsColeta titulo="O QUE VAI COBRIR" itens={['receita', 'streams', 'plataformas de streaming']} />

          <p className="text-[11px] text-ink-500 leading-snug">
            Diferente das redes sociais, o OneRPM entrega os dados por arquivo (DDEX/DSR), não por API ao vivo.
            Assim que o feed de trends for documentado e liberado, a coleta de receita e streaming entra no ar.
          </p>
        </FonteModal>
      )}
    </>
  )
}

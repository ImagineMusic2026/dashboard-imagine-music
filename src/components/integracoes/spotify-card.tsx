'use client'

import { useState } from 'react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { BADGES, ChipsColeta, FonteCardCompacta, FonteModal } from './fonte-ui'

/**
 * Card do Spotify for Artists — ainda NÃO integrado. Receita/streams do Spotify
 * já vêm pela OneRPM; aqui entraria a camada complementar de audiência e
 * descoberta. Card honesto "em breve", sem números.
 */
const ICONE = <PlataformaIcon tipo="spotify" />
const COR_ICONE = 'text-white bg-emerald-500'
const BADGE = { texto: 'EM BREVE', classe: BADGES.neutro }

export function SpotifyCard() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <FonteCardCompacta
        icon={ICONE}
        corIcone={COR_ICONE}
        nome="Spotify for Artists"
        descricao="Audiência e demografia complementar"
        badge={BADGE}
        resumo="não integrado"
        atenuado
        onVerMais={() => setAberto(true)}
      />

      {aberto && (
        <FonteModal
          icon={ICONE}
          corIcone={COR_ICONE}
          nome="Spotify for Artists"
          subtitle="Audiência e demografia (planejado)"
          badge={BADGE}
          onClose={() => setAberto(false)}
        >
          <p className="text-[13px] text-ink-300 leading-relaxed">
            A receita e os streams do Spotify já chegam pela OneRPM. O Spotify for Artists entraria como camada
            complementar de <span className="text-ink-100">audiência e descoberta</span> — dados que a distribuidora não fornece.
          </p>

          <ChipsColeta
            titulo="VAI COMPLEMENTAR COM"
            itens={['ouvintes mensais', 'demografia', 'fontes de descoberta', 'playlists']}
          />

          <p className="text-[11px] text-ink-500 leading-snug">
            Ainda não integrado — depende da API/credenciais do Spotify for Artists. Sem previsão definida.
          </p>
        </FonteModal>
      )}
    </>
  )
}

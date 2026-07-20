'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { WHATSAPP_VINCULO_PADRAO, getWhatsappVinculo } from '@/lib/configuracoes/client'

/**
 * CTA do portal: o artista solicita a vinculação das redes. Abre o WhatsApp da
 * Imagine (link wa.me) com a mensagem já preenchida — a Imagine recebe e orienta
 * o artista a conceder o acesso. Não envia nada sozinho; é o artista que dispara.
 *
 * O número vive no painel (configuracoes/geral, editável pelo admin na aba
 * Perfil). Começa no padrão de fábrica e, ao ler o Firestore, adota o que o admin
 * configurou. Sempre há um número — o botão nunca fica sem destino.
 */
export function VincularRedesCard({ nome, igHandle }: { nome: string; igHandle?: string | null }) {
  const [whatsapp, setWhatsapp] = useState(WHATSAPP_VINCULO_PADRAO)

  useEffect(() => {
    let vivo = true
    getWhatsappVinculo()
      .then((n) => {
        if (vivo && n) setWhatsapp(n)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const msg = `Olá! Sou ${nome}${igHandle ? ` (@${igHandle})` : ''} e quero vincular minhas redes sociais ao painel da Imagine.`
  const href = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}` : null

  return (
    <div className="bg-gradient-to-br from-fuchsia-500/10 to-bg-900 border border-fuchsia-500/30 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 grid place-items-center shrink-0 text-white">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="instagram" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink-100">Vincular redes sociais</div>
          <p className="text-[13px] text-ink-400 mt-1 max-w-xl">
            Pra trazer suas métricas (seguidores, alcance, engajamento) pra cá, a Imagine precisa de
            acesso à sua conta profissional do Instagram. Toque no botão pra solicitar — a conta
            continua sua, é só uma concessão de acesso.
          </p>
          <div className="mt-3">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Solicitar pelo WhatsApp
              </a>
            ) : (
              <span className="text-[12px] text-amber-400">
                Canal de solicitação ainda não configurado — fale com a Imagine.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

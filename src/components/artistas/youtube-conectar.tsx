'use client'

import { useEffect, useState } from 'react'
import { Check, ExternalLink, Link2, Loader2, Unplug } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { copiarTexto } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

/**
 * Conexão da camada ANALYTICS do YouTube (OAuth do Google). A base pública do
 * canal já funciona sem isto — conectar só ADICIONA tempo de exibição, retenção,
 * inscritos ganhos/perdidos etc. Adapta-se ao papel de quem está logado:
 *  - Artista (portal): "Conectar meu YouTube" → redireciona pro consentimento.
 *  - Admin (painel): "Gerar link" → copia a URL pra enviar ao artista.
 *  - Marketing: não renderiza.
 */
type Msg = { tipo: 'ok' | 'erro' | 'info'; texto: string }

export function YouTubeConectar({ slug }: { slug: string }) {
  const { role } = useAuth()
  const ehArtista = role === 'artista'
  const ehAdmin = role === 'admin'

  const [carregando, setCarregando] = useState<null | 'conectar' | 'desconectar'>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [confirmarDesc, setConfirmarDesc] = useState(false)

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('youtube')
    if (v === 'ok') setMsg({ tipo: 'ok', texto: 'YouTube Analytics conectado! Os dados aparecem após a próxima sincronização.' })
    else if (v === 'negado') setMsg({ tipo: 'erro', texto: 'Autorização cancelada no Google.' })
    else if (v === 'erro') setMsg({ tipo: 'erro', texto: 'Não foi possível concluir a conexão do YouTube.' })
  }, [])

  if (!ehArtista && !ehAdmin) return null

  async function token() {
    const t = await auth.currentUser?.getIdToken()
    if (!t) throw new Error('Sua sessão expirou. Entre novamente.')
    return t
  }

  async function conectar() {
    setCarregando('conectar')
    setMsg(null)
    setLink(null)
    try {
      const qs = ehAdmin ? `?slug=${encodeURIComponent(slug)}` : ''
      const res = await fetch(`/api/integracoes/youtube/conectar${qs}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao iniciar a conexão.')

      if (ehArtista) {
        window.location.href = data.url as string
        return
      }
      setLink(data.url as string)
      const ok = await copiarTexto(data.url as string)
      setMsg({
        tipo: 'ok',
        texto: ok
          ? 'Link copiado — envie ao artista para ele autorizar com a conta dele.'
          : 'Link gerado abaixo — copie e envie ao artista.',
      })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setCarregando(null)
    }
  }

  async function desconectar() {
    if (!confirmarDesc) {
      setConfirmarDesc(true)
      return
    }
    setCarregando('desconectar')
    setMsg(null)
    try {
      const qs = ehAdmin ? `?slug=${encodeURIComponent(slug)}` : ''
      const res = await fetch(`/api/integracoes/youtube/desconectar${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao desconectar.')
      setMsg({ tipo: 'info', texto: 'Analytics desconectado. A base pública do canal continua sendo coletada.' })
      setLink(null)
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setConfirmarDesc(false)
      setCarregando(null)
    }
  }

  return (
    <div className="bg-gradient-to-br from-red-500/10 to-bg-900 border border-red-500/30 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-red-500/15 grid place-items-center shrink-0 text-red-400">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="youtube" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink-100">
            {ehArtista ? 'Conectar meu YouTube (Analytics)' : 'Conectar Analytics do YouTube'}
          </div>
          <p className="text-[13px] text-ink-400 mt-1 max-w-xl">
            {ehArtista
              ? 'Os números públicos do seu canal já entram no painel. Conectar adiciona os dados de Analytics (tempo de exibição, retenção, inscritos ganhos/perdidos). A conta continua sua e dá pra desconectar quando quiser.'
              : 'A base pública do canal já é coletada. Isto adiciona o Analytics (privado): gere o link e envie ao artista — ele autoriza com a conta dele, sem precisar da senha.'}
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={conectar}
              disabled={carregando !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {carregando === 'conectar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {ehArtista ? 'Conectar meu YouTube' : 'Gerar link de Analytics'}
            </button>

            <button
              type="button"
              onClick={desconectar}
              disabled={carregando !== null}
              className={cn(
                'inline-flex items-center gap-1.5 text-[12px] transition-colors disabled:opacity-50',
                confirmarDesc ? 'text-red-300 font-semibold' : 'text-ink-500 hover:text-ink-300',
              )}
            >
              {carregando === 'desconectar' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5" />
              )}
              {confirmarDesc ? 'Confirmar desconexão?' : 'Desconectar Analytics'}
            </button>
          </div>

          {msg && (
            <div
              className={cn(
                'mt-3 text-[12px] rounded-lg px-3 py-2 border inline-flex items-start gap-1.5',
                msg.tipo === 'ok'
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                  : msg.tipo === 'info'
                    ? 'text-ink-300 bg-bg-950/60 border-bg-700/50'
                    : 'text-red-300 bg-red-500/10 border-red-500/30',
              )}
            >
              {msg.tipo === 'ok' && <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              <span>{msg.texto}</span>
            </div>
          )}

          {link && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 text-[12px] num text-ink-300 bg-bg-950 border border-bg-700/60 rounded-lg px-3 py-2"
                />
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] text-red-300 hover:text-red-200"
                  title="Abrir o link (só faça isso se você for o próprio artista)"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </a>
              </div>
              <p className="text-[10px] text-ink-600 mt-1">
                O link vale por 15 minutos. Quem abrir autoriza a própria conta do YouTube.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

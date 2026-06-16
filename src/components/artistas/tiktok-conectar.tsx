'use client'

import { useEffect, useState } from 'react'
import { Check, ExternalLink, Link2, Loader2, Unplug } from 'lucide-react'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { copiarTexto } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

/**
 * Ação de conexão do TikTok no perfil do artista. Adapta-se ao papel de quem
 * está logado (PerfilArtistaReal é usado tanto no painel da equipe quanto no
 * portal do artista):
 *  - Artista: "Conectar meu TikTok" → busca a URL e redireciona o navegador
 *    para o consentimento (autoriza a PRÓPRIA conta).
 *  - Admin: "Gerar link de conexão" → busca a URL e copia, para enviar ao
 *    artista (o admin NÃO completa o OAuth, senão vincularia a conta dele).
 *  - Marketing: não gerencia conexões → não renderiza nada.
 */
type Msg = { tipo: 'ok' | 'erro' | 'info'; texto: string }

export function TikTokConectar({ slug }: { slug: string }) {
  const { role } = useAuth()
  const ehArtista = role === 'artista'
  const ehAdmin = role === 'admin'

  const [carregando, setCarregando] = useState<null | 'conectar' | 'desconectar'>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [confirmarDesc, setConfirmarDesc] = useState(false)

  // Banner de retorno do OAuth (?tiktok=ok|erro|negado), usado no portal.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('tiktok')
    if (v === 'ok') setMsg({ tipo: 'ok', texto: 'TikTok conectado! As métricas aparecem após a próxima sincronização.' })
    else if (v === 'negado') setMsg({ tipo: 'erro', texto: 'Autorização cancelada no TikTok.' })
    else if (v === 'erro') setMsg({ tipo: 'erro', texto: 'Não foi possível concluir a conexão com o TikTok.' })
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
      const res = await fetch(`/api/integracoes/tiktok/conectar${qs}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao iniciar a conexão.')

      if (ehArtista) {
        window.location.href = data.url as string // vai para o consentimento do TikTok
        return
      }
      // Admin: copia o link para enviar ao artista.
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
      const res = await fetch(`/api/integracoes/tiktok/desconectar${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao desconectar.')
      setMsg({ tipo: 'info', texto: 'TikTok desconectado. A coleta foi interrompida (o histórico fica salvo).' })
      setLink(null)
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setConfirmarDesc(false)
      setCarregando(null)
    }
  }

  return (
    <div className="bg-gradient-to-br from-cyan-500/10 to-bg-900 border border-cyan-500/30 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-bg-950 border border-bg-700 grid place-items-center shrink-0 text-cyan-400">
          <span className="w-5 h-5 block">
            <PlataformaIcon tipo="tiktok" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink-100">
            {ehArtista ? 'Conectar meu TikTok' : 'Conectar TikTok do artista'}
          </div>
          <p className="text-[13px] text-ink-400 mt-1 max-w-xl">
            {ehArtista
              ? 'Autorize a Imagine a ler suas métricas públicas do TikTok (seguidores, curtidas, engajamento). A conta continua sua — é só uma concessão de acesso, e dá pra desconectar quando quiser.'
              : 'Gere um link de autorização e envie ao artista. Ele abre o link e autoriza com a conta dele — você não precisa da senha do TikTok.'}
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={conectar}
              disabled={carregando !== null}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {carregando === 'conectar' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {ehArtista ? 'Conectar meu TikTok' : 'Gerar link de conexão'}
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
              {confirmarDesc ? 'Confirmar desconexão?' : 'Desconectar'}
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
                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] text-cyan-300 hover:text-cyan-200"
                  title="Abrir o link (só faça isso se você for o próprio artista)"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </a>
              </div>
              <p className="text-[10px] text-ink-600 mt-1">
                O link vale por 15 minutos. Quem abrir autoriza a própria conta do TikTok.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

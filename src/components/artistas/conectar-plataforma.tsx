'use client'

import { useEffect, useState } from 'react'
import { Check, ExternalLink, Link2, Loader2, Unplug } from 'lucide-react'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { copiarTexto } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

/**
 * Ação de conexão de uma plataforma (TikTok ou YouTube Analytics) no perfil do
 * artista. Renderiza um ícone no header que abre um popover com a explicação e o
 * botão. Adapta-se ao papel de quem está logado — PerfilArtistaReal é usado tanto
 * no painel da equipe quanto no portal do artista:
 *  - Artista: "Conectar minha conta" → busca a URL e redireciona pro consentimento
 *    (autoriza a PRÓPRIA conta).
 *  - Admin: "Gerar link" → busca a URL e copia, pra enviar ao artista (o admin NÃO
 *    completa o OAuth, senão vincularia a conta dele).
 *  - Marketing: não gerencia conexões → não renderiza nada.
 */
type Msg = { tipo: 'ok' | 'erro' | 'info'; texto: string }

type Textos = { titulo: string; descricao: string; cta: string }

type ConectarConfig = {
  tipo: PlataformaTipo
  /** Base dos endpoints; vira `${apiBase}/conectar` e `${apiBase}/desconectar`. */
  apiBase: string
  /** Parâmetro de retorno do OAuth na URL (?<param>=ok|negado|erro). */
  returnParam: string
  admin: Textos
  artista: Textos
  desconectarLabel: string
  msg: { conectado: string; negado: string; erro: string; desconectado: string }
  linkRodape: string
  // Classes específicas da plataforma (Tailwind exige strings literais).
  triggerBorda: string
  triggerTexto: string
  badgeBg: string
  headerIcone: string
  ctaBg: string
  abrirTexto: string
}

const CONFIG: Record<'tiktok' | 'youtube', ConectarConfig> = {
  tiktok: {
    tipo: 'tiktok',
    apiBase: '/api/integracoes/tiktok',
    returnParam: 'tiktok',
    admin: {
      titulo: 'Conectar TikTok do artista',
      descricao:
        'Gere um link de autorização e envie ao artista. Ele abre o link e autoriza com a conta dele — você não precisa da senha do TikTok.',
      cta: 'Gerar link de conexão',
    },
    artista: {
      titulo: 'Conectar meu TikTok',
      descricao:
        'Autorize a Imagine a ler suas métricas públicas do TikTok (seguidores, curtidas, engajamento). A conta continua sua — é só uma concessão de acesso, e dá pra desconectar quando quiser.',
      cta: 'Conectar meu TikTok',
    },
    desconectarLabel: 'Desconectar',
    msg: {
      conectado: 'TikTok conectado! As métricas aparecem após a próxima sincronização.',
      negado: 'Autorização cancelada no TikTok.',
      erro: 'Não foi possível concluir a conexão com o TikTok.',
      desconectado: 'TikTok desconectado. A coleta foi interrompida (o histórico fica salvo).',
    },
    linkRodape: 'O link vale por 15 minutos. Quem abrir autoriza a própria conta do TikTok.',
    triggerBorda: 'border-cyan-500/40 focus-visible:ring-cyan-500/40',
    triggerTexto: 'text-cyan-400',
    badgeBg: 'bg-cyan-500',
    headerIcone: 'bg-bg-950 border border-bg-700 text-cyan-400',
    ctaBg: 'bg-cyan-500 hover:bg-cyan-600',
    abrirTexto: 'text-cyan-300 hover:text-cyan-200',
  },
  youtube: {
    tipo: 'youtube',
    apiBase: '/api/integracoes/youtube',
    returnParam: 'youtube',
    admin: {
      titulo: 'Conectar Analytics do YouTube',
      descricao:
        'A base pública do canal já é coletada. Isto adiciona o Analytics (privado): gere o link e envie ao artista — ele autoriza com a conta dele, sem precisar da senha.',
      cta: 'Gerar link de Analytics',
    },
    artista: {
      titulo: 'Conectar meu YouTube (Analytics)',
      descricao:
        'Os números públicos do seu canal já entram no painel. Conectar adiciona os dados de Analytics (tempo de exibição, retenção, inscritos ganhos/perdidos). A conta continua sua e dá pra desconectar quando quiser.',
      cta: 'Conectar meu YouTube',
    },
    desconectarLabel: 'Desconectar Analytics',
    msg: {
      conectado: 'YouTube Analytics conectado! Os dados aparecem após a próxima sincronização.',
      negado: 'Autorização cancelada no Google.',
      erro: 'Não foi possível concluir a conexão do YouTube.',
      desconectado: 'Analytics desconectado. A base pública do canal continua sendo coletada.',
    },
    linkRodape: 'O link vale por 15 minutos. Quem abrir autoriza a própria conta do YouTube.',
    triggerBorda: 'border-red-500/40 focus-visible:ring-red-500/40',
    triggerTexto: 'text-red-400',
    badgeBg: 'bg-red-500',
    headerIcone: 'bg-red-500/15 text-red-400',
    ctaBg: 'bg-red-500 hover:bg-red-600',
    abrirTexto: 'text-red-300 hover:text-red-200',
  },
}

export function ConectarPlataforma({
  slug,
  plataforma,
}: {
  slug: string
  plataforma: 'tiktok' | 'youtube'
}) {
  const cfg = CONFIG[plataforma]
  const { role } = useAuth()
  const ehArtista = role === 'artista'
  const ehAdmin = role === 'admin'

  const [carregando, setCarregando] = useState<null | 'conectar' | 'desconectar'>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [confirmarDesc, setConfirmarDesc] = useState(false)
  const [aberto, setAberto] = useState(false)

  // Abre o popover ao voltar do consentimento (?<param>=...) pra mostrar o resultado.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(cfg.returnParam)
    if (v === 'ok') setMsg({ tipo: 'ok', texto: cfg.msg.conectado })
    else if (v === 'negado') setMsg({ tipo: 'erro', texto: cfg.msg.negado })
    else if (v === 'erro') setMsg({ tipo: 'erro', texto: cfg.msg.erro })
    else return
    setAberto(true)
  }, [cfg])

  if (!ehArtista && !ehAdmin) return null

  const txt = ehArtista ? cfg.artista : cfg.admin

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
      const res = await fetch(`${cfg.apiBase}/conectar${qs}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao iniciar a conexão.')

      if (ehArtista) {
        window.location.href = data.url as string // vai para o consentimento
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
      const res = await fetch(`${cfg.apiBase}/desconectar${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Falha ao desconectar.')
      setMsg({ tipo: 'info', texto: cfg.msg.desconectado })
      setLink(null)
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro inesperado.' })
    } finally {
      setConfirmarDesc(false)
      setCarregando(null)
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        title={txt.titulo}
        aria-label={txt.titulo}
        className={cn(
          'relative w-9 h-9 rounded-lg bg-bg-800 hover:bg-bg-700 border grid place-items-center outline-none transition-colors focus-visible:ring-2 data-[popup-open]:bg-bg-700',
          cfg.triggerBorda,
          cfg.triggerTexto,
        )}
      >
        <span className="w-4 h-4 block">
          <PlataformaIcon tipo={cfg.tipo} />
        </span>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full grid place-items-center ring-2 ring-bg-900',
            cfg.badgeBg,
          )}
        >
          <Link2 className="w-2.5 h-2.5 text-white" />
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', cfg.headerIcone)}>
            <span className="w-4 h-4 block">
              <PlataformaIcon tipo={cfg.tipo} />
            </span>
          </div>
          <div className="font-bold text-ink-100 text-sm">{txt.titulo}</div>
        </div>

        <p className="text-[12px] text-ink-400 mt-2 leading-relaxed">{txt.descricao}</p>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={conectar}
            disabled={carregando !== null}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50',
              cfg.ctaBg,
            )}
          >
            {carregando === 'conectar' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {txt.cta}
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
            {confirmarDesc ? 'Confirmar desconexão?' : cfg.desconectarLabel}
          </button>
        </div>

        {msg && (
          <div
            className={cn(
              'mt-3 text-[12px] rounded-lg px-3 py-2 border flex items-start gap-1.5',
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
                className={cn('shrink-0 inline-flex items-center gap-1.5 text-[12px]', cfg.abrirTexto)}
                title="Abrir o link (só faça isso se você for o próprio artista)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir
              </a>
            </div>
            <p className="text-[10px] text-ink-600 mt-1">{cfg.linkRodape}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

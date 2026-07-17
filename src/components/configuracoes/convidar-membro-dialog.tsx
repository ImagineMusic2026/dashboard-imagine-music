'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/components/auth/auth-provider'
import { listarArtistas, type ArtistaDoc } from '@/lib/artistas/client'
import { copiarTexto } from '@/lib/clipboard'
import { criarConvite } from '@/lib/invites'
import { enviarEmailConvite } from '@/lib/email'
import { roleMeta, type Role } from '@/lib/users'
import { cn } from '@/lib/utils'

function mensagemErro(err: unknown): string {
  if (err instanceof FirebaseError && err.code === 'permission-denied') {
    return 'Sem permissão para convidar. Confirme que seu usuário é admin e que as regras do Firestore estão publicadas.'
  }
  return 'Não foi possível criar o convite. Tente novamente.'
}

type Props = {
  onClose: () => void
  onConcluido: () => void
  /** Papel já selecionado ao abrir (ex.: 'artista' a partir da seção de Artistas). */
  roleInicial?: Role
}

export function ConvidarMembroDialog({ onClose, onConcluido, roleInicial = 'marketing' }: Props) {
  const { user, appUser } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(roleInicial)
  const [artistaSlug, setArtistaSlug] = useState('')
  const [artistas, setArtistas] = useState<ArtistaDoc[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Lista de artistas pra amarrar um convite de 'artista' a um perfil.
  useEffect(() => {
    listarArtistas()
      .then(setArtistas)
      .catch(() => setArtistas([]))
  }, [])

  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  /**
   * O e-mail é OPCIONAL — o convite sempre gera o link —, mas o padrão é ENVIAR,
   * para qualquer papel: o convite dá acesso ao painel e passa por definir senha,
   * então o e-mail é o caminho esperado. Desmarcar é a saída pra quem quer só o
   * link (e não gastar envio do EmailJS).
   */
  const [porEmail, setPorEmail] = useState(true)
  const [resultadoEmail, setResultadoEmail] = useState<'nao-pedido' | 'enviado' | 'falhou'>('nao-pedido')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando || !user) return
    setErro(null)
    if (role === 'artista' && !artistaSlug) {
      setErro('Selecione o artista que este login vai representar.')
      return
    }
    setEnviando(true)
    try {
      const convite = await criarConvite({
        email,
        nome,
        role,
        criadoPor: user.uid,
        artistaSlug: role === 'artista' ? artistaSlug : undefined,
      })
      const url = `${window.location.origin}/aceitar-convite?token=${convite.token}`
      setLink(url)

      // O convite já existe e o link já vale — o e-mail é só um meio de entrega.
      // Falhar aqui não invalida nada: o link continua na tela pra copiar.
      if (!porEmail) {
        setResultadoEmail('nao-pedido')
      } else {
        try {
          await enviarEmailConvite({
            toEmail: convite.email,
            toNome: convite.nome,
            inviteLink: url,
            role: convite.role,
            fromNome: appUser?.nome ?? user.email ?? 'Equipe Imagine',
          })
          setResultadoEmail('enviado')
        } catch (emailErr) {
          console.warn('[convite] e-mail não enviado:', emailErr)
          setResultadoEmail('falhou')
        }
      }
    } catch (err) {
      console.error(err)
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function copiarLink() {
    if (!link) return
    if (await copiarTexto(link)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  const sucesso = link !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40">
          <div className="font-bold text-ink-100">
            {sucesso ? 'Convite criado' : role === 'artista' ? 'Convidar artista' : 'Convidar membro'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sucesso ? (
          <div className="p-5 space-y-4">
            {/* Três estados distintos: enviado, não pedido (o link é o plano) e
                falhou (aí sim é aviso). Tratar "não pedido" como falha faria a tela
                gritar erro numa escolha deliberada. */}
            <div
              className={cn(
                'text-sm rounded-lg px-4 py-2.5 border',
                resultadoEmail === 'enviado'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : resultadoEmail === 'nao-pedido'
                    ? 'text-ink-300 bg-bg-800/60 border-bg-700/50'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              )}
            >
              {resultadoEmail === 'enviado' && `E-mail de convite enviado para ${email}.`}
              {resultadoEmail === 'nao-pedido' &&
                'Convite pronto. Copie o link abaixo e mande pra pessoa como preferir — WhatsApp, Telegram, o que for.'}
              {resultadoEmail === 'falhou' &&
                'Convite criado, mas não consegui enviar o e-mail automaticamente. Copie o link abaixo e envie manualmente.'}
            </div>

            <div>
              <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-1.5">
                Link do convite
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link ?? ''}
                  className="flex-1 bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2 text-xs text-ink-300 num truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copiarLink}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors"
                >
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onConcluido}
              className="w-full bg-bg-800 hover:bg-bg-700 text-ink-100 font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Concluir
            </button>
          </div>
        ) : (
          <form className="p-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="conv-nome" className="block text-sm font-medium text-ink-300 mb-1.5">
                Nome
              </label>
              <input
                id="conv-nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do convidado"
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label htmlFor="conv-email" className="block text-sm font-medium text-ink-300 mb-1.5">
                E-mail
              </label>
              <input
                id="conv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@somosimagine.com.br"
                className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <div className="block text-sm font-medium text-ink-300 mb-1.5">Papel</div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(roleMeta) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-semibold border transition-colors',
                      role === r
                        ? roleMeta[r].classe
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800'
                    )}
                  >
                    {roleMeta[r].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-500 mt-2">
                {role === 'admin'
                  ? 'Acesso total — vê tudo e gerencia o time.'
                  : role === 'marketing'
                    ? 'Acesso parcial — sem dados sensíveis de receita.'
                    : 'Portal restrito — vê somente o próprio perfil de artista.'}
              </p>
            </div>

            {role === 'artista' && (
              <div>
                <label htmlFor="conv-artista" className="block text-sm font-medium text-ink-300 mb-1.5">
                  Artista
                </label>
                <select
                  id="conv-artista"
                  required
                  value={artistaSlug}
                  onChange={(e) => {
                    const slug = e.target.value
                    setArtistaSlug(slug)
                    const a = artistas.find((x) => x.slug === slug)
                    if (a) setNome(a.nome)
                  }}
                  className="w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option value="">Selecione o artista…</option>
                  {artistas.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-ink-500 mt-1.5">
                  O login vai enxergar somente o perfil deste artista.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-bg-700/50 bg-bg-950/60 px-4 py-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={porEmail}
                  onChange={(e) => setPorEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <span
                  aria-hidden
                  className={cn(
                    'w-4 h-4 rounded border grid place-items-center shrink-0 mt-0.5 transition-colors',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500/40',
                    porEmail ? 'bg-violet-500 border-violet-500' : 'border-bg-700 group-hover:border-bg-600'
                  )}
                >
                  {porEmail && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-ink-200">Enviar convite por e-mail</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5 leading-relaxed">
                    {porEmail
                      ? 'O convite chega no e-mail informado. O link também aparece aqui pra copiar.'
                      : 'Só gera o link — você copia e manda por WhatsApp ou onde preferir. Não consome o envio de e-mail.'}
                  </span>
                </span>
              </label>
            </div>

            {erro && (
              <div
                role="alert"
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
              >
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || (role === 'artista' && !artistaSlug)}
              aria-busy={enviando}
              className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {enviando && <RefreshCw className="w-4 h-4 animate-spin" />}
              {/* "e enviar" só quando de fato envia — senão o botão promete o que não faz. */}
              {enviando ? 'Criando convite...' : porEmail ? 'Criar convite e enviar' : 'Criar link do convite'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

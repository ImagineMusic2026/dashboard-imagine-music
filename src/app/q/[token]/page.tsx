'use client'

import { useCallback, useEffect, useState } from 'react'
import { CloudOff, Link2Off, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/shared/logo'
import { DiagnosticoForm } from '@/components/diagnostico/diagnostico-form'
import { carregarViaLink, type QuestionarioViaLink } from '@/lib/diagnostico/publico'
import { NOME_CURTO } from '@/lib/diagnostico/perguntas'

/**
 * Página PÚBLICA do questionário de estruturação — sem login. A equipe gera o link
 * no perfil do artista e manda pra pessoa (o artista, o empresário); ela responde
 * aqui e as respostas caem direto no painel, sem liberar acesso a mais nada.
 *
 * O token do endereço é a credencial: a API o valida a cada leitura/save, e um
 * link revogado cai na tela de "link não está mais ativo". Fora do grupo (portal)
 * de propósito — não há guard porque não há sessão.
 */
export default function QuestionarioPublicoPage({ params }: { params: { token: string } }) {
  // null = carregando; 'invalido' = token desconhecido/revogado (o servidor DISSE
  // 404); 'erro' = falha temporária (rede, servidor) — dizer "link desativado" num
  // soluço de infra mandaria a pessoa pedir um link novo que não resolveria nada.
  const [estado, setEstado] = useState<QuestionarioViaLink | 'invalido' | 'erro' | null>(null)

  const carregar = useCallback(() => {
    let vivo = true
    setEstado(null)
    carregarViaLink(params.token)
      .then((d) => vivo && setEstado(d ?? 'invalido'))
      .catch(() => vivo && setEstado('erro'))
    return () => {
      vivo = false
    }
  }, [params.token])

  useEffect(() => carregar(), [carregar])

  return (
    <div className="min-h-screen bg-bg-950">
      <header className="border-b border-bg-700/40 bg-bg-900/60">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <BrandLogo className="h-6" priority />
          {estado !== null && typeof estado === 'object' && (
            <div className="text-right min-w-0">
              <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase">
                Questionário · {NOME_CURTO[estado.tipo]}
              </div>
              <div className="text-sm font-semibold text-ink-100 truncate capitalize">{estado.artistaNome}</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {estado === null ? (
          <div className="flex items-center justify-center gap-2 text-sm text-ink-400 py-24">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : estado === 'invalido' ? (
          <div className="text-center py-24 max-w-md mx-auto">
            <Link2Off className="w-8 h-8 text-ink-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink-100">Este link não está mais ativo</h1>
            <p className="text-sm text-ink-400 mt-2 leading-relaxed">
              O link pode ter sido desativado pela equipe da Imagine. Fale com quem te enviou pra receber um novo.
            </p>
          </div>
        ) : estado === 'erro' ? (
          <div className="text-center py-24 max-w-md mx-auto">
            <CloudOff className="w-8 h-8 text-ink-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-ink-100">Não deu pra carregar agora</h1>
            <p className="text-sm text-ink-400 mt-2 leading-relaxed">
              O link continua valendo — foi só uma falha temporária de conexão com o servidor. Tente de novo em
              instantes.
            </p>
            <button
              type="button"
              onClick={carregar}
              className="mt-5 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <DiagnosticoForm tipo={estado.tipo} slug={null} modo="link" token={params.token} />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-5 pb-8 text-center text-[11px] text-ink-600">
        © 2026 Imagine Group · Feira de Santana, BA
      </footer>
    </div>
  )
}

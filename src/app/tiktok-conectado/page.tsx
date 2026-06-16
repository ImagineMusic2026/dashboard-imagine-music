import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * Página pública de confirmação pós-OAuth do TikTok. Fica FORA dos grupos
 * (auth)/(dashboard)/(portal), então não passa por nenhum guard — é o destino de
 * um artista que autorizou via link enviado pelo admin e pode nem ter login no
 * painel. Lê `?tiktok=ok|erro|negado` e mostra uma mensagem amigável.
 */
export default function TikTokConectadoPage({
  searchParams,
}: {
  searchParams: { tiktok?: string }
}) {
  const status = searchParams.tiktok === 'ok' ? 'ok' : 'erro'
  const negado = searchParams.tiktok === 'negado'

  return (
    <div className="min-h-screen bg-bg-950 flex items-center justify-center p-8">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 grid place-items-center text-white font-bold text-2xl mx-auto mb-6">
          i
        </div>

        {status === 'ok' ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-bold text-ink-100 mt-4">TikTok conectado!</h1>
            <p className="text-ink-400 mt-2">
              Pronto — a Imagine já consegue acompanhar suas métricas do TikTok no painel. Você
              pode fechar esta página.
            </p>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-ink-100 mt-4">
              {negado ? 'Conexão não autorizada' : 'Não foi possível conectar'}
            </h1>
            <p className="text-ink-400 mt-2">
              {negado
                ? 'Você cancelou a autorização no TikTok. Se foi sem querer, abra o link de novo e toque em “Autorizar”.'
                : 'Houve um problema ao conectar sua conta do TikTok. Tente abrir o link novamente ou fale com a equipe da Imagine.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

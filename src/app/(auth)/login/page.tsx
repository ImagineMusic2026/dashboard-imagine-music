import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <>
      <div className="hidden lg:block w-1/2 bg-gradient-to-br from-bg-900 via-violet-950/30 to-bg-950 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-amber-400 grid place-items-center text-bg-950 font-bold text-xl">
              i
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] tracking-[0.2em] text-ink-400 font-bold">
                IMAGINE
              </span>
              <span className="text-[14px] text-ink-300 font-semibold">Group</span>
            </div>
          </div>

          <div>
            <h2 className="text-4xl font-bold text-ink-100 leading-tight max-w-md">
              Painel de Acompanhamento de Artistas
            </h2>
            <p className="text-ink-300 text-lg mt-4 max-w-md">
              Centralize métricas, alertas e oportunidades de todo o seu portfólio em um único
              lugar.
            </p>
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                ✓ Health Score automático
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                ✓ Alertas em tempo real
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                ✓ Receita via OneRPM/DDEX
              </span>
            </div>
          </div>

          <div className="text-[12px] text-ink-500">
            © 2026 Imagine Group · Feira de Santana, BA
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 lg:flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-amber-400 grid place-items-center text-bg-950 font-bold">
              i
            </div>
            <span className="text-[12px] tracking-[0.2em] text-ink-400 font-bold">
              IMAGINE
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-ink-100 mb-2">Bem-vindo de volta</h1>
            <p className="text-ink-400 text-sm">Acesse com sua conta da Imagine</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </>
  )
}

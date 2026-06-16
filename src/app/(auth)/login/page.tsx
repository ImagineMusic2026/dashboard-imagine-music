import { Activity, BadgeDollarSign, Bell } from 'lucide-react'
import { BrandLogo } from '@/components/shared/logo'
import { LoginForm } from './login-form'

const destaques = [
  { icon: Activity, titulo: 'Health Score automático', desc: 'A saúde de cada artista, calculada sozinha' },
  { icon: Bell, titulo: 'Alertas em tempo real', desc: 'Quedas e oportunidades, assim que acontecem' },
  { icon: BadgeDollarSign, titulo: 'Receita consolidada', desc: 'OneRPM e DDEX reunidos num só lugar' },
]

export default function LoginPage() {
  return (
    <>
      <div className="hidden lg:block w-1/2 relative overflow-hidden bg-bg-950">
        {/* Fundo: gradiente base + aurora animada + grade de pontos com máscara */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-900 via-violet-950/40 to-bg-950" />
        <div className="absolute -top-24 -left-24 w-[30rem] h-[30rem] bg-violet-600/25 rounded-full blur-3xl animate-aurora pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-[28rem] h-[28rem] bg-amber-500/15 rounded-full blur-3xl animate-aurora [animation-delay:-7s] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-fuchsia-500/15 rounded-full blur-3xl animate-aurora [animation-delay:-14s] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 78%)',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          <BrandLogo className="h-7 self-start animate-rise" priority />

          <div className="max-w-md">
            <h2 className="text-[2.75rem] leading-[1.05] font-bold text-ink-100 animate-rise [animation-delay:80ms]">
              Painel de Acompanhamento de{' '}
              <span className="animate-gradient-text">
                Artistas
              </span>
            </h2>

            <p className="mt-4 text-ink-300 text-lg leading-relaxed animate-rise [animation-delay:200ms]">
              Centralize métricas, alertas e oportunidades de todo o seu portfólio em um único
              lugar.
            </p>

            <div className="mt-9 space-y-3.5">
              {destaques.map((d, i) => {
                const Icon = d.icon
                return (
                  <div
                    key={d.titulo}
                    className="group flex items-center gap-3.5 animate-rise"
                    style={{ animationDelay: `${280 + i * 80}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-bg-800/60 border border-bg-700/60 grid place-items-center text-violet-300 shrink-0 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-violet-500/50 group-hover:text-violet-200 group-hover:shadow-lg group-hover:shadow-violet-500/10">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-100">{d.titulo}</div>
                      <div className="text-[12px] text-ink-400">{d.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="text-[12px] text-ink-500 animate-rise [animation-delay:560ms]">
            © 2026 Imagine Group · Feira de Santana, BA
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 lg:flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden mb-10">
            <BrandLogo className="h-8" />
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

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-950 flex items-center justify-center p-8">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-9xl font-bold bg-gradient-to-br from-violet-400 to-amber-400 bg-clip-text text-transparent num">
          404
        </div>
        <h1 className="text-2xl font-bold text-ink-100 mt-4">Página não encontrada</h1>
        <p className="text-ink-400 mt-2">
          A página que você está tentando acessar não existe ou foi movida.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar pra Home
        </Link>
      </div>
    </div>
  )
}

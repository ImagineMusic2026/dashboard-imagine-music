import Link from 'next/link'
import { Link2, Upload } from 'lucide-react'
import { OneRpmCard } from '@/components/integracoes/onerpm-card'
import { MetaInstagramCard } from '@/components/integracoes/meta-instagram-card'
import { TikTokCard } from '@/components/integracoes/tiktok-card'
import { YouTubeCard } from '@/components/integracoes/youtube-card'

export default function IntegracoesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-[11px] tracking-[0.2em] text-violet-400 font-semibold mb-1">FONTES DE DADOS</div>
        <h1 className="text-3xl font-bold text-ink-100">Integrações</h1>
        <p className="text-sm text-ink-400 mt-1">
          Status de cada fonte que alimenta o painel. Toque em “Ver mais” para detalhes e ações.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <OneRpmCard />
        <MetaInstagramCard />
        <TikTokCard />
        <YouTubeCard />

        <Link
          href="/importar"
          className="bg-bg-900 border border-dashed border-bg-700/50 rounded-xl p-5 flex items-center gap-3 hover:bg-bg-800/40 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 grid place-items-center shrink-0">
            <Upload className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-ink-100">Importação manual</div>
            <div className="text-[12px] text-ink-400 mt-0.5">Receita (OneRPM) e cadastro de artistas — via planilha →</div>
          </div>
        </Link>
      </div>

      <div className="text-center pt-2">
        <p className="text-[11px] text-ink-500 inline-flex items-center gap-1.5 flex-wrap justify-center">
          <Link2 className="w-3 h-3" />
          Conexões via OAuth 2.0 / API keys, processadas no servidor ·{' '}
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Política de privacidade
          </a>
        </p>
      </div>
    </div>
  )
}

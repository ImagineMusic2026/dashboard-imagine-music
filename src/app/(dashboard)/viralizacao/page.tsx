import { Suspense } from 'react'
import { ViralizacaoView } from '@/components/viralizacao/viralizacao-view'

/**
 * `/viralizacao` — o que o público faz com as músicas do selo no TikTok.
 * O artista selecionado vem da query (`?artista=slug`) pra a tela ser
 * compartilhável; por isso a view lê `useSearchParams` e precisa do Suspense.
 */
export default function ViralizacaoPage() {
  return (
    <div className="animate-fade-in">
      <Suspense fallback={<div className="text-sm text-ink-500 py-10">Carregando…</div>}>
        <ViralizacaoView />
      </Suspense>
    </div>
  )
}

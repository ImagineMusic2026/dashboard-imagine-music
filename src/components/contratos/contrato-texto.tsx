import { blocosDe } from '@/lib/contratos/modelo'

/**
 * O contrato como se lê na tela.
 *
 * Nada de HTML vindo do modelo: o texto é dado, não marcação. Quem escreve o
 * modelo escreve um contrato, e `blocosDe` já separa título de parágrafo pela
 * forma como contrato se escreve (linha sozinha em maiúsculas).
 */
export function ContratoTexto({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={className}>
      {blocosDe(texto).map((b, i) =>
        b.tipo === 'titulo' ? (
          <h3
            key={i}
            className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mt-5 first:mt-0 mb-2"
          >
            {b.texto}
          </h3>
        ) : (
          <p key={i} className="text-[13px] leading-relaxed text-ink-300 mb-3 whitespace-pre-wrap">
            {b.texto}
          </p>
        ),
      )}
    </div>
  )
}

import { Fragment } from 'react'
import { formatarMoedasPartes } from '@/lib/onerpm/display'
import type { MoneyByCurrency } from '@/lib/onerpm/types'

/**
 * Valor de receita por moeda (a OneRPM nunca soma moedas — ver `display.ts`).
 *
 * Cada moeda é um bloco `whitespace-nowrap`, e a quebra só acontece ENTRE moedas,
 * no separador " + ". Assim, numa coluna apertada, "R$ 28.413,61 + US$ 48,83"
 * quebra pra duas linhas inteiras em vez de rachar um número no meio
 * ("US$" numa linha, "48,83" na outra). Uma moeda só continua numa linha.
 *
 * O alinhamento (esquerda/direita) vem do container — este componente só herda.
 */
export function Moedas({
  m,
  prefixo = '',
  className,
}: {
  m: MoneyByCurrency
  /** Prefixo colado na 1ª moeda, sem quebrar dela (ex.: "− " no repasse). */
  prefixo?: string
  className?: string
}) {
  const partes = formatarMoedasPartes(m)
  if (!partes.length) return <span className={className}>—</span>

  return (
    <span className={className}>
      {partes.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' + '}
          <span className="whitespace-nowrap">{i === 0 ? `${prefixo}${p}` : p}</span>
        </Fragment>
      ))}
    </span>
  )
}

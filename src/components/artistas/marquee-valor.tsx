'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Valor que nunca quebra linha nem desalinha a célula.
 *
 * Enquanto CABE, fica estático (uma cópia, alinhado à direita) — inclusive o "—"
 * de quem não tem receita, que não vira carrossel. Quando NÃO cabe (várias moedas,
 * coluna apertada), vira um carrossel horizontal: o valor desliza e volta sem
 * emenda. O espaço entre uma volta e a próxima é do tamanho da janela, então
 * NUNCA aparecem duas cópias ao mesmo tempo — sempre uma por vez.
 *
 * Usado na coluna de receita da lista; o detalhe fica a um clique, no perfil.
 *
 * Acessibilidade: pausa no hover, para com `prefers-reduced-motion` (o valor
 * inteiro fica no `title`), e o leitor de tela lê uma vez só (2ª cópia `aria-hidden`).
 */

/** Velocidade do carrossel, px/s. Devagar de propósito, pra dar pra ler. */
const VELOCIDADE = 26

// useLayoutEffect no cliente, useEffect no SSR (evita warning de hidratação).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function MarqueeValor({ texto, className }: { texto: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null)
  const medidor = useRef<HTMLSpanElement>(null)
  const [estado, setEstado] = useState({ overflow: false, duracao: 7, gap: 48 })

  useIsoLayoutEffect(() => {
    const box = container.current
    const med = medidor.current
    if (!box || !med) return

    const medir = () => {
      const larguraTexto = med.scrollWidth
      const larguraJanela = box.clientWidth
      // gap = uma janela: garante que só uma cópia apareça por vez.
      const gap = Math.max(larguraJanela, 24)
      setEstado({
        overflow: larguraTexto > larguraJanela + 1,
        gap,
        duracao: (larguraTexto + gap) / VELOCIDADE,
      })
    }

    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(box)
    return () => ro.disconnect()
  }, [texto])

  return (
    <div
      ref={container}
      title={texto}
      className={cn('relative overflow-hidden whitespace-nowrap', estado.overflow && 'marquee-mask', className)}
    >
      {/* Medidor fora do fluxo: largura natural do texto numa linha só. */}
      <span ref={medidor} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">
        {texto}
      </span>

      {estado.overflow ? (
        <div className="marquee-valor flex w-max" style={{ animationDuration: `${estado.duracao}s` }}>
          <span style={{ paddingRight: estado.gap }}>{texto}</span>
          <span style={{ paddingRight: estado.gap }} aria-hidden>
            {texto}
          </span>
        </div>
      ) : (
        <span className="block">{texto}</span>
      )}
    </div>
  )
}

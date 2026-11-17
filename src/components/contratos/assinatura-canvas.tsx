'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/**
 * O campo onde a pessoa desenha a assinatura.
 *
 * Decisões que não são estéticas:
 *
 * - **Fundo branco e traço escuro.** A PNG que sai daqui vai parar num PDF
 *   impresso em papel branco. Um traço claro, bonito no tema escuro do painel,
 *   sairia invisível.
 * - **Pointer events, não mouse nem touch.** Um só caminho atende dedo, caneta
 *   e mouse. O `touch-action: none` é o que impede o dedo de rolar a página no
 *   meio da assinatura — sem ele, assinar no celular é impossível.
 * - **Redimensionar limpa.** Mudar o tamanho do canvas descarta o conteúdo de
 *   qualquer jeito; girar o celular com meia assinatura feita deixaria um traço
 *   cortado parecendo válido. Limpar e avisar é o lado honesto.
 */
export function AssinaturaCanvas({
  onChange,
  rotulo = 'Assine no quadro abaixo',
}: {
  onChange: (dataUrl: string | null) => void
  rotulo?: string
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const desenhando = useRef(false)
  const [temTraco, setTemTraco] = useState(false)

  const preparar = useCallback(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const largura = canvas.clientWidth
    const altura = canvas.clientHeight
    if (!largura || !altura) return
    canvas.width = Math.round(largura * dpr)
    canvas.height = Math.round(altura * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#17161c'
  }, [])

  const limpar = useCallback(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemTraco(false)
    onChange(null)
  }, [onChange])

  useEffect(() => {
    preparar()
    const aoRedimensionar = () => {
      preparar()
      setTemTraco(false)
      onChange(null)
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [preparar, onChange])

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    desenhando.current = true
    const p = ponto(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    // Um toque sem arrasto também é traço: assinatura com pingo no "i".
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setTemTraco(true)
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = ponto(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function terminar() {
    if (!desenhando.current) return
    desenhando.current = false
    const canvas = ref.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-300">{rotulo}</span>
        <button
          type="button"
          onClick={limpar}
          disabled={!temTraco}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-200 disabled:opacity-40 transition-colors"
        >
          <Eraser className="w-3.5 h-3.5" aria-hidden />
          Limpar
        </button>
      </div>
      <canvas
        ref={ref}
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
        aria-label="Quadro de assinatura"
        className="w-full h-40 bg-white rounded-lg border border-bg-700/50 touch-none cursor-crosshair"
      />
      <p className="text-[11px] text-ink-600 mt-1">
        Use o dedo, a caneta ou o mouse. O traço vai impresso no contrato.
      </p>
    </div>
  )
}

/**
 * Copia texto para a área de transferência com fallback.
 * A Clipboard API moderna exige contexto seguro + documento focado e pode falhar
 * (ex.: "Document is not focused"); nesses casos caímos no textarea + execCommand.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      // segue para o fallback
    }
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus({ preventScroll: true })
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

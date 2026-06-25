/**
 * Bandeira (imagem) a partir do código ISO-2 do país. Emoji de bandeira não
 * renderiza no Windows (vira as letras), então usamos o flagcdn — PNG leve e
 * cacheado, que funciona em qualquer SO. Retorna null pra código inválido
 * (ex.: o fallback "—" quando o país vem vazio do feed da OneRPM).
 *
 * Compartilhada entre o card de streaming e o de análise de faixas do perfil.
 */
export function Bandeira({ pais }: { pais: string }) {
  const cc = (pais || '').trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(cc)) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/20x15/${cc}.png`}
      srcSet={`https://flagcdn.com/40x30/${cc}.png 2x`}
      width={16}
      height={12}
      alt=""
      loading="lazy"
      className="rounded-[2px] shrink-0"
    />
  )
}

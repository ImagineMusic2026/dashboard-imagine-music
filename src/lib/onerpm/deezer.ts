/**
 * Resolução de ISRC → título via a API pública do Deezer (sem chave). As faixas
 * da OneRPM são distribuídas pro Deezer, então o lookup por ISRC acha quase tudo.
 * Usado pra dar nome às faixas enquanto o catálogo de títulos da OneRPM não chega.
 */

export interface FaixaResolvida {
  titulo: string
  link: string
  releaseDate: string | null
}

/**
 * Doc de cache `catalogo-faixas/{isrc}`. `naoEncontrado` evita re-buscar o que o
 * Deezer não tem. SERVER-ONLY (escrito pela rota/script via Admin SDK).
 */
export interface CatalogoFaixaDoc {
  isrc: string
  titulo: string | null
  link: string | null
  releaseDate: string | null
  naoEncontrado?: boolean
  fonte: 'deezer'
  atualizadoEm: string
}

/** Busca uma faixa por ISRC no Deezer. null se não achar ou der erro. */
export async function resolverISRCDeezer(isrc: string): Promise<FaixaResolvida | null> {
  try {
    const res = await fetch(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      id?: number
      title?: string
      link?: string
      release_date?: string
      error?: unknown
    }
    if (!j || j.error || !j.id || !j.title) return null
    return {
      titulo: j.title,
      link: j.link || `https://www.deezer.com/track/${j.id}`,
      releaseDate: j.release_date || null,
    }
  } catch {
    return null
  }
}

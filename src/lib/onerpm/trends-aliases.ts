/**
 * Aliases de atribuição do streaming (INTERINO, até o catálogo ISRC→artista da
 * OneRPM chegar e virarmos a chave de junção pra ISRC).
 *
 * O `artist_name` do feed da OneRPM às vezes diverge na grafia do nome cadastrado
 * no roster (ex.: "Netto Brito" no feed vs "Neto Brito" no roster). Sem mapear,
 * os streams cairiam num slug órfão e não apareceriam no perfil do artista certo.
 *
 * Chave = slug do nome COMO VEM NO FEED; valor = slug do artista no roster.
 * Mapeamentos confirmados com o usuário em 2026-06-25 (distância de edição 1–2).
 */
export const ALIAS_ARTISTA: Record<string, string> = {
  'netto-brito': 'neto-brito',
  'herisson-rocha': 'herison-rocha',
  'fillipe-aladin': 'filipe-aladim',
  'willian-dicastro': 'william-dicastro',
  'kleiton-bacelar': 'kleiton-barcelar',
  'danniel-vieira': 'daniel-vieira',
}

/** Resolve o slug do feed para o slug do roster (identidade se não houver alias). */
export function resolverSlugArtista(slug: string): string {
  return ALIAS_ARTISTA[slug] ?? slug
}

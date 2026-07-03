/**
 * Aliases de atribuição do streaming.
 *
 * O `artist_name` do feed da OneRPM às vezes diverge na grafia do nome cadastrado
 * no roster (ex.: "Netto Brito" no feed vs "Neto Brito" no roster). Sem mapear,
 * os streams cairiam num slug órfão e não apareceriam no perfil do artista certo.
 *
 * NOTA (2026-07-03): o catálogo oficial da OneRPM chegou (ver `catalogo-faixas.ts`),
 * mas usa as MESMAS grafias do feed ("Netto Brito" etc.) e não cobre faixas sem
 * ISRC — então trocar a junção pra ISRC→artista não eliminaria estes aliases.
 * A junção segue pelo nome do feed + este mapa.
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

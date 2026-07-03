/**
 * Catálogo de faixas — doc `catalogo-faixas/{isrc}` (ISRC → título). Duas fontes:
 *  - 'onerpm': o catálogo OFICIAL enviado pela OneRPM (CSV único em
 *    `data/catalog_imagine_music.csv`, importado por
 *    `scripts/importar-catalogo-onerpm.mjs`; eles reenviam o arquivo quando o
 *    catálogo mudar) — traz título, álbum, UPC, performer e data de lançamento;
 *  - 'deezer': fallback via API pública pro que ainda não está no catálogo
 *    (faixas novas até chegar o arquivo atualizado) — única fonte do `link`.
 *
 * SERVER-ONLY (escrito pela rota/scripts via Admin SDK). O cliente consome via
 * `POST /api/faixas/titulos`.
 */
export interface CatalogoFaixaDoc {
  isrc: string
  titulo: string | null
  /** Link pra abrir a faixa — só quando o Deezer conhece (o catálogo OneRPM não tem link). */
  link: string | null
  releaseDate: string | null
  /** Campos extras do catálogo da OneRPM (ausentes nos docs vindos do Deezer). */
  album?: string | null
  upc?: string | null
  /** Performer(s) segundo o catálogo (grafia da OneRPM, ex.: "Netto Brito"). */
  artista?: string | null
  /** Deezer não tem a faixa — evita re-buscar. (Some quando o import da OneRPM cobre o ISRC.) */
  naoEncontrado?: boolean
  fonte: 'deezer' | 'onerpm'
  atualizadoEm: string
}

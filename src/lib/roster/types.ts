/**
 * Tipos do cadastro (roster) de artistas do selo.
 *
 * O arquivo de "redes sociais" traz os LINKS dos perfis (Spotify, YouTube,
 * Instagram, TikTok) de cada artista — não os números. Daqui extraímos as
 * identidades (Spotify artistId, YouTube channelId/@handle, @ do IG/TikTok),
 * que são a chave pra buscar as métricas nas APIs depois.
 */

export interface RedeSocial {
  url: string
  id: string | null // spotify artistId / youtube channelId
  handle: string | null // @ do IG/TikTok / @handle do YouTube
}

export interface RosterArtist {
  nome: string
  slug: string
  spotify: RedeSocial | null
  youtube: RedeSocial | null
  instagram: RedeSocial | null
  tiktok: RedeSocial | null
  avisos: string[]
}

export interface RosterParseResult {
  artistas: RosterArtist[]
  totais: {
    total: number
    comSpotifyId: number
    comYoutube: number
    comInstagram: number
    comTiktok: number
  }
  avisos: string[]
}

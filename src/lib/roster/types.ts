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

export type RedeKey = 'spotify' | 'youtube' | 'instagram' | 'tiktok'

/** Rede em conflito: o painel tem UMA conta e a planilha traz OUTRA. */
export interface ConflitoRede {
  rede: RedeKey
  atual: RedeSocial
  novo: RedeSocial
}

/**
 * Diagnóstico de 1 artista da planilha contra o que já existe no painel
 * (fase de análise — nada é gravado até o usuário confirmar).
 *  - novo      -> não existe no painel
 *  - igual     -> existe e a planilha não muda nada
 *  - atualiza  -> existe e a planilha só PREENCHE redes vazias (sem conflito)
 *  - conflito  -> existe e ao menos uma rede difere da já cadastrada
 */
export interface AnaliseArtista {
  artista: RosterArtist
  status: 'novo' | 'igual' | 'atualiza' | 'conflito'
  nomeAtual: string | null
  redesNovas: RedeKey[]
  conflitos: ConflitoRede[]
}

export interface AnaliseRoster {
  artistas: AnaliseArtista[]
  totais: {
    total: number
    novos: number
    iguais: number
    atualizados: number
    comConflito: number
  }
}

/** Decisão do usuário pra cada rede em conflito. */
export type DecisaoConflito = 'manter' | 'trocar'
export type DecisoesRoster = Record<string, Partial<Record<RedeKey, DecisaoConflito>>>

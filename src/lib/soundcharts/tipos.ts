/** O que uma consulta à Soundcharts guarda em `metricas-sociais/{slug}.soundcharts`. */
export interface SoundchartsSnapshot {
  /** Id do artista na Soundcharts (o mesmo que a equipe digitava à mão no dossiê). */
  artistId: string
  /**
   * Como o artista foi encontrado. `nome` é palpite: a base da Soundcharts tem
   * milhares de homônimos para nomes curtos. A tela avisa quando é o caso.
   */
  resolvidoPor: 'spotify' | 'nome'
  /** Quantos resultados a busca por nome trouxe. `null` quando resolveu pelo Spotify. */
  resultadosDaBusca: number | null

  nome: string
  pais: string | null
  generos: string[]
  /**
   * Estágio de carreira da própria Soundcharts, em escala GLOBAL. NÃO confere a
   * régua da metodologia: no levantamento do roster, 86 de 97 artistas saíram
   * como `long_tail`, inclusive o maior. É contexto, nunca nota.
   */
  careerStage: string | null

  /** Ouvintes mensais no Spotify (ponto mais recente da série). */
  ouvintesSpotify: number | null
  /** Views do YouTube na janela de 28 dias, quando o canal está conectado no painel. */
  youtubeViews: number | null
  /** A soma que o IGE usa como consumo. `null` quando nenhuma das duas partes existe. */
  consumo: number | null

  /** Execuções em rádio na janela da metodologia — é este que vira nota. */
  airplay28d: number
  airplayEmissoras28d: number
  /**
   * Execuções em 12 meses. Não entra na nota; existe porque a janela de 28 dias
   * esconde quase todo o airplay deste roster, e um zero curto não deve ser lido
   * como "não toca em rádio".
   */
  airplay365d: number
  airplayEmissoras365d: number
  airplayPrincipais: { nome: string; pais: string | null; spins: number }[]

  /** ISO. A tela mostra isto para um dado velho não passar por atual. */
  consultadoEm: string
}

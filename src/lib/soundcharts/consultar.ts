/**
 * Consulta de um artista na Soundcharts — SÓ SERVIDOR.
 *
 * Traz o que falta para o IGE fechar: consumo (ouvintes mensais no Spotify) e
 * airplay (execuções em rádio na janela da metodologia). De quebra guarda o
 * `artistId` da Soundcharts, que hoje a equipe digita à mão no dossiê.
 *
 * Sobre a JANELA: a metodologia mede airplay em 28 dias, e é isso que as faixas
 * de `ige.ts` esperam. Guardamos também 365 dias porque medimos que a janela de
 * 28 esconde quase todo o airplay deste roster (6 artistas em 30 dias contra 15
 * em 12 meses) — o número longo não entra na nota, mas evita a leitura de que o
 * artista não toca em rádio nenhuma.
 */
import { SessaoSoundcharts, SoundchartsError } from './mcp'
import type { SoundchartsSnapshot } from './tipos'

const DIAS_METODOLOGIA = 28
const DIAS_LONGO = 365

const emISO = (diasAtras: number) =>
  new Date(Date.now() - diasAtras * 86_400_000).toISOString().slice(0, 10)

interface ItemBusca {
  artistId: string
  name?: string
  countryCode?: string
  genreNames?: string[]
  careerStage?: string
}

/**
 * Resolve o artista da Soundcharts.
 *
 * O id do Spotify do cadastro é o caminho CERTO — `resolve_url` devolve o
 * artista exato. Casar por nome é palpite: a base deles tem 4.538 resultados
 * para "Glauco!", e num levantamento do roster um artista casou com um homônimo
 * português. Por isso o retorno diz COMO resolveu, e a tela avisa quando foi
 * por nome.
 */
async function resolver(
  s: SessaoSoundcharts,
  entrada: { spotifyId?: string | null; nome: string },
): Promise<{ artistId: string; via: 'spotify' | 'nome'; achados: number; item: ItemBusca | null }> {
  let porSpotify: string | null = null

  if (entrada.spotifyId) {
    // ⚠️ o campo é `entityId`, não `artistId` — ler o errado faz cair no
    // fallback por nome em silêncio, que foi exatamente o bug do levantamento.
    const r = await s.ferramenta<{ type?: string; entityId?: string }>('resolve_url', {
      url: `https://open.spotify.com/artist/${entrada.spotifyId}`,
    })
    if (r?.type === 'artist' && r.entityId) porSpotify = r.entityId
  }

  // A busca por nome roda mesmo com o id resolvido: o `careerStage` só existe
  // aqui (o `get_artist` não traz), e com o id em mãos dá para pegar o item certo.
  const busca = await s.ferramenta<{ items?: ItemBusca[]; page?: { total?: number } }>(
    'search_artist',
    { query: entrada.nome, limit: 20 },
  )
  const itens = busca?.items ?? []
  const achados = busca?.page?.total ?? itens.length
  const item = porSpotify ? (itens.find((i) => i.artistId === porSpotify) ?? null) : (itens[0] ?? null)

  // `via` reflete o que REALMENTE resolveu. Ter id do Spotify no cadastro não
  // garante que ele resolveu — se falhou, caímos no nome e a tela precisa avisar.
  const artistId = porSpotify ?? item?.artistId ?? null
  if (!artistId) throw new SoundchartsError(`Não encontrei "${entrada.nome}" na Soundcharts.`)

  return { artistId, via: porSpotify ? 'spotify' : 'nome', achados, item }
}

/** Último ponto da série de ouvintes mensais (a série vem do mais recente para trás). */
async function ouvintesSpotify(s: SessaoSoundcharts, artistId: string): Promise<number | null> {
  const r = await s.ferramenta<{ items?: { date?: string; value?: number }[] }>(
    'get_artist_platform_streaming_audience',
    { artistId, platform: 'spotify', limit: 10 },
  )
  const itens = (r?.items ?? []).filter((i) => typeof i.value === 'number')
  if (!itens.length) return null
  const maisRecente = itens.reduce((a, b) => ((b.date ?? '') > (a.date ?? '') ? b : a))
  return maisRecente.value ?? null
}

async function spins(s: SessaoSoundcharts, artistId: string, dias: number) {
  const r = await s.ferramenta<{
    items?: { spins?: number; radioName?: string; radioCountry?: string }[]
  }>('get_artist_radio_spins', { artistId, startDate: emISO(dias), limit: 50 })
  const itens = r?.items ?? []
  return {
    total: itens.reduce((t, i) => t + (Number(i.spins) || 0), 0),
    emissoras: itens.length,
    principais: itens
      .slice()
      .sort((a, b) => (Number(b.spins) || 0) - (Number(a.spins) || 0))
      .slice(0, 3)
      .map((i) => ({ nome: i.radioName ?? '—', pais: i.radioCountry ?? null, spins: Number(i.spins) || 0 })),
  }
}

export interface EntradaConsulta {
  slug: string
  nome: string
  spotifyId?: string | null
  /** Views do YouTube na janela do Analytics, quando o canal está conectado. */
  youtubeViews?: number | null
  youtubeDias?: number | null
}

export async function consultarArtista(entrada: EntradaConsulta): Promise<SoundchartsSnapshot> {
  const s = new SessaoSoundcharts()
  await s.abrir()

  const { artistId, via, achados, item } = await resolver(s, entrada)

  const [ouvintes, curto, longo] = await Promise.all([
    ouvintesSpotify(s, artistId),
    spins(s, artistId, DIAS_METODOLOGIA),
    spins(s, artistId, DIAS_LONGO),
  ])

  // Consumo da metodologia = ouvintes mensais no Spotify + views/28d no YouTube.
  // O YouTube não vem da Soundcharts (ela responde 404 para artista sem canal
  // vinculado); vem da integração própria do painel, quando o canal está
  // conectado. Sem nenhuma das duas partes o consumo fica `null` e o componente
  // sai ND — somar só metade e chamar de consumo seria pior que não medir.
  const youtube = entrada.youtubeDias === DIAS_METODOLOGIA ? (entrada.youtubeViews ?? null) : null
  const consumo = ouvintes == null && youtube == null ? null : (ouvintes ?? 0) + (youtube ?? 0)

  return {
    artistId,
    resolvidoPor: via,
    resultadosDaBusca: via === 'nome' ? achados : null,
    nome: item?.name ?? entrada.nome,
    pais: item?.countryCode ?? null,
    generos: item?.genreNames ?? [],
    /** Estágio de carreira da própria Soundcharts, em escala GLOBAL. Não confere
     *  a régua da metodologia: num levantamento do roster, 86 de 97 artistas
     *  saíram como `long_tail`, inclusive o maior. Serve de contexto, não de nota. */
    careerStage: item?.careerStage ?? null,
    ouvintesSpotify: ouvintes,
    youtubeViews: youtube,
    consumo,
    airplay28d: curto.total,
    airplayEmissoras28d: curto.emissoras,
    airplay365d: longo.total,
    airplayEmissoras365d: longo.emissoras,
    airplayPrincipais: longo.principais,
    consultadoEm: new Date().toISOString(),
  }
}

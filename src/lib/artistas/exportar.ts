/**
 * Exportação do perfil de um artista, em duas formas com destinos diferentes.
 *
 * MARKDOWN (`montarExportacao`) é para colar numa IA. PDF seria pior: paginação
 * e layout viram ruído e a IA gasta atenção decifrando a forma em vez do
 * conteúdo. Markdown é texto estruturado — cola no chat e pronto.
 *
 * PLANILHA (`montarPlanilha`) é para abrir no Excel, filtrar, somar, fazer
 * gráfico. Os dois saem exatamente dos MESMOS dados, então nunca divergem.
 *
 * Três regras nortearam o que sai daqui, e cada uma existe para evitar um erro
 * concreto de leitura — por uma IA ou por uma pessoa:
 *
 * 1. TODO número vem com a janela e a fonte. "88,6 milhões de streams" sozinho
 *    não diz se é do mês ou da vida inteira.
 * 2. Ausência NUNCA vira zero. Instagram não coletado escrito como `0` faz a IA
 *    concluir que o artista não tem público lá — e escrever isso no relatório.
 *    É o §8 da metodologia IAOS, e vale aqui igual.
 * 3. Tudo é datado. Métrica de três meses atrás lida como atual gera recomendação
 *    errada com toda a confiança do mundo.
 *
 * O cabeçalho "como ler" existe pelo mesmo motivo: é barato e melhora a resposta.
 */
import type { ArtistaDoc, ProjetoDoc } from './client'
import type { MetricasSociaisDoc, StreamingDetalheDoc } from '@/lib/metricas-sociais/types'
import type { ResultadoIge } from '@/lib/iaos/ige'
import type { DiagnosticoDoc } from '@/lib/diagnostico/client'
import type { TipoDiagnostico } from '@/lib/diagnostico/perguntas'

/** O que a IA recebe. `null` em qualquer campo vira "não medido", nunca zero. */
export interface DadosExportacao {
  artista: ArtistaDoc
  metricas: MetricasSociaisDoc | null
  projeto: ProjetoDoc | null
  detalhe: StreamingDetalheDoc | null
  ugc: {
    periodo?: { de: string; ate: string; dias: number }
    totais?: { criacoesUgc?: number; viewsUgc?: number }
  } | null
  /**
   * ISRC -> título, do catálogo. Faixa identificada só pelo ISRC não diz nada
   * para a IA (nem para gente); com o título, ela consegue falar das músicas.
   */
  titulos: Record<string, string>
  /**
   * Evolução dia a dia, recortada pelo período que a pessoa escolheu.
   *
   * É o único bloco que o seletor de período afeta, e de propósito: todo o
   * resto do documento é retrato de uma janela fixa (as faixas, os vídeos do
   * público, a Soundcharts, o IGE) e não pode ser recortado. Deixar o seletor
   * mexer no rótulo desses blocos sem mexer no dado faria o documento afirmar
   * um período que ele não tem — o mesmo erro do zero no lugar do "não medido",
   * só que na dimensão tempo.
   */
  serie: {
    dias: number
    de: string | null
    ate: string | null
    pontos: {
      dia: string
      instagram: number | null
      tiktok: number | null
      youtube: number | null
      streams: number | null
      health: number | null
    }[]
  } | null
  ige: ResultadoIge | null
  saude: { score: number; pilares: { rotulo: string; score: number }[] } | null
  diagnosticos: { tipo: TipoDiagnostico; nome: string; doc: DiagnosticoDoc | null }[]
  /**
   * Só entra quando quem exporta tem permissão E marcou a opção.
   *
   * Por MOEDA, nunca somada: o painel inteiro trata moeda separada porque somar
   * dólar com real dá um número que não existe. A IA precisa herdar essa regra,
   * senão soma tudo e apresenta o resultado com confiança.
   */
  receita: {
    periodo: string
    porPlataforma: { nome: string; streams: number; porMoeda: Record<string, number> }[]
  } | null
}

const AUSENTE = 'não medido'

/** Número medido vira texto; ausência vira a palavra, nunca zero. */
function n(v: number | null | undefined, sufixo = ''): string {
  if (v == null || !Number.isFinite(v)) return AUSENTE
  return v.toLocaleString('pt-BR') + sufixo
}

function pct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return AUSENTE
  return `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

function data(iso: string | null | undefined): string {
  if (!iso) return AUSENTE
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

function dia(ymd: string | null | undefined): string {
  if (!ymd) return AUSENTE
  const [a, m, d] = ymd.split('-')
  return a && m && d ? `${d}/${m}/${a}` : ymd
}

/**
 * Junta as linhas de um bloco. `null` é linha que não tem o que dizer e some;
 * string VAZIA é linha em branco de propósito e fica — em Markdown, lista logo
 * depois de texto sem linha em branco no meio não renderiza como lista.
 */
function linhas(itens: (string | null)[]): string {
  return itens.filter((x) => x !== null).join('\n')
}

export function montarExportacao(d: DadosExportacao, geradoEm = new Date()): string {
  const a = d.artista
  const m = d.metricas
  const p = d.projeto
  const partes: string[] = []

  partes.push(`# ${a.nome}`)
  partes.push(
    linhas([
      `Exportado do Painel Imagine em ${geradoEm.toLocaleString('pt-BR')}.`,
      '',
      '## Como ler estes dados',
      '',
      '- Onde estiver escrito **"não medido"**, o dado não foi coletado — isso **não** significa zero. Um artista com Instagram "não medido" pode ter um público grande lá; só não temos a medição. Não conclua ausência de público a partir disso.',
      '- Cada bloco diz a janela de tempo e a fonte. Não compare números de janelas diferentes.',
      '- As datas de coleta estão junto de cada bloco. Dado antigo pode não refletir a situação atual.',
      '- Nomes de plataforma e métricas seguem o vocabulário do mercado fonográfico brasileiro.',
    ]),
  )

  /* ── identidade ─────────────────────────────────────────────────────────── */
  const redes = a.redes ?? {}
  partes.push(
    linhas([
      '',
      '## Identidade',
      '',
      `- Nome: ${a.nome}`,
      `- Gênero: ${a.genero || AUSENTE}`,
      a.label ? `- Selo: ${a.label}` : null,
      `- Faixas no catálogo: ${a.fonogramas == null ? AUSENTE : n(a.fonogramas)}`,
      redes.spotify?.id ? `- Spotify: ${redes.spotify.url ?? redes.spotify.id}` : null,
      redes.instagram?.handle ? `- Instagram: @${redes.instagram.handle}` : null,
      redes.tiktok?.handle ? `- TikTok: @${redes.tiktok.handle}` : null,
      redes.youtube?.id ? `- YouTube: ${redes.youtube.url ?? redes.youtube.id}` : null,
    ]),
  )

  /* ── audiência ──────────────────────────────────────────────────────────── */
  const ig = m?.instagram
  const tt = m?.tiktok
  const yt = m?.youtube
  partes.push(
    linhas([
      '',
      '## Audiência nas redes',
      '',
      `- Instagram — seguidores: ${n(ig?.seguidores)}${ig?.coletadoEm ? ` (coletado em ${data(ig.coletadoEm)})` : ''}`,
      `- TikTok — seguidores: ${n(tt?.seguidores)}${tt?.coletadoEm ? ` (coletado em ${data(tt.coletadoEm)})` : ''}`,
      yt?.inscritosOcultos
        ? '- YouTube — inscritos: o canal esconde a contagem'
        : `- YouTube — inscritos: ${n(yt?.inscritos)}${yt?.coletadoEm ? ` (coletado em ${data(yt.coletadoEm)})` : ''}`,
      yt?.viewsTotais != null ? `- YouTube — visualizações totais do canal: ${n(yt.viewsTotais)}` : null,
      yt?.analytics?.views != null
        ? `- YouTube — visualizações nos últimos ${yt.analytics.periodoDias} dias: ${n(yt.analytics.views)}`
        : null,
    ]),
  )

  /* ── streaming ──────────────────────────────────────────────────────────── */
  const st = m?.streaming
  if (st) {
    partes.push(
      linhas([
        '',
        '## Streaming (fonte: OneRPM)',
        '',
        `Janela: ${dia(st.periodo?.de)} a ${dia(st.periodo?.ate)} (${st.periodo?.dias ?? AUSENTE} dias com dado). Último dia disponível: ${dia(st.ultimoDia)}.`,
        '',
        `- Streams na janela: ${n(st.streams)}`,
        `- Streams nos últimos 28 dias: ${n(st.streams28d)}`,
        `- Streams nos últimos 7 dias: ${n(st.streams7d)}`,
        `- Taxa de pulo (skip rate): ${pct(st.skipRate)} — proporção de execuções abandonadas antes do fim`,
        `- Faixas distintas com execução: ${n(st.faixas)}`,
        st.porPlataforma?.length
          ? `- Por plataforma: ${st.porPlataforma.map((x) => `${x.plataforma} ${n(x.streams)}`).join(' · ')}`
          : null,
        st.porPais?.length
          ? `- Principais países: ${st.porPais.slice(0, 8).map((x) => `${x.pais} ${n(x.streams)}`).join(' · ')}`
          : null,
      ]),
    )
  } else {
    partes.push('\n## Streaming\n\nNão medido — este artista não tem dados de streaming sincronizados.')
  }

  /* ── faixas ─────────────────────────────────────────────────────────────── */
  const faixas = d.detalhe?.porFaixa ?? []
  if (faixas.length) {
    const top = faixas.slice(0, 15)
    partes.push(
      linhas([
        '',
        '### Faixas mais executadas na janela',
        '',
        '| Faixa | Streams | Pulos | Taxa de pulo |',
        '| --- | ---: | ---: | ---: |',
        ...top.map((f) => {
          const taxa = f.streams ? (f.skips ?? 0) / f.streams : null
          return `| ${d.titulos[f.isrc] ?? f.isrc} | ${n(f.streams)} | ${n(f.skips)} | ${pct(taxa)} |`
        }),
      ]),
    )
  }

  /* ── evolução ───────────────────────────────────────────────────────────── */
  const s = d.serie
  if (s?.pontos.length) {
    // Colunas sem NENHUM valor saem fora: uma coluna inteira de "não medido"
    // ocupa espaço e não informa nada que a linha de cobertura já não diga.
    const temIg = s.pontos.some((x) => x.instagram != null)
    const temTt = s.pontos.some((x) => x.tiktok != null)
    const temYt = s.pontos.some((x) => x.youtube != null)
    const temSt = s.pontos.some((x) => x.streams != null)
    const temHe = s.pontos.some((x) => x.health != null)
    const colunas = [
      temIg ? 'Instagram' : null,
      temTt ? 'TikTok' : null,
      temYt ? 'YouTube' : null,
      temSt ? 'Streams/dia' : null,
      temHe ? 'Health' : null,
    ].filter(Boolean) as string[]

    const ausentes = [
      !temIg ? 'Instagram' : null,
      !temTt ? 'TikTok' : null,
      !temYt ? 'YouTube' : null,
      !temSt ? 'streams' : null,
      !temHe ? 'Health Score' : null,
    ].filter(Boolean) as string[]

    partes.push(
      linhas([
        '',
        '## Evolução dia a dia',
        '',
        `Período: ${dia(s.de)} a ${dia(s.ate)} — ${s.pontos.length} dias com registro.`,
        ausentes.length
          ? `Sem série neste período: ${ausentes.join(', ')} — não medido, o que **não** quer dizer que não houve movimento.`
          : null,
        '',
        `| Dia | ${colunas.join(' | ')} |`,
        `| --- | ${colunas.map(() => '---:').join(' | ')} |`,
        ...s.pontos.map((x) => {
          const vals = [
            temIg ? n(x.instagram) : null,
            temTt ? n(x.tiktok) : null,
            temYt ? n(x.youtube) : null,
            temSt ? n(x.streams) : null,
            temHe ? n(x.health) : null,
          ].filter((c) => c !== null)
          return `| ${dia(x.dia)} | ${vals.join(' | ')} |`
        }),
        '',
        'Seguidores e inscritos são o TOTAL acumulado naquele dia; streams e Health Score são do dia.',
      ]),
    )
  }

  /* ── viralização ────────────────────────────────────────────────────────── */
  if (d.ugc?.totais) {
    partes.push(
      linhas([
        '',
        '## Vídeos do público no TikTok (fonte: OneRPM)',
        '',
        d.ugc.periodo
          ? `Janela: ${dia(d.ugc.periodo.de)} a ${dia(d.ugc.periodo.ate)}.`
          : null,
        '',
        `- Vídeos publicados pelo público usando as músicas: ${n(d.ugc.totais.criacoesUgc)}`,
        `- Visualizações desses vídeos: ${n(d.ugc.totais.viewsUgc)}`,
      ]),
    )
  }

  /* ── Soundcharts ────────────────────────────────────────────────────────── */
  const sc = p?.soundcharts
  if (sc) {
    partes.push(
      linhas([
        '',
        '## Mercado (fonte: Soundcharts)',
        '',
        `Consultado em ${data(sc.consultadoEm)}.`,
        '',
        `- Ouvintes mensais no Spotify: ${n(sc.ouvintesSpotify)}`,
        `- Execuções em rádio nos últimos 28 dias: ${n(sc.airplay28d)} em ${n(sc.airplayEmissoras28d)} emissoras`,
        `- Execuções em rádio nos últimos 12 meses: ${n(sc.airplay365d)} em ${n(sc.airplayEmissoras365d)} emissoras`,
        sc.airplayPrincipais?.length
          ? `- Emissoras que mais tocam: ${sc.airplayPrincipais.map((r) => `${r.nome} (${n(r.spins)})`).join(' · ')}`
          : null,
        sc.careerStage
          ? `- Estágio de carreira atribuído pela Soundcharts: ${sc.careerStage} — escala GLOBAL, na qual a maior parte de um selo regional brasileiro cai na mesma faixa. Não use isso para comparar artistas deste casting entre si.`
          : null,
        sc.resolvidoPor === 'nome'
          ? '- Atenção: este artista foi localizado por nome, não por identificador. Pode haver homônimo, e os números acima podem não ser dele.'
          : null,
      ]),
    )
  }

  /* ── índices ────────────────────────────────────────────────────────────── */
  if (d.ige) {
    const i = d.ige
    partes.push(
      linhas([
        '',
        '## Estágio de mercado (índice interno IGE)',
        '',
        `Mede o PORTE alcançado pelo projeto, de 0 a 100. Metodologia ${i.metodologia}.`,
        '',
        `- Índice: ${i.ige == null ? AUSENTE : i.ige.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de 100`,
        `- Estágio: ${i.estagio ?? AUSENTE}`,
        `- Cobertura da metodologia: ${pct(i.cobertura, 0)}${i.provisorio ? ' — o índice foi calculado só sobre as dimensões medidas; as que faltam aparecem como "não medido" na tabela abaixo' : ''}`,
        '',
        '| Dimensão | Peso | Nota | Origem |',
        '| --- | ---: | ---: | --- |',
        ...i.componentes.map(
          (c) => `| ${c.rotulo} | ${pct(c.peso, 0)} | ${c.score == null ? AUSENTE : c.score} | ${c.origem} |`,
        ),
      ]),
    )
  }

  if (d.saude) {
    partes.push(
      linhas([
        '',
        '## Health Score (índice interno)',
        '',
        'Mede a SAÚDE do projeto para o porte que ele tem — é outra pergunta, e não deve ser somado ao estágio.',
        '',
        `- Score: ${d.saude.score} de 100`,
        ...d.saude.pilares.map((pi) => `- ${pi.rotulo}: ${pi.score}`),
      ]),
    )
  }

  /* ── mercado ao vivo e dossiê ───────────────────────────────────────────── */
  const mav = p?.mercadoAoVivo
  if (mav) {
    partes.push(
      linhas([
        '',
        '## Mercado ao vivo (declarado pela equipe)',
        '',
        `- Nível ${mav.nivel} (nota ${mav.score} de 100)`,
        `- Avaliado em ${mav.avaliadoEm ? dia(mav.avaliadoEm) : data(mav.declaradoEm)}${mav.declaradoPor ? ` por ${mav.declaradoPor}` : ''}`,
        mav.observacao ? `- Observação da equipe: ${mav.observacao}` : null,
        '',
        'Este item é uma classificação declarada pela equipe, não uma medição — pondere de acordo.',
      ]),
    )
  }

  /* ── questionários ──────────────────────────────────────────────────────── */
  const respondidos = d.diagnosticos.filter((q) => q.doc?.respostas)
  if (respondidos.length) {
    partes.push('\n## Respostas dos questionários')
    for (const q of respondidos) {
      const respostas = Object.entries(q.doc?.respostas ?? {}).filter(
        ([, v]) => typeof v === 'string' && v.trim(),
      )
      if (!respostas.length) continue
      partes.push(
        linhas([
          '',
          `### ${q.nome}`,
          q.doc?.atualizadoEmMs
            ? `Respondido em ${new Date(q.doc.atualizadoEmMs).toLocaleDateString('pt-BR')}.`
            : null,
          '',
          ...respostas.map(([k, v]) => `**${k}**\n\n${String(v).trim()}\n`),
        ]),
      )
    }
  }

  /* ── receita (opcional, com permissão) ──────────────────────────────────── */
  if (d.receita) {
    const moeda = (v: Record<string, number>) =>
      Object.entries(v)
        .filter(([, x]) => x)
        .map(([m2, x]) => `${m2} ${x.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        .join(' · ') || AUSENTE
    partes.push(
      linhas([
        '',
        '## Receita',
        '',
        `Período: ${d.receita.periodo}. Fonte: relatório da OneRPM.`,
        '',
        '**Os valores estão separados por moeda e não devem ser somados entre si** — não há conversão aplicada aqui.',
        '',
        ...d.receita.porPlataforma.map(
          (x) => `- ${x.nome} — ${moeda(x.porMoeda)} (${n(x.streams)} streams)`,
        ),
      ]),
    )
  }

  partes.push(
    linhas([
      '',
      '---',
      '',
      'Dados internos da Imagine Group. Os índices IGE e Health Score são metodologia própria e não são públicos.',
    ]),
  )

  return partes.join('\n')
}

/** Nome do arquivo baixado — slug e data, para não virar "download (3)". */
export function nomeDoArquivo(slug: string, ext: 'md' | 'xlsx', geradoEm = new Date()): string {
  const d = geradoEm.toISOString().slice(0, 10)
  return `${slug}-painel-imagine-${d}.${ext}`
}

/* ── planilha ───────────────────────────────────────────────────────────────── */

/** Uma aba: nome, larguras de coluna e as linhas já prontas. */
export interface AbaPlanilha {
  nome: string
  larguras: number[]
  linhas: (string | number | null)[][]
  /**
   * Linha de contexto sob o logo: período, fonte, aviso. Fica na faixa escura do
   * topo de propósito — aviso enfiado no meio da tabela é aviso que ninguém lê,
   * e ele não pode disputar a linha do cabeçalho, que o filtro usa.
   */
  subtitulo?: string
  /**
   * Formato numérico por índice de coluna (código do Excel, ex.: `'0,0%'`).
   *
   * Fração crua numa célula sai como 0,18018087206845476 e obriga quem abre a
   * formatar antes de conseguir ler. Guardar o valor como fração é certo — é o
   * que soma e compara —, mas ele deve CHEGAR formatado.
   */
  formatos?: Record<number, string>
}

/**
 * Os mesmos dados em forma de planilha.
 *
 * Aqui a regra do "não medido" fica MAIS importante, não menos: célula vazia em
 * Excel lê como zero para quase todo mundo, e para qualquer soma. Por isso a
 * ausência continua escrita por extenso, mesmo custando o tipo numérico da
 * coluna — número medido entra como número, ausência entra como texto, e a
 * mistura é o próprio aviso.
 */
export function montarPlanilha(d: DadosExportacao, geradoEm = new Date()): AbaPlanilha[] {
  const a = d.artista
  const m = d.metricas
  const p = d.projeto
  const st = m?.streaming
  const sc = p?.soundcharts
  const yt = m?.youtube

  /** Número medido vira número (soma, ordena, vira gráfico); ausência vira texto. */
  const v = (x: number | null | undefined): number | string =>
    x == null || !Number.isFinite(x) ? AUSENTE : x

  const resumo: (string | number | null)[][] = [
    ['Seção', 'Campo', 'Valor', 'Janela / observação'],
    ['Identidade', 'Nome', a.nome, ''],
    ['Identidade', 'Gênero', a.genero || AUSENTE, ''],
    ['Identidade', 'Selo', a.label || AUSENTE, ''],
    ['Identidade', 'Faixas no catálogo', v(a.fonogramas), ''],
    ['Identidade', 'Exportado em', geradoEm.toLocaleString('pt-BR'), ''],

    ['Audiência', 'Seguidores no Instagram', v(m?.instagram?.seguidores), m?.instagram?.coletadoEm ? `coletado em ${data(m.instagram.coletadoEm)}` : ''],
    ['Audiência', 'Seguidores no TikTok', v(m?.tiktok?.seguidores), m?.tiktok?.coletadoEm ? `coletado em ${data(m.tiktok.coletadoEm)}` : ''],
    ['Audiência', 'Inscritos no YouTube', yt?.inscritosOcultos ? 'canal esconde a contagem' : v(yt?.inscritos), yt?.coletadoEm ? `coletado em ${data(yt.coletadoEm)}` : ''],
    ['Audiência', 'Views totais do canal no YouTube', v(yt?.viewsTotais), ''],
    ['Audiência', 'Views do YouTube na janela', v(yt?.analytics?.views), yt?.analytics ? `${yt.analytics.periodoDias} dias` : ''],
  ]

  const janelaSt = st ? `${dia(st.periodo?.de)} a ${dia(st.periodo?.ate)}` : ''
  resumo.push(
    ['Streaming', 'Streams na janela', v(st?.streams), janelaSt ? `${janelaSt} · fonte OneRPM` : 'fonte OneRPM'],
    ['Streaming', 'Streams em 28 dias', v(st?.streams28d), ''],
    ['Streaming', 'Streams em 7 dias', v(st?.streams7d), ''],
    ['Streaming', 'Taxa de pulo', st?.skipRate == null ? AUSENTE : st.skipRate, 'fração de 0 a 1 — formate como porcentagem'],
    ['Streaming', 'Faixas com execução', v(st?.faixas), ''],
    ['Streaming', 'Último dia com dado', st?.ultimoDia ? dia(st.ultimoDia) : AUSENTE, ''],
  )
  for (const x of st?.porPlataforma ?? []) {
    resumo.push(['Streaming por plataforma', x.plataforma, v(x.streams), janelaSt])
  }
  for (const x of (st?.porPais ?? []).slice(0, 10)) {
    resumo.push(['Streaming por país', x.pais, v(x.streams), janelaSt])
  }

  if (d.ugc?.totais) {
    const j = d.ugc.periodo ? `${dia(d.ugc.periodo.de)} a ${dia(d.ugc.periodo.ate)}` : ''
    resumo.push(
      ['TikTok (público)', 'Vídeos feitos pelo público', v(d.ugc.totais.criacoesUgc), j],
      ['TikTok (público)', 'Views desses vídeos', v(d.ugc.totais.viewsUgc), j],
    )
  }

  if (sc) {
    const quando = `consultado em ${data(sc.consultadoEm)}`
    resumo.push(
      ['Mercado', 'Ouvintes mensais no Spotify', v(sc.ouvintesSpotify), `${quando} · fonte Soundcharts`],
      ['Mercado', 'Execuções em rádio (28 dias)', v(sc.airplay28d), `${quando} · ${n(sc.airplayEmissoras28d)} emissoras`],
      ['Mercado', 'Execuções em rádio (12 meses)', v(sc.airplay365d), `${quando} · ${n(sc.airplayEmissoras365d)} emissoras`],
      ['Mercado', 'Estágio de carreira (Soundcharts)', sc.careerStage ?? AUSENTE, 'escala GLOBAL — não serve para comparar artistas deste casting entre si'],
    )
  }

  if (d.ige) {
    resumo.push(
      ['Estágio (IGE)', 'Índice', d.ige.ige ?? AUSENTE, `${d.ige.metodologia}${d.ige.provisorio ? ' · leitura PROVISÓRIA' : ''}`],
      ['Estágio (IGE)', 'Estágio', d.ige.estagio ?? AUSENTE, ''],
      ['Estágio (IGE)', 'Cobertura da metodologia', d.ige.cobertura, 'fração de 0 a 1 — formate como porcentagem'],
    )
    for (const c of d.ige.componentes) {
      resumo.push(['Estágio (IGE)', c.rotulo, c.score ?? AUSENTE, `peso ${pct(c.peso, 0)} · ${c.origem}`])
    }
  }

  if (d.saude) {
    resumo.push(['Health Score', 'Score', d.saude.score, ''])
    for (const pi of d.saude.pilares) resumo.push(['Health Score', pi.rotulo, pi.score, ''])
  }

  const mav = p?.mercadoAoVivo
  if (mav) {
    resumo.push([
      'Mercado ao vivo',
      `Nível ${mav.nivel}`,
      mav.score,
      `declarado pela equipe${mav.declaradoPor ? ` por ${mav.declaradoPor}` : ''} · não é medição`,
    ])
  }

  const abas: AbaPlanilha[] = [
    {
      nome: 'Resumo',
      larguras: [22, 34, 18, 52],
      subtitulo: `Exportado em ${geradoEm.toLocaleString('pt-BR')}  ·  "não medido" não é zero`,
      linhas: resumo,
    },
  ]

  if (d.serie?.pontos.length) {
    const s = d.serie
    const temIg = s.pontos.some((x) => x.instagram != null)
    const temTt = s.pontos.some((x) => x.tiktok != null)
    const temYt = s.pontos.some((x) => x.youtube != null)
    const temSt = s.pontos.some((x) => x.streams != null)
    const temHe = s.pontos.some((x) => x.health != null)
    const cab = ['Dia']
    if (temIg) cab.push('Instagram')
    if (temTt) cab.push('TikTok')
    if (temYt) cab.push('YouTube')
    if (temSt) cab.push('Streams no dia')
    if (temHe) cab.push('Health Score')

    abas.push({
      nome: 'Evolução',
      larguras: [12, ...cab.slice(1).map(() => 16)],
      subtitulo: `${dia(s.de)} a ${dia(s.ate)}  ·  ${s.pontos.length} dias  ·  seguidores são total acumulado; streams e Health, do dia`,
      linhas: [
        cab,
        ...s.pontos.map((x) => {
          const linha: (string | number | null)[] = [dia(x.dia)]
          if (temIg) linha.push(v(x.instagram))
          if (temTt) linha.push(v(x.tiktok))
          if (temYt) linha.push(v(x.youtube))
          if (temSt) linha.push(v(x.streams))
          if (temHe) linha.push(v(x.health))
          return linha
        }),
      ],
    })
  }

  const faixas = d.detalhe?.porFaixa ?? []
  if (faixas.length) {
    abas.push({
      nome: 'Faixas',
      larguras: [46, 16, 14, 12, 14],
      subtitulo: st
        ? `Execuções de ${dia(st.periodo?.de)} a ${dia(st.periodo?.ate)}  ·  fonte OneRPM`
        : undefined,
      // coluna 4 = taxa de pulo, guardada como fração e exibida como %
      formatos: { 4: '0.0%' },
      linhas: [
        ['Faixa', 'ISRC', 'Streams', 'Pulos', 'Taxa de pulo'],
        ...faixas.slice(0, 100).map((f) => [
          d.titulos[f.isrc] ?? AUSENTE,
          f.isrc,
          v(f.streams),
          v(f.skips),
          f.streams ? (f.skips ?? 0) / f.streams : AUSENTE,
        ]),
      ],
    })
  }

  if (d.receita) {
    const linhasReceita: (string | number | null)[][] = [
      ['Plataforma', 'Streams', 'Moeda', 'Valor'],
    ]
    for (const x of d.receita.porPlataforma) {
      const moedas = Object.entries(x.porMoeda).filter(([, val]) => val)
      if (!moedas.length) {
        linhasReceita.push([x.nome, v(x.streams), AUSENTE, AUSENTE])
        continue
      }
      // Uma linha POR MOEDA: o painel nunca soma moedas diferentes, e numa
      // planilha juntar tudo numa coluna só convida exatamente esse erro.
      for (const [moeda, val] of moedas) linhasReceita.push([x.nome, v(x.streams), moeda, val])
    }
    abas.push({
      nome: 'Receita',
      larguras: [28, 14, 10, 16],
      formatos: { 3: '#,##0.00' },
      subtitulo: `Período: ${d.receita.periodo}  ·  valores separados por MOEDA — não some moedas diferentes`,
      linhas: linhasReceita,
    })
  }

  abas.push({
    nome: 'Como ler',
    larguras: [100],
    linhas: [
      ['Como ler esta planilha'],
      [],
      ['"não medido" NÃO é zero. O dado não foi coletado — o artista pode ter público naquela rede,'],
      ['só não temos a medição. Não trate como ausência de resultado, e não substitua por zero.'],
      [],
      ['Cada linha traz a janela de tempo e a fonte na última coluna. Não compare números de'],
      ['janelas diferentes entre si.'],
      [],
      ['Taxa de pulo e cobertura são guardadas como fração de 0 a 1 e já chegam formatadas como'],
      ['porcentagem. O valor por trás continua sendo a fração, então cálculos em cima dela funcionam.'],
      [],
      ['Os índices IGE e Health Score são metodologia própria da Imagine e não são públicos.'],
      ['O estágio de carreira da Soundcharts é de escala global e mede outra coisa.'],
      [],
      [`Exportado do Painel Imagine em ${geradoEm.toLocaleString('pt-BR')}.`],
    ],
  })

  return abas
}

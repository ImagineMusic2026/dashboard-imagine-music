/**
 * Questionários de estruturação — o diagnóstico que a Imagine aplica no começo do
 * trabalho com um artista. Transcritos dos dois formulários que hoje vivem no Pipefy.
 *
 * São DOIS: "Projeto" (o negócio em volta do artista — empresa, faturamento, SWOT) e
 * "Artista" (a pessoa — trajetória, referências, arquétipos). Quem responde é o
 * ARTISTA, logado no portal.
 *
 * ⚠️ O `id` de cada pergunta é a CHAVE do que fica gravado em `respostas`. Renomear
 * um id órfã a resposta já dada. Mudar rótulo/ajuda é livre; mudar id, não.
 *
 * Módulo puro (sem React, sem Firebase): serve o form do portal e a leitura da equipe.
 */

export type TipoDiagnostico = 'projeto' | 'artista'

export const TIPOS: TipoDiagnostico[] = ['projeto', 'artista']

export function ehTipoValido(t: string): t is TipoDiagnostico {
  return t === 'projeto' || t === 'artista'
}

export interface Pergunta {
  id: string
  rotulo: string
  /** Texto de apoio abaixo do rótulo (o "helper" do Pipefy). */
  ajuda?: string
  /** Altura inicial do campo. Perguntas de resposta curta pedem menos. */
  linhas?: number
}

export interface Secao {
  titulo?: string
  descricao?: string
  perguntas: Pergunta[]
}

export interface Questionario {
  tipo: TipoDiagnostico
  titulo: string
  intro: string
  secoes: Secao[]
}

const PROJETO: Questionario = {
  tipo: 'projeto',
  titulo: 'Questionário de Estruturação · Projeto',
  intro:
    'Este questionário reúne informações essenciais para entendermos melhor o projeto. Com base nessas respostas, poderemos criar um plano estratégico personalizado. Caso tenha dúvidas sobre algum campo, fique tranquilo — discutiremos tudo detalhadamente na nossa reunião.',
  secoes: [
    {
      perguntas: [
        {
          id: 'nome-empresa',
          rotulo: 'Nome da empresa',
          ajuda: 'Informe o nome da empresa responsável pela venda exclusiva do artista.',
          linhas: 1,
        },
        {
          id: 'envolvidos',
          rotulo: 'Principais envolvidos no projeto',
          ajuda: 'Liste os principais envolvidos no projeto e suas funções.',
        },
        {
          id: 'historia-projeto',
          rotulo: 'História do projeto',
          ajuda:
            'Conte um pouco sobre o projeto para que possamos entender mais sobre vocês: histórico, cidades em que fizeram shows, composição societária, estrutura organizacional, principais clientes, melhores apresentações e gravações.',
          linhas: 6,
        },
        {
          id: 'ticket-medio',
          rotulo: 'Ticket médio dos shows (receita média)',
          ajuda: 'Informe o ticket médio dos shows.',
          linhas: 2,
        },
        {
          id: 'faturamento-medio',
          rotulo: 'Faturamento médio atual',
          ajuda: 'Informe o faturamento médio em meses de alta (junho/dezembro) e em meses normais.',
          linhas: 2,
        },
        {
          id: 'investimento-digital',
          rotulo: 'Histórico de investimento em digital',
          ajuda: 'Descreva os investimentos em mídia, como impulsionamentos e campanhas.',
        },
        {
          id: 'ferramentas',
          rotulo: 'Ferramentas ou sistemas utilizados',
          ajuda: 'Quais ferramentas ou sistemas vocês usam para gerenciar agenda, vendas, financeiro e marketing?',
        },
        {
          id: 'margem-contribuicao',
          rotulo: 'Margem de contribuição média',
          ajuda: 'Informe a margem de contribuição média (valor da venda − custos variáveis).',
          linhas: 2,
        },
        {
          id: 'objetivo-principal',
          rotulo: 'Principal objetivo do projeto',
          ajuda:
            'Seja específico sobre a principal demanda para o momento atual. Exemplos: venda de shows para órgãos públicos; planejamento de conteúdo digital; reestruturação de marca; construção de audiência.',
        },
      ],
    },
    {
      titulo: 'Matriz SWOT',
      descricao: 'Um retrato honesto de onde o projeto está forte, onde está exposto, e o que vem de fora.',
      perguntas: [
        {
          id: 'swot-forcas',
          rotulo: '🟢 Pontos Fortes',
          ajuda:
            'Qualidades internas que destacam o trabalho artístico: talento musical, presença de palco, identidade visual, engajamento com o público, rede de contatos ou qualidade das produções.',
        },
        {
          id: 'swot-fraquezas',
          rotulo: '🔴 Pontos Fracos',
          ajuda:
            'Desafios internos que dificultam o crescimento. Exemplos: dificuldade de organização, falta de equipamentos, baixa divulgação, ausência de equipe ou limitação em determinadas habilidades.',
        },
        {
          id: 'swot-oportunidades',
          rotulo: '🟡 Oportunidades',
          ajuda:
            'Fatores externos que podem impulsionar a carreira: editais culturais, festivais, parcerias, tendências musicais em alta, expansão de nichos ou interesse de marcas.',
        },
        {
          id: 'swot-ameacas',
          rotulo: '⚫ Ameaças',
          ajuda:
            'Situações externas que colocam a trajetória em risco: instabilidade no mercado cultural, cortes de verba pública, excesso de concorrência, mudanças nas plataformas digitais ou desvalorização do trabalho artístico.',
        },
      ],
    },
    {
      titulo: 'Venda de shows',
      perguntas: [
        {
          id: 'vendedores',
          rotulo: 'Principais vendedores do projeto',
          ajuda: 'Liste os principais vendedores, incluindo o contato para venda de shows.',
        },
        {
          id: 'objecoes-venda',
          rotulo: 'Principais desafios ou objeções na venda de shows',
          ajuda: 'Quais os principais desafios ou objeções enfrentadas na venda de shows?',
        },
        {
          id: 'diferenciais',
          rotulo: 'Diferenciais do projeto',
          ajuda: 'O que faz desse projeto diferente dos demais?',
        },
      ],
    },
  ],
}

const ARTISTA: Questionario = {
  tipo: 'artista',
  titulo: 'Questionário de Estruturação · Artista',
  intro:
    'Este questionário reúne informações essenciais para entendermos melhor o seu perfil, sua trajetória e seus objetivos. Com base nessas respostas, poderemos criar um plano estratégico personalizado para conduzir sua carreira. Caso tenha dúvidas sobre algum campo, fique tranquilo — discutiremos tudo detalhadamente na nossa reunião.',
  secoes: [
    {
      perguntas: [
        {
          id: 'links',
          rotulo: 'Sites, redes sociais e plataformas',
          ajuda: 'Links das redes e plataformas do projeto (Instagram, YouTube, TikTok, Kwai, Spotify, Facebook…).',
          linhas: 4,
        },
      ],
    },
    {
      titulo: 'História pregressa',
      perguntas: [
        { id: 'primeiro-contato-musica', rotulo: 'Como foi seu primeiro contato com a música?' },
        { id: 'infancia', rotulo: 'Como foi sua infância?' },
        { id: 'familia', rotulo: 'Como é a sua família?' },
        { id: 'caracteristicas', rotulo: 'Quais são suas 5 principais características?' },
        { id: 'amigos-descreveriam', rotulo: 'Como teus amigos te descreveriam?' },
      ],
    },
    {
      titulo: 'Carreira',
      perguntas: [
        { id: 'relacao-musica', rotulo: 'Como começou a sua relação com a música?' },
        { id: 'nome-artistico', rotulo: 'Qual é o seu nome artístico? Por quê?' },
        {
          id: 'musica-representa',
          rotulo: 'Qual a sua música que mais te representa?',
          ajuda: 'Interpretação de músicas de terceiros também vale!',
          linhas: 2,
        },
        {
          id: 'musica-sucesso',
          rotulo: 'Qual a sua música que mais faz sucesso?',
          ajuda: 'Interpretação de músicas de terceiros também vale!',
          linhas: 2,
        },
        { id: 'trajetoria', rotulo: 'Como você descreve a trajetória da sua carreira?', linhas: 5 },
        {
          id: 'momento-atual',
          rotulo: 'Qual o momento atual da sua carreira?',
          ajuda:
            'Sua trajetória está em fase inicial, passando por um crescimento leve ou acelerado, ou enfrentando dificuldades? Compartilhe como você enxerga o momento atual.',
        },
        {
          id: 'objetivo-estruturacao',
          rotulo: 'Qual o principal objetivo que você deseja alcançar com o trabalho de estruturação artística?',
          ajuda:
            'Pense em algo específico e mensurável; evite respostas muito amplas. Ex.: "quero profissionalizar minha imagem nas redes e fechar pelo menos 3 grandes shows".',
        },
        { id: 'percepcao-publico', rotulo: 'Como você quer que o público te perceba?' },
        { id: 'sonho-show', rotulo: 'Onde seria um sonho fazer um show?', linhas: 2 },
      ],
    },
    {
      titulo: 'Referências e gostos pessoais',
      perguntas: [
        { id: 'referencias-musicais', rotulo: 'Quais são suas referências musicais?' },
        { id: 'top5-cultura', rotulo: 'Quais são seus top 5 filmes, séries, diretores ou livros?' },
        { id: 'hobby', rotulo: 'Como você preenche seu tempo? Tem hobby?' },
        { id: 'temas-interesse', rotulo: 'Liste 5 temas e interesses pessoais.', ajuda: 'Liste-os em ordem de importância!' },
      ],
    },
    {
      titulo: 'Definição de arquétipos',
      descricao:
        'Responda com sinceridade e clareza. Estas perguntas ajudam a entender sua essência como artista, sua forma de atuar e o que te inspira. Seja direto, mas conte com detalhes o que for importante.',
      perguntas: [
        {
          id: 'arquetipo-o-que-faz',
          rotulo: 'O que você faz: seu segmento',
          ajuda:
            'Explique de forma simples qual é o seu estilo musical, como você se apresenta artisticamente, e o que o público pode esperar do seu trabalho.',
        },
        {
          id: 'arquetipo-como-faz',
          rotulo: 'Como você faz: seu método de trabalho',
          ajuda:
            'Conte como você escolhe seu repertório, como funciona seu processo criativo, como prepara suas apresentações e se posiciona nas redes sociais.',
        },
        {
          id: 'arquetipo-por-que-faz',
          rotulo: 'Por que você faz: sua motivação',
          ajuda:
            'Fale sobre o que te move a continuar cantando, compondo, investindo na sua carreira e compartilhando sua arte com o público.',
        },
      ],
    },
  ],
}

const POR_TIPO: Record<TipoDiagnostico, Questionario> = { projeto: PROJETO, artista: ARTISTA }

export function questionario(tipo: TipoDiagnostico): Questionario {
  return POR_TIPO[tipo]
}

/** Rótulo curto pra menu/card. */
export const NOME_CURTO: Record<TipoDiagnostico, string> = {
  projeto: 'Projeto',
  artista: 'Artista',
}

/** Todas as perguntas de um questionário, achatadas — pra contar e pra exibir. */
export function perguntasDe(tipo: TipoDiagnostico): Pergunta[] {
  return POR_TIPO[tipo].secoes.flatMap((s) => s.perguntas)
}

/** Ids válidos — o que não estiver aqui é descartado antes de gravar. */
export function idsValidos(tipo: TipoDiagnostico): Set<string> {
  return new Set(perguntasDe(tipo).map((p) => p.id))
}

export interface Progresso {
  respondidas: number
  total: number
  /** 0–100, arredondado. */
  pct: number
}

export function progressoDe(tipo: TipoDiagnostico, respostas: Record<string, string> | undefined): Progresso {
  const perguntas = perguntasDe(tipo)
  const respondidas = perguntas.filter((p) => (respostas?.[p.id] ?? '').trim().length > 0).length
  return {
    respondidas,
    total: perguntas.length,
    pct: perguntas.length ? Math.round((respondidas / perguntas.length) * 100) : 0,
  }
}

/**
 * Dossiê do artista — as evidências das alavancas estratégicas (IAOS-DOC-02).
 *
 * Vem do documento "Cadastro-base do projeto/artista" da Imagine, e a decisão
 * que molda o arquivo inteiro está na frase da cliente: *"a ideia é que eles
 * fiquem dentro do painel e não inseridos no momento do cadastro"*. Ou seja,
 * isto NÃO engorda o formulário de criar artista: é uma ficha que a equipe
 * preenche ao longo do tempo, dentro do perfil.
 *
 * Três decisões que valem por escrito:
 *
 * 1. **Status não se grava, se deriva.** O documento pede
 *    "disponível / desatualizado / ausente" em várias evidências. Gravar essa
 *    palavra faria ela envelhecer sozinha: um release marcado como "disponível"
 *    em março continua dizendo "disponível" em dezembro. Guardamos QUANDO
 *    alguém conferiu, e a tela calcula o resto. É a mesma escolha que o repo já
 *    fez na situação dos contratos.
 *
 * 2. **Sem upload, só link.** O projeto não tem Firebase Storage (exigiria o
 *    plano pago) e a Vercel barra corpo acima de 4,5 MB. Todo "link
 *    comprobatório" do documento é URL — o arquivo mora no Drive da Imagine,
 *    como já acontece nos contratos e no anexo do questionário.
 *
 * 3. **A fronteira de acesso decide onde cada campo mora.** Regra do Firestore é
 *    por documento e não esconde campo. O que é fato público do artista (a
 *    página dele, o id num agregador) vai para `artistas/{slug}`, que ele lê no
 *    portal. O que é juízo da equipe SOBRE ele — status "Restrito", observações
 *    de titularidade — vai para `projetos/{slug}`, que ele não lê.
 */

/* -------------------------------------------------------------------------- */
/* Evidência                                                                   */
/* -------------------------------------------------------------------------- */

/** Um link que a equipe mantém, com o carimbo de quem conferiu e quando. */
export interface Evidencia {
  url: string
  /** ISO — quando alguém conferiu/atualizou. É daqui que sai o status. */
  atualizadoEm: string
  atualizadoPor: string
}

export type StatusEvidencia = 'disponivel' | 'desatualizado' | 'ausente'

export const statusMeta: Record<StatusEvidencia, { label: string; chip: string }> = {
  disponivel: {
    label: 'Disponível',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  desatualizado: {
    label: 'Desatualizado',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  ausente: { label: 'Ausente', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
}

/**
 * A partir de quantos dias uma evidência conta como desatualizada.
 *
 * ⚠️ 180 dias é uma escolha NOSSA — o documento pede o status mas não diz a
 * janela. Seis meses é o que faz um presskit do semestre passado aparecer como
 * pendente sem transformar todo link em alarme. Trocar isto é mudar a constante;
 * nenhuma outra parte do código depende do valor.
 */
export const DIAS_ATE_DESATUALIZAR = 180

export function statusDaEvidencia(e: Evidencia | null | undefined): StatusEvidencia {
  if (!e?.url) return 'ausente'
  if (!e.atualizadoEm) return 'disponivel'
  const dias = (Date.now() - new Date(e.atualizadoEm).getTime()) / 86_400_000
  return dias > DIAS_ATE_DESATUALIZAR ? 'desatualizado' : 'disponivel'
}

/* -------------------------------------------------------------------------- */
/* 2. Expansão de Mercado                                                      */
/* -------------------------------------------------------------------------- */

/**
 * As quatro evidências da alavanca. O Mercado ao Vivo, que é a quinta, mora
 * separado em `ProjetoDoc.mercadoAoVivo` porque não é link: é declaração com
 * score que entra no IGE.
 *
 * `agenda` é o link do Google Calendar — foi a escolha da cliente entre colar um
 * link e cadastrar shows no painel. Consequência a não esquecer: volume,
 * recorrência, sazonalidade, público/privado e distribuição geográfica NÃO saem
 * de um link. Enquanto for assim, a medida de palco é a declaração da equipe.
 */
export interface ExpansaoMercado {
  agenda?: Evidencia | null
  release?: Evidencia | null
  presskit?: Evidencia | null
  notoriedade?: Evidencia | null
}

export const CAMPOS_EXPANSAO = [
  { chave: 'agenda', label: 'Agenda', ajuda: 'Link do Google Calendar da agenda de shows.' },
  { chave: 'release', label: 'Release de imprensa', ajuda: 'Texto de divulgação atual do artista.' },
  { chave: 'presskit', label: 'Presskit', ajuda: 'Material de imprensa (fotos, bio, rider).' },
  { chave: 'notoriedade', label: 'Notoriedade', ajuda: 'Matérias, prêmios e reconhecimento público.' },
] as const satisfies readonly { chave: keyof ExpansaoMercado; label: string; ajuda: string }[]

/* -------------------------------------------------------------------------- */
/* 3. Crescimento Digital (a parte que não vem de integração)                   */
/* -------------------------------------------------------------------------- */

export type PlataformaMidiaPaga = 'meta' | 'google' | 'tiktok' | 'outra'

export const plataformaMidiaMeta: Record<PlataformaMidiaPaga, string> = {
  meta: 'Meta (Facebook/Instagram)',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  outra: 'Outra',
}

export const PLATAFORMAS_MIDIA = Object.keys(plataformaMidiaMeta) as PlataformaMidiaPaga[]

/**
 * Mídia paga. Lista FECHADA de plataforma de propósito: em texto livre, "Meta",
 * "meta ads" e "Facebook" viram três plataformas diferentes no dia em que
 * alguém quiser agrupar por canal.
 */
export interface MidiaPaga extends Evidencia {
  plataforma: PlataformaMidiaPaga
  /** Período coberto pelo painel, em texto livre ("jan–mar/2026"). */
  periodo?: string | null
}

export interface CrescimentoDigital {
  midiaPaga?: MidiaPaga | null
}

/* -------------------------------------------------------------------------- */
/* 5. Inventário de Patrimônio Artístico                                        */
/* -------------------------------------------------------------------------- */

export type StatusCatalogo = 'liberado' | 'parcial' | 'restrito' | 'nao-verificado'

export const statusCatalogoMeta: Record<StatusCatalogo, { label: string; chip: string }> = {
  liberado: { label: 'Liberado', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  parcial: { label: 'Parcial', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  restrito: { label: 'Restrito', chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
  'nao-verificado': { label: 'Não verificado', chip: 'bg-bg-700 text-ink-400 border-bg-700' },
}

export const STATUS_CATALOGO = Object.keys(statusCatalogoMeta) as StatusCatalogo[]

/**
 * O status do catálogo é a ÚNICA exceção à regra "status se deriva".
 *
 * Os outros status envelhecem porque medem a atualidade de um link. Este é um
 * parecer de titularidade: "Restrito" não deixa de ser verdade porque seis meses
 * passaram. Por isso ele é gravado — mas gravado COM data e responsável, que é o
 * que permite a alguém saber de quando é o parecer e a quem perguntar.
 */
export interface DeclaracaoCatalogo {
  valor: StatusCatalogo
  declaradoEm: string
  declaradoPor: string
}

export interface PatrimonioAutoral {
  /** Código IPI/CAE do autor. */
  ipi?: string | null
  editora?: string | null
  /** Nº de obras registradas. Manual: o catálogo da OneRPM traz fonograma, não obra. */
  numeroObras?: number | null
  /** ECAD, ABRAMUS, UBC… quando registrado. */
  sociedade?: string | null
  links?: string[]
  observacoes?: string | null
}

export interface PatrimonioInterpretativo {
  /** Código IPN do intérprete. */
  ipn?: string | null
  links?: string[]
  observacoes?: string | null
}

export interface PatrimonioFonografico {
  /** Fonogramas em que o artista é o produtor fonográfico (dono do master). */
  fonogramasProdutor?: number | null
  masters?: number | null
  statusCatalogo?: DeclaracaoCatalogo | null
  links?: string[]
  observacoes?: string | null
}

export interface CapitalRelacional {
  /** URL do Spotify SongDNA. */
  songDna?: string | null
  colaboracoes?: string | null
  conexoes?: string | null
  observacoes?: string | null
}

export interface Patrimonio {
  autoral?: PatrimonioAutoral | null
  interpretativo?: PatrimonioInterpretativo | null
  fonografico?: PatrimonioFonografico | null
  relacional?: CapitalRelacional | null
}

/* -------------------------------------------------------------------------- */
/* Equipe interna                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Quem da Imagine atende este artista.
 *
 * É o "Equipe / usuários vinculados" do documento na leitura que a cliente
 * confirmou: a equipe INTERNA, não os logins do artista no portal (esses já
 * existem, via `users.artistaSlug`).
 *
 * O nome vai denormalizado junto do uid pelo mesmo motivo do responsável nas
 * atividades: exibir a lista sem ter que ler `users` artista por artista.
 */
export interface MembroEquipe {
  uid: string
  nome: string
}

/* -------------------------------------------------------------------------- */
/* Leitura de conjunto                                                         */
/* -------------------------------------------------------------------------- */

/** Quantas das quatro evidências de Expansão estão disponíveis. */
export function coberturaExpansao(e: ExpansaoMercado | null | undefined): {
  disponiveis: number
  total: number
  desatualizadas: number
} {
  const itens = CAMPOS_EXPANSAO.map((c) => statusDaEvidencia(e?.[c.chave]))
  return {
    disponiveis: itens.filter((s) => s === 'disponivel').length,
    total: itens.length,
    desatualizadas: itens.filter((s) => s === 'desatualizado').length,
  }
}

/** O inventário tem qualquer coisa preenchida? Decide se o bloco aparece. */
export function temPatrimonio(p: Patrimonio | null | undefined): boolean {
  if (!p) return false
  const blocos = [p.autoral, p.interpretativo, p.fonografico, p.relacional]
  return blocos.some(
    (b) =>
      !!b &&
      Object.values(b).some((v) =>
        Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '',
      ),
  )
}

/** Aceita só http(s) — o link vira um `href` que a equipe clica. */
export function linkValido(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

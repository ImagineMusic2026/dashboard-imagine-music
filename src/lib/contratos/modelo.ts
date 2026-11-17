import { EMPRESA } from '@/lib/empresa'
import {
  dataPorExtenso,
  hojeISO,
  type CampoContrato,
  type ConfigContratos,
  type ModeloContrato,
  type QuemPreenche,
} from '@/lib/contratos/tipos'

/**
 * Preencher o modelo — puro, sem Firebase e sem React.
 *
 * Recebe o texto do modelo e os valores, devolve o texto pronto e as listas de
 * campos. É usado em três lugares que não podem divergir: o formulário da
 * equipe, a página pública onde o artista assina e o PDF. Se cada um montasse o
 * seu, o documento impresso poderia dizer coisa diferente do que a pessoa leu
 * antes de assinar — que é o defeito mais caro que este fluxo pode ter.
 */

/* -------------------------------------------------------------------------- */
/* Variáveis                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * As variáveis que o painel preenche sozinho — não viram campo de formulário.
 *
 * A lista é mostrada na configuração: quem escreve o modelo precisa saber o que
 * já existe antes de criar um campo pra mesma coisa.
 */
export const VARIAVEIS_AUTOMATICAS: { chave: string; descricao: string }[] = [
  { chave: 'artista_nome', descricao: 'Nome do artista como está no cadastro' },
  { chave: 'vigencia_inicio', descricao: 'Início da vigência, por extenso' },
  { chave: 'vigencia_fim', descricao: 'Fim da vigência, ou "prazo indeterminado"' },
  { chave: 'percentual', descricao: 'Percentual do contrato, quando houver' },
  { chave: 'data_hoje', descricao: 'Data de hoje, por extenso' },
  { chave: 'empresa_razao_social', descricao: EMPRESA.razaoSocial },
  { chave: 'empresa_cnpj', descricao: EMPRESA.cnpj },
  { chave: 'empresa_endereco', descricao: 'Endereço da Imagine' },
  { chave: 'empresa_email', descricao: EMPRESA.email },
  { chave: 'foro', descricao: EMPRESA.foro },
]

export interface DadosAutomaticos {
  artistaNome: string
  inicio?: string | null
  fim?: string | null
  percentual?: number | null
  /**
   * A data que sai no documento ('YYYY-MM-DD'). Depois de emitido é sempre o
   * `emitidoEm` gravado no contrato — nunca "hoje", senão o mesmo contrato
   * renderizaria diferente a cada dia e o `hash` da assinatura pararia de bater.
   * Sem ela (a prévia, antes de emitir) vale hoje.
   */
  dataDocumento?: string | null
}

/**
 * Monta os valores das variáveis automáticas. Nunca devolve `undefined`.
 *
 * É calculado SEMPRE no servidor pra quem assina: a página pública recebe estes
 * valores prontos e não os recalcula. Se cada lado montasse os seus, o texto que
 * o artista leu e o texto cujo hash foi gravado poderiam divergir por um fuso.
 */
export function valoresAutomaticos(d: DadosAutomaticos): Record<string, string> {
  return {
    artista_nome: d.artistaNome,
    vigencia_inicio: d.inicio ? dataPorExtenso(d.inicio) : '',
    vigencia_fim: d.fim ? dataPorExtenso(d.fim) : 'prazo indeterminado',
    percentual: typeof d.percentual === 'number' ? `${d.percentual}%` : '',
    data_hoje: dataPorExtenso(d.dataDocumento || hojeISO()),
    empresa_razao_social: EMPRESA.razaoSocial,
    empresa_cnpj: EMPRESA.cnpj,
    empresa_endereco: EMPRESA.endereco,
    empresa_email: EMPRESA.email,
    foro: EMPRESA.foro,
  }
}

/**
 * Função, e não uma constante compartilhada: uma `RegExp` com `/g` carrega
 * `lastIndex` entre chamadas, e duas buscas seguidas no mesmo texto começariam
 * da metade. Cada uso ganha a sua.
 */
const variavelRe = () => /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** As variáveis citadas num texto, sem repetição e na ordem em que aparecem. */
export function variaveisDe(texto: string): string[] {
  const achadas: string[] = []
  const re = variavelRe()
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    if (achadas.indexOf(m[1]) === -1) achadas.push(m[1])
  }
  return achadas
}

/**
 * O texto com as variáveis trocadas pelos valores.
 *
 * Variável sem valor vira uma LINHA EM BRANCO (`__________`), não some e não
 * fica como `{{cpf}}`: um contrato impresso com chaves à mostra está quebrado,
 * enquanto um espaço em branco é um espaço pra preencher à mão — que é o pior
 * caso aceitável de um documento que alguém vai assinar.
 */
export function renderizar(texto: string, valores: Record<string, string>): string {
  return texto.replace(variavelRe(), (_, chave: string) => {
    const v = valores[chave]
    return typeof v === 'string' && v.trim() ? v.trim() : '__________'
  })
}

/* -------------------------------------------------------------------------- */
/* Campos                                                                      */
/* -------------------------------------------------------------------------- */

export function camposDe(campos: CampoContrato[], quem: QuemPreenche): CampoContrato[] {
  return campos.filter((c) => c.quemPreenche === quem)
}

/** Os campos obrigatórios daquele lado que ainda estão vazios. */
export function faltando(
  campos: CampoContrato[],
  valores: Record<string, string>,
  quem: QuemPreenche,
): CampoContrato[] {
  return camposDe(campos, quem).filter((c) => c.obrigatorio && !valores[c.chave]?.trim())
}

/**
 * Fica só com as chaves que AQUELE lado pode preencher, e corta o tamanho.
 *
 * É a mesma ideia de `limparRespostas` no link do questionário, e vale o mesmo
 * aviso: na rota pública esta é a ÚNICA validação que existe — regra do
 * Firestore não roda no Admin SDK.
 */
export const MAX_VALOR = 2_000

export function limparValores(
  campos: CampoContrato[],
  brutos: unknown,
  quem: QuemPreenche,
): Record<string, string> {
  const entrada = (brutos && typeof brutos === 'object' ? brutos : {}) as Record<string, unknown>
  const saida: Record<string, string> = {}
  for (const campo of camposDe(campos, quem)) {
    const v = entrada[campo.chave]
    if (typeof v !== 'string') continue
    const limpo = v.trim().slice(0, MAX_VALOR)
    if (limpo) saida[campo.chave] = limpo
  }
  return saida
}

/* -------------------------------------------------------------------------- */
/* Leitura em blocos                                                           */
/* -------------------------------------------------------------------------- */

export type BlocoContrato = { tipo: 'titulo' | 'paragrafo'; texto: string }

/**
 * Quebra o texto em blocos pra desenhar na tela e no papel.
 *
 * Título é linha inteira em MAIÚSCULAS — é como contrato se escreve, e evita
 * inventar uma sintaxe (markdown, `#`) que a cliente teria de aprender pra colar
 * o Word dela. Quem escreve o modelo escreve o contrato, não um formato.
 */
export function blocosDe(texto: string): BlocoContrato[] {
  return texto
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((bloco) => {
      const umaLinha = !bloco.includes('\n')
      const temLetra = /[a-zà-ÿ]/i.test(bloco)
      const ehTitulo = umaLinha && temLetra && bloco.length <= 120 && bloco === bloco.toUpperCase()
      return { tipo: ehTitulo ? ('titulo' as const) : ('paragrafo' as const), texto: bloco }
    })
}

/* -------------------------------------------------------------------------- */
/* Modelo de fábrica                                                           */
/* -------------------------------------------------------------------------- */

const TEXTO_EXEMPLO = `CONTRATO DE AGENCIAMENTO ARTÍSTICO

Pelo presente instrumento particular, de um lado {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, com sede em {{empresa_endereco}}, doravante denominada CONTRATADA, e de outro lado {{nome_completo}}, inscrito(a) no CPF sob o nº {{cpf}}, portador(a) do documento de identidade nº {{rg}}, residente e domiciliado(a) em {{endereco}}, artisticamente conhecido(a) como {{artista_nome}}, doravante denominado(a) CONTRATANTE, têm entre si justo e contratado o seguinte.

CLÁUSULA PRIMEIRA — DO OBJETO

A CONTRATADA prestará ao CONTRATANTE os serviços de agenciamento artístico descritos a seguir: {{objeto}}

CLÁUSULA SEGUNDA — DA VIGÊNCIA

O presente contrato vigora a partir de {{vigencia_inicio}} até {{vigencia_fim}}.

CLÁUSULA TERCEIRA — DA REMUNERAÇÃO

Pelos serviços prestados, a CONTRATADA fará jus a {{percentual}} sobre os valores líquidos efetivamente recebidos em decorrência das atividades objeto deste contrato.

Os valores devidos ao CONTRATANTE serão depositados nos seguintes dados bancários: {{dados_bancarios}}

CLÁUSULA QUARTA — DAS OBRIGAÇÕES DO CONTRATANTE

O CONTRATANTE compromete-se a prestar as informações necessárias à execução deste contrato e a comunicar à CONTRATADA qualquer proposta recebida diretamente durante a vigência.

CLÁUSULA QUINTA — DA RESCISÃO

Este contrato poderá ser rescindido por qualquer das partes, mediante comunicação escrita com antecedência mínima de 30 (trinta) dias, sem prejuízo das obrigações já assumidas.

CLÁUSULA SEXTA — DA ASSINATURA ELETRÔNICA

As partes reconhecem a validade da assinatura eletrônica aposta neste instrumento, nos termos do art. 10, § 2º, da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, e declaram aceitar o registro eletrônico de data, endereço IP e código de verificação do documento como prova da manifestação de vontade.

CLÁUSULA SÉTIMA — DO FORO

Fica eleito o foro da comarca de {{foro}} para dirimir quaisquer questões oriundas deste contrato.

E por estarem assim justas e contratadas, as partes assinam o presente instrumento em {{data_hoje}}.`

const CAMPOS_EXEMPLO: CampoContrato[] = [
  {
    chave: 'objeto',
    rotulo: 'Serviços contratados',
    formato: 'texto-longo',
    obrigatorio: true,
    quemPreenche: 'equipe',
    ajuda: 'O que a Imagine entrega neste contrato.',
  },
  {
    chave: 'nome_completo',
    rotulo: 'Nome completo',
    formato: 'texto',
    obrigatorio: true,
    quemPreenche: 'artista',
    ajuda: 'Como consta no documento de identidade.',
  },
  { chave: 'cpf', rotulo: 'CPF', formato: 'cpf', obrigatorio: true, quemPreenche: 'artista', ajuda: null },
  { chave: 'rg', rotulo: 'RG', formato: 'texto', obrigatorio: false, quemPreenche: 'artista', ajuda: null },
  {
    chave: 'endereco',
    rotulo: 'Endereço completo',
    formato: 'texto-longo',
    obrigatorio: true,
    quemPreenche: 'artista',
    ajuda: 'Rua, número, bairro, cidade e CEP.',
  },
  { chave: 'email', rotulo: 'E-mail', formato: 'email', obrigatorio: true, quemPreenche: 'artista', ajuda: null },
  {
    chave: 'telefone',
    rotulo: 'Telefone',
    formato: 'telefone',
    obrigatorio: true,
    quemPreenche: 'artista',
    ajuda: null,
  },
  {
    chave: 'dados_bancarios',
    rotulo: 'Dados bancários',
    formato: 'texto-longo',
    obrigatorio: false,
    quemPreenche: 'artista',
    ajuda: 'Banco, agência, conta e chave PIX.',
  },
]

/**
 * O modelo de fábrica.
 *
 * É um ESQUELETO de agenciamento, não o contrato da Imagine — serve pra o fluxo
 * inteiro poder ser testado e pra mostrar como um modelo se escreve. O contrato
 * de verdade chega em Word e entra por Configurações → Contratos: colar o texto
 * e declarar os campos, sem deploy.
 */
export const MODELO_EXEMPLO: ModeloContrato = {
  key: 'agenciamento-exemplo',
  nome: 'Agenciamento (modelo de exemplo)',
  tipo: 'agenciamento',
  texto: TEXTO_EXEMPLO,
  campos: CAMPOS_EXEMPLO,
}

export const CONFIG_CONTRATOS_PADRAO: ConfigContratos = {
  modelos: [MODELO_EXEMPLO],
}

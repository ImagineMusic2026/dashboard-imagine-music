/**
 * Data de nascimento do artista: o formato gravado e as contas em cima dele.
 *
 * Grava-se SEMPRE `YYYY-MM-DD` como texto — o mesmo que um <input type="date">
 * devolve e o mesmo formato de `entradaIaos`. Texto e não Timestamp porque
 * aniversário é um dia do calendário, não um instante: um Timestamp à meia-noite
 * UTC cai no dia anterior em Brasília, e o alerta chegaria um dia antes.
 *
 * Todas as contas são em horário LOCAL (meia-noite de quem está vendo). O painel
 * roda no Brasil e o alerta é derivado no navegador, então "hoje" é o hoje da
 * pessoa que abriu a tela.
 */

/**
 * Quem gravou a data no cadastro. Decide se um questionário enviado depois pode
 * sobrescrevê-la: o questionário só atualiza o que ele mesmo gravou — o que a
 * equipe digitou no cadastro fica.
 */
export type OrigemDataNascimento = 'equipe' | 'questionario'

/** Id PERMANENTE da pergunta de nascimento no questionário Artista (é a chave em `respostas`). */
export const PERGUNTA_DATA_NASCIMENTO = 'data-nascimento'

export interface DataNascimento {
  ano: number
  /** 1 a 12. */
  mes: number
  /** 1 a 31. */
  dia: number
}

const DIA_MS = 86_400_000
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/

/** O piso de `lerDataNascimento`, para o `min` dos campos de data. */
export const NASCIMENTO_MIN = '1900-01-01'

/**
 * Uma data em 'YYYY-MM-DD' pelo calendário LOCAL. Nada de `toISOString()`: ele é
 * UTC e, depois das 21h em Brasília, já devolve o dia seguinte.
 */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A data de nascimento mais recente que se aceita: um ano antes de hoje.
 *
 * Não é regra de idade mínima de artista. É o jeito de recusar o HOJE que o
 * calendário do celular já traz marcado: abrir o seletor e tocar em "Definir" sem
 * trocar o ano gravava o artista com 0 anos — e o alerta errado voltava todo ano.
 */
function limiteNascimento(hoje: Date): Date {
  const ano = hoje.getFullYear() - 1
  // Em 29/02, "um ano antes" é 28/02 — sem o teto, o Date transbordaria para 01/03
  // e aceitaria quem nasceu há 365 dias, com 0 anos.
  return new Date(ano, hoje.getMonth(), Math.min(hoje.getDate(), diasNoMes(ano, hoje.getMonth() + 1)))
}

/** A data de nascimento mais recente que `lerDataNascimento` aceita, em 'YYYY-MM-DD'. */
export function maxNascimentoISO(hoje: Date = new Date()): string {
  return isoLocal(limiteNascimento(hoje))
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

function meiaNoite(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Lê e valida uma data `YYYY-MM-DD`; qualquer outra coisa vira null.
 *
 * É a MESMA função que o servidor usa antes de gravar — o que o formulário aceita
 * e o que a rota aceita não podem divergir. Recusa data impossível (31/02),
 * anterior a 1900 e mais recente que um ano atrás (ver `limiteNascimento`): nesses
 * casos o mais provável é erro de digitação, e um aniversário errado gera alerta
 * errado todo ano.
 */
export function lerDataNascimento(v: unknown, hoje: Date = new Date()): DataNascimento | null {
  if (typeof v !== 'string') return null
  const m = FORMATO.exec(v.trim())
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null
  if (new Date(ano, mes - 1, dia).getTime() > limiteNascimento(meiaNoite(hoje)).getTime()) return null
  return { ano, mes, dia }
}

/**
 * Meia-noite do próximo aniversário a partir de `hoje` — hoje incluso.
 *
 * Quem nasceu em 29/02 faz aniversário em 28/02 nos anos que não são bissextos:
 * sem isso o alerta dele só existiria de quatro em quatro anos.
 */
export function proximoAniversario(n: DataNascimento, hoje: Date = new Date()): Date {
  const base = meiaNoite(hoje)
  const noAno = (ano: number) => new Date(ano, n.mes - 1, Math.min(n.dia, diasNoMes(ano, n.mes)))
  const esteAno = noAno(base.getFullYear())
  return esteAno.getTime() >= base.getTime() ? esteAno : noAno(base.getFullYear() + 1)
}

/** Dias inteiros entre hoje e a data (0 = hoje). Arredonda pra atravessar horário de verão. */
export function diasAte(alvo: Date, hoje: Date = new Date()): number {
  return Math.round((meiaNoite(alvo).getTime() - meiaNoite(hoje).getTime()) / DIA_MS)
}

/** Idade que a pessoa tem na data informada. */
export function idadeEm(n: DataNascimento, data: Date = new Date()): number {
  const mes = data.getMonth() + 1
  const fezNoAno = mes > n.mes || (mes === n.mes && data.getDate() >= n.dia)
  return data.getFullYear() - n.ano - (fezNoAno ? 0 : 1)
}

/** "15/11" — o aniversário sem o ano. */
export function diaEMes(n: DataNascimento): string {
  return `${String(n.dia).padStart(2, '0')}/${String(n.mes).padStart(2, '0')}`
}

/** "15/11/1990" — a data inteira, como a equipe escreve. */
export function dataNascimentoPorExtenso(n: DataNascimento): string {
  return `${diaEMes(n)}/${n.ano}`
}

/** A partir de quantos dias antes o aniversário aparece (alerta e Home). */
export const JANELA_ANIVERSARIO_DIAS = 7

export interface AniversarioProximo {
  slug: string
  nome: string
  /** Meia-noite do dia em que se comemora (28/02 para quem nasceu em 29/02 em ano comum). */
  data: Date
  /** 0 = hoje. */
  dias: number
  /** A idade que a pessoa FAZ nesse dia. */
  idade: number
}

/**
 * Quem faz aniversário de hoje até `janela` dias, do mais próximo ao mais longe.
 * Fonte única do alerta e do aviso da Home — os dois não podem discordar.
 *
 * A idade é a que a pessoa faz no dia, e não `idadeEm`: em 28/02, quem nasceu em
 * 29/02 ainda "não fez" pela conta do calendário, mas é o dia da festa.
 */
export function aniversariosProximos(
  artistas: { slug: string; nome: string; dataNascimento?: string | null }[],
  hoje: Date = new Date(),
  janela: number = JANELA_ANIVERSARIO_DIAS,
): AniversarioProximo[] {
  const out: AniversarioProximo[] = []
  for (const a of artistas) {
    const n = lerDataNascimento(a.dataNascimento, hoje)
    if (!n) continue
    const data = proximoAniversario(n, hoje)
    const dias = diasAte(data, hoje)
    if (dias <= janela) out.push({ slug: a.slug, nome: a.nome, data, dias, idade: data.getFullYear() - n.ano })
  }
  return out.sort((x, y) => x.dias - y.dias || x.nome.localeCompare(y.nome, 'pt-BR'))
}

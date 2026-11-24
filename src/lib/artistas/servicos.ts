/**
 * Os serviços que o selo presta — espelha o card de estruturação do Pipefy.
 *
 * Mora numa lib, e não no formulário onde é marcado, porque a lista de artistas
 * também precisa dela (coluna e filtro de Serviços) e não deveria importar um
 * módulo de campos de formulário só por uma constante.
 *
 * ## O catálogo deixou de ser fixo (pedido da cliente em 11/2026)
 *
 * Até 11/2026 a lista aqui era A lista, e serviço fora dela era digitado dentro
 * do cadastro de UM artista — o que criava um serviço que não existia para
 * marcar em nenhum outro. Agora o catálogo vive em `configuracoes/artistas`
 * (ver `@/lib/artistas/config`) e só o admin o edita; o que está aqui é o
 * padrão de fábrica e a rede de segurança para quando aquele documento não
 * existe ou vem quebrado.
 *
 * A ordem importa: é a ordem dos quadradinhos na coluna da lista, então um
 * artista com "Tráfego Pago" acende sempre a mesma posição. Acrescentar no FIM
 * é seguro; reordenar muda o que cada posição significa.
 */

/**
 * Um serviço do catálogo.
 *
 * A `chave` nasce do nome e NUNCA é recalculada. É ela que o artista grava em
 * `projetos/{slug}.servicosPrevistos`, e é ela que casa o gravado com o
 * catálogo — a mesma escolha das colunas do quadro de atividades, onde a
 * demanda guarda a `key` da etapa e o rótulo vem da configuração. Por isso
 * renomear um serviço troca o rótulo na tela sem soltar ninguém.
 *
 * ⚠️ Antes de 11/2026 o que se gravava era o NOME, e até 24/11/2026 o
 * formulário novo continuou gravando nome. Os dois formatos convivem sem
 * migração: `servicoChave` é idempotente sobre uma chave ("selo digital" →
 * "selo digital") e devolve a mesma chave a partir do nome antigo ("Selo
 * digital" → "selo digital"). Quem exibe sempre passa pelo catálogo.
 */
export interface ServicoPrevisto {
  chave: string
  nome: string
}

const NOMES_PADRAO = [
  'Estruturação estratégica',
  'Assessoria de Marketing',
  'Tráfego Pago',
  'Selo digital',
  'Produção de Vídeo',
]

function limparNomeServico(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ')
}

export function servicoChave(nome: string): string {
  return limparNomeServico(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Catálogo de fábrica — vale enquanto nenhum admin salvar o dele. */
export const SERVICOS_PADRAO: ServicoPrevisto[] = NOMES_PADRAO.map((nome) => ({
  chave: servicoChave(nome),
  nome,
}))

/**
 * Os serviços GRAVADOS num artista: limpa, tira repetido (por chave) e descarta
 * o que não é texto.
 *
 * Não canoniza o texto. Fazia isso enquanto o catálogo era uma constante — com
 * um catálogo editável, canonizar aqui significaria o servidor precisar lê-lo a
 * cada gravação. Quem decide o RÓTULO é o catálogo, na hora de mostrar (ver
 * `nomeDoServico`); o que fica gravado é a chave do serviço (ou, em cadastro
 * antigo, o nome que valia na época — os dois casam pela mesma chave).
 */
export function normalizarServicosPrevistos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []

  const nomes = new Map<string, string>()
  for (const item of valor) {
    if (typeof item !== 'string') continue
    const nome = limparNomeServico(item)
    const chave = servicoChave(nome)
    if (chave && !nomes.has(chave)) nomes.set(chave, nome)
  }
  return Array.from(nomes.values())
}

/** Conserta o catálogo vindo do banco; lista quebrada cai no padrão de fábrica. */
export function normalizarCatalogoServicos(valor: unknown): ServicoPrevisto[] {
  if (!Array.isArray(valor)) return SERVICOS_PADRAO

  const porChave = new Map<string, ServicoPrevisto>()
  for (const item of valor) {
    // Aceita tanto o formato novo ({chave, nome}) quanto uma lista de nomes —
    // é o que um documento gravado à mão ou um backup antigo teriam.
    const nome = limparNomeServico(
      typeof item === 'string'
        ? item
        : typeof (item as { nome?: unknown })?.nome === 'string'
          ? ((item as { nome: string }).nome ?? '')
          : '',
    )
    if (!nome) continue
    const bruta = typeof (item as { chave?: unknown })?.chave === 'string' ? (item as { chave: string }).chave : ''
    const chave = servicoChave(bruta) || servicoChave(nome)
    if (!chave || porChave.has(chave)) continue
    porChave.set(chave, { chave, nome })
  }
  return Array.from(porChave.values())
}

/** O catálogo indexado pela chave — o que todo casamento com dado gravado usa. */
export function catalogoPorChave(catalogo: ServicoPrevisto[]): Map<string, ServicoPrevisto> {
  return new Map(catalogo.map((s) => [s.chave, s]))
}

/**
 * O nome de EXIBIÇÃO de um serviço gravado: o rótulo atual do catálogo quando a
 * chave casa, senão o que está gravado.
 *
 * É o que faz renomear um serviço na configuração aparecer em todo artista que
 * já o tinha, sem tocar em nenhum documento de `projetos`.
 */
export function nomeDoServico(gravado: string, porChave: Map<string, ServicoPrevisto>): string {
  return porChave.get(servicoChave(gravado))?.nome ?? limparNomeServico(gravado)
}

/**
 * Separa o que está gravado num artista entre as chaves do catálogo e o que
 * ficou de FORA dele.
 *
 * O "fora do catálogo" existe por causa do histórico: até 11/2026 cada cadastro
 * podia inventar um serviço, e apagá-lo em silêncio ao abrir o formulário seria
 * perder informação que alguém digitou. Ele aparece marcado, com aviso, e sai
 * no clique de quem decidir que não vale mais.
 */
export function separarServicos(
  gravados: string[],
  catalogo: ServicoPrevisto[],
): { chaves: string[]; foraDoCatalogo: string[] } {
  const porChave = catalogoPorChave(catalogo)
  const chaves: string[] = []
  const foraDoCatalogo: string[] = []
  for (const nome of normalizarServicosPrevistos(gravados)) {
    const chave = servicoChave(nome)
    if (porChave.has(chave)) chaves.push(chave)
    else foraDoCatalogo.push(nome)
  }
  return { chaves, foraDoCatalogo }
}

/**
 * Nome curto pro que não cabe numa coluna de tabela.
 *
 * Só encurta o que precisa: o resto aparece como está cadastrado, e um serviço
 * novo que ninguém mapeou aqui continua legível em vez de virar reticências.
 */
export const SERVICO_CURTO: Record<string, string> = {
  'Estruturação estratégica': 'Estratégia',
  'Assessoria de Marketing': 'Marketing',
  'Tráfego Pago': 'Tráfego',
  'Selo digital': 'Selo',
  'Produção de Vídeo': 'Vídeo',
}

export function servicoCurto(nome: string): string {
  return Object.hasOwn(SERVICO_CURTO, nome) ? SERVICO_CURTO[nome] : nome
}

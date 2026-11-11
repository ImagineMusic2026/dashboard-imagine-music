import type { AlertaDerivado, SeveridadeAlerta } from '@/lib/alertas/derivar'

/**
 * Alertas marcados como VISTOS — por pessoa, num documento próprio
 * (`alertas-vistos/{uid}` = { vistos: { chave: ms } }). Leitura e gravação moram
 * em `@/lib/alertas/client`; aqui fica só a regra.
 *
 * Custo: uma leitura por pessoa a cada carregamento de página, e cada marca (ou
 * manutenção) é uma transação — a leitura do doc e a gravação, mais as do perfil
 * que a regra `isStaff()` consulta. Não é campo do perfil porque o perfil é lido
 * pela equipe inteira e só aceita auto-edição de `favoritos` (a trava da escalada).
 *
 * O problema todo é decidir quando um alerta visto é "o mesmo" alerta. Alertas não
 * têm coleção: são recalculados a cada carregamento, e o id sozinho não basta. Há
 * três tipos de chave, e o separador diz qual é:
 *
 * - **Evento** (`id@ts`): conteúdo viralizando, destaque, marco, questionário
 *   enviado, aniversário, sem postar. A data só muda quando acontece OUTRO evento
 *   (a publicação, o envio, o último post) — reenviar o questionário é coisa nova.
 * - **Medição contínua** (`id#severidade`): seguidores, streaming, perfil
 *   incompleto. Recalculados a cada sync com data nova sem nada novo ter
 *   acontecido; chaveados por data, voltariam todo dia. Uma marca cobre a mesma
 *   severidade e as MENORES: a queda marcada como crítica que melhora para atenção
 *   continua escondida; a marcada em atenção que piora para crítico volta.
 * - **Estado de integração** (`id~ts`): falha ou parada de sync. A data é a do
 *   último sync que deu certo, fixa durante o episódio — a fonte que volta e cai de
 *   novo depois de um sync bom é episódio novo.
 *
 * O `ms` guardado é quando a pessoa marcou. Nas medições contínuas que saíram da
 * lista ele vira NEGATIVO: `-ms` de quando a ausência foi vista pela primeira vez
 * (ver `manterVistos`). As regras não conferem valores e `foiVisto` só olha se a
 * chave existe, então o sinal é só bookkeeping da carência.
 */

export type MapaVistos = Record<string, number>

/** Categorias recalculadas a cada sync com data nova sem que haja um evento novo. */
const CONTINUAS = new Set([
  'crescimento_seguidores',
  'queda_seguidores',
  'viralizacao_streaming',
  'queda_streaming',
  'perfil_incompleto',
])

/** Estado de uma integração, separado por episódio. */
const ESTADOS = new Set(['sync_falhou', 'sync_parado'])

/** Gravidade para a cobertura das contínuas: a marca cobre a mesma e as menores. */
const PESO: Record<SeveridadeAlerta, number> = { critico: 3, atencao: 2, oportunidade: 1, operacional: 0 }
const SEVERIDADES = Object.keys(PESO) as SeveridadeAlerta[]

/**
 * Teto de marcas guardadas. As regras do Firestore recusam acima disso; a
 * manutenção mantém o mapa bem abaixo.
 */
export const MAX_VISTOS = 500

const HORA = 3_600_000
/** Evento fora da lista perde a marca depois disto (a data na chave já o distingue de um novo). */
const IDADE_MAX_EVENTO = 30 * 24 * HORA
/**
 * Medição contínua fora da lista perde a marca depois disto, contado da PRIMEIRA
 * ausência que a pessoa viu. Não na primeira ausência: um "Sincronizar agora" no
 * meio do dia encurta a janela de comparação e a medição some por algumas horas sem
 * a situação ter passado — e uma queda que oscila em volta do limite some num dia e
 * volta no outro. Mais de um ciclo de sync fora da lista, aí sim passou.
 *
 * Conta da ausência vista, e não do último carregamento com o alerta presente: quem
 * só abre o painel em dia útil voltaria na segunda com a marca de sexta "vencida" e
 * a perderia na primeira ausência — justo o que a carência existe para evitar.
 */
const CARENCIA_CONTINUA = 36 * HORA

type TipoChave = 'evento' | 'continua' | 'estado'

function tipoDaChave(chave: string): TipoChave {
  const m = /([@#~])[^@#~]*$/.exec(chave)
  return m?.[1] === '#' ? 'continua' : m?.[1] === '~' ? 'estado' : 'evento'
}

/** A identidade de um alerta para fins de "visto" — a chave que marcar grava. */
export function chaveVisto(a: Pick<AlertaDerivado, 'id' | 'categoria' | 'ts' | 'severidade'>): string {
  if (CONTINUAS.has(a.categoria)) return `${a.id}#${a.severidade}`
  if (ESTADOS.has(a.categoria)) return `${a.id}~${a.ts}`
  return `${a.id}@${a.ts}`
}

/**
 * Todas as chaves que escondem este alerta. Para quase todos é só `chaveVisto`; nas
 * contínuas, também a marca de qualquer severidade MAIOR. Desmarcar tem de apagar
 * todas, senão o alerta seguiria escondido por uma marca mais grave.
 */
export function chavesQueCobrem(a: Pick<AlertaDerivado, 'id' | 'categoria' | 'ts' | 'severidade'>): string[] {
  if (!CONTINUAS.has(a.categoria)) return [chaveVisto(a)]
  return SEVERIDADES.filter((s) => PESO[s] >= PESO[a.severidade]).map((s) => `${a.id}#${s}`)
}

export function foiVisto(a: AlertaDerivado, vistos: MapaVistos): boolean {
  return chavesQueCobrem(a).some((c) => c in vistos)
}

/** Separa os alertas em abertos e vistos, preservando a ordem. */
export function separarVistos<T extends AlertaDerivado>(
  alertas: T[],
  vistos: MapaVistos,
): { abertos: T[]; vistos: T[] } {
  const abertos: T[] = []
  const jaVistos: T[] = []
  for (const a of alertas) (foiVisto(a, vistos) ? jaVistos : abertos).push(a)
  return { abertos, vistos: jaVistos }
}

/** Remove os alertas vistos. */
export function semVistos<T extends AlertaDerivado>(alertas: T[], vistos: MapaVistos): T[] {
  return separarVistos(alertas, vistos).abertos
}

/**
 * Faxina do mapa a cada lista COMPLETA de alertas. Devolve null quando não há o que
 * mudar — quem chama usa isso para não gravar à toa.
 *
 * - Evento: sai depois de 30 dias fora da lista. Um conteúdo bombando oscila em
 *   volta do piso de um dia pro outro; apagar a marca na primeira ausência o faria
 *   voltar como novo no dia seguinte, com a mesma chave já reconhecida.
 * - Estado de integração: sai na primeira ausência — a fonte voltou ao normal.
 * - Medição contínua: na primeira ausência vista, a marca passa a guardar `-agora`;
 *   sai quando a ausência passa de 36 horas (ver `CARENCIA_CONTINUA`). Se o alerta
 *   volta antes disso, a marca volta a positivo e continua escondendo. Só grava nas
 *   transições — alerta presente com marca positiva não gera escrita nenhuma.
 *
 * Só pode ser chamada com a lista COMPLETA: se uma fonte falhou e os alertas dela
 * não vieram, a faxina apagaria as marcas deles e tudo voltaria a aparecer.
 */
export function manterVistos(vistos: MapaVistos, todos: AlertaDerivado[], agora = Date.now()): MapaVistos | null {
  const vigentes = new Set(todos.flatMap(chavesQueCobrem))
  const proximo: MapaVistos = {}
  let mudou = false
  for (const [chave, em] of Object.entries(vistos)) {
    const presente = vigentes.has(chave)
    const tipo = tipoDaChave(chave)
    if (tipo === 'continua') {
      if (presente) {
        // Voltou à lista dentro da carência: a marca volta a valer por inteiro.
        proximo[chave] = em < 0 ? agora : em
        if (em < 0) mudou = true
      } else if (em >= 0) {
        // Primeira ausência vista: começa a contar a carência agora.
        proximo[chave] = -agora
        mudou = true
      } else if (agora + em <= CARENCIA_CONTINUA) {
        proximo[chave] = em
      } else mudou = true
    } else if (presente || (tipo === 'evento' && agora - em <= IDADE_MAX_EVENTO)) {
      proximo[chave] = em
    } else mudou = true
  }
  return mudou ? proximo : null
}

/**
 * Acrescenta marcas. Se estourar o teto, descarta as mais antigas — perder a
 * marca de um alerta velho é melhor que a gravação inteira ser recusada.
 */
export function comVistos(vistos: MapaVistos, chaves: string[], agora = Date.now()): MapaVistos {
  const proximo: MapaVistos = { ...vistos }
  for (const c of chaves) proximo[c] = agora
  const entradas = Object.entries(proximo)
  if (entradas.length <= MAX_VISTOS) return proximo
  return Object.fromEntries(entradas.sort((a, b) => b[1] - a[1]).slice(0, MAX_VISTOS))
}

/** Tira as marcas. Devolve null se nenhuma delas existia (nada a gravar). */
export function semMarcas(vistos: MapaVistos, chaves: string[]): MapaVistos | null {
  if (!chaves.some((c) => c in vistos)) return null
  const proximo: MapaVistos = { ...vistos }
  for (const c of chaves) delete proximo[c]
  return proximo
}

/** Lê o mapa gravado sem confiar no formato: qualquer lixo vira mapa vazio. */
export function normalizarVistos(v: unknown): MapaVistos {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const saida: MapaVistos = {}
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n)) saida[k] = n
  }
  return saida
}

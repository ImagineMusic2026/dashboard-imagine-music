/**
 * Os serviços que o selo presta — espelha o card de estruturação do Pipefy.
 *
 * Mora numa lib, e não no formulário onde é editado, porque a lista de artistas
 * também precisa dela (coluna e filtro de Serviços) e não deveria importar um
 * módulo de campos de formulário só por uma constante.
 *
 * A ordem importa: é a ordem dos quadradinhos na coluna da lista, então um
 * artista com "Tráfego Pago" acende sempre a mesma posição. Acrescentar no FIM
 * é seguro; reordenar muda o que cada posição significa.
 */
export const SERVICOS_PREVISTOS = [
  'Estruturação estratégica',
  'Assessoria de Marketing',
  'Tráfego Pago',
  'Selo digital',
  'Produção de Vídeo',
]

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
  return SERVICO_CURTO[nome] ?? nome
}

/**
 * Dados oficiais da Imagine Music.
 *
 * Os mesmos aparecem nos Termos de Uso, na Política de Privacidade e no
 * cabeçalho do contrato emitido pelo painel. Estavam duplicados em
 * `app/termos/page.tsx` e `app/privacidade/page.tsx`, cada página com a sua
 * cópia — e o contrato seria a terceira. Razão social ou CNPJ divergente num
 * contrato não é detalhe de layout: é defeito no documento assinado.
 *
 * As datas de "última atualização" e o prazo de retenção continuam em cada
 * página: são fatos do TEXTO legal daquela página, não da empresa.
 */
export const EMPRESA = {
  /** Nome fantasia / marca. */
  marca: 'Imagine Music',
  razaoSocial: 'IMAGINE MUSIC LTDA',
  cnpj: '36.435.325/0001-44',
  endereco:
    'Rua Barão de Cotegipe, nº 927, Sala 102, 1º andar, Centro, Feira de Santana/BA, Brasil',
  /** E-mail oficial de contato e de privacidade. */
  email: 'music@imaginegroup.com.br',
  foro: 'Feira de Santana, BA',
} as const

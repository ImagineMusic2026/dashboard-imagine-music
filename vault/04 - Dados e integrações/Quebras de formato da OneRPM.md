---
tipo: operacao
plataforma: OneRPM
---

# Quebras de formato da OneRPM

A OneRPM reenvia arquivos quando o catálogo ou o período muda, e o formato **não é estável entre envios**. Já aconteceu duas vezes, em arquivos diferentes, e nas duas o painel quebrou de um jeito que não parecia problema de formato. Esta nota existe para que a terceira vez seja diagnosticada em minutos.

## O que já quebrou

### Janeiro de 2026 — colunas deslocadas no relatório de receita

O relatório mensal passou a declarar duas colunas que as linhas não preenchiam. Tudo o que vinha depois delas escorregou uma posição, e o painel passou a ler moeda no lugar de valor.

**Como apareceu:** a importação falhava com erro de tamanho de envio e a receita saía zerada. Nada no erro mencionava coluna.

**Como foi resolvido:** a leitura passou a realinhar as colunas antes de calcular, em vez de confiar na posição declarada no cabeçalho.

### Setembro de 2026 — cabeçalho do catálogo em outra grafia

O catálogo de julho vinha com os nomes de coluna em minúsculas e sublinhado. O de setembro veio com maiúsculas e espaço, descrevendo exatamente os mesmos campos.

**Como apareceu:** a importação abortava dizendo que a coluna não existia, citando um nome que estava visivelmente no arquivo.

**Como foi resolvido:** os nomes de coluna passam por uma normalização antes da busca, de modo que as duas grafias apontem para o mesmo campo.

## O padrão

As duas quebras têm a mesma forma: **o conteúdo continuou correto e só a embalagem mudou**, mas o sintoma apareceu longe da causa. Um virou erro de tamanho, o outro virou coluna inexistente. Em nenhum dos dois o alerta dizia "o formato mudou".

Daí a regra que ficou: quando uma importação da OneRPM falhar de um jeito estranho, **conferir o cabeçalho do arquivo novo contra o anterior antes de investigar qualquer outra coisa**. É mais rápido e, até aqui, sempre foi isso.

## Como o painel se protege hoje

- Os nomes de coluna são normalizados antes de serem procurados, então diferença de caixa ou de separador não quebra mais nada.
- A leitura de receita realinha as colunas em vez de confiar na ordem declarada.
- Linhas sem identificador de faixa são ignoradas em silêncio, porque nunca casam com o feed de streaming.
- O mesmo identificador pode repetir em álbuns diferentes; a importação consolida e prefere a linha completa.
- A importação é repetível: rodar de novo com um arquivo novo não duplica nem apaga o que já existe.

## O que ainda depende deles

O catálogo continua chegando por e-mail, sob demanda. Eles se dispuseram a avaliar um envio automático se a necessidade virar frequente — vale retomar essa conversa se o reenvio manual começar a atrasar diagnóstico.

Veja [[04 - Dados e integrações/OneRPM]] e [[05 - Fluxos/Importação de dados - detalhada]].

---
tipo: integracao
plataforma: OneRPM
---

# OneRPM

## Papel no painel

Importa e organiza dados de distribuição para exibir catálogo, receitas e tendências relacionadas aos artistas.

## Fluxo atual

1. A equipe importa um relatório.
2. O arquivo é interpretado no navegador, incluindo uma etapa de validação.
3. O painel envia e persiste dados agregados, não a planilha inteira.
4. Os dados são exibidos na área e no perfil de cada artista.

## Catálogo: quem é dono de qual faixa

A Imagine opera **três contas de selo** na OneRPM, e cada uma exporta o seu catálogo. Desde 09/09/2026 as três estão importadas, o que fechou uma lacuna antiga: havia faixas com movimento real de streaming que o painel contava sem saber de quem eram, porque o catálogo antigo estava incompleto.

Duas coisas que ficaram claras e evitam retrabalho:

- **Subcontas não precisam de feed próprio.** O streaming das subcontas já chega pelo feed da conta principal. O que faltava era só o catálogo para dar nome às faixas.
- **Contas irmãs precisam.** As outras duas contas de selo são feeds separados de verdade, e as credenciais delas ainda não chegaram. Enquanto isso, as faixas dessas contas aparecem com nome e **sem nenhum streaming** — o que é esperado, não é defeito. Cada faixa guarda de qual conta veio, justamente para essa pergunta ter resposta.

## Cuidados conhecidos

- Alguns relatórios declaram `Creations` e `Views`, mas as linhas podem não conter esses valores.
- A leitura precisa realinhar as colunas antes de calcular receita; caso contrário, moeda, bruto e líquido podem ficar deslocados.
- O envio deve priorizar os dados agregados para reduzir o tamanho da importação.
- **O formato dos arquivos muda entre envios.** Já quebrou duas vezes, sempre com sintoma enganoso — o histórico e o que fazer estão em [[04 - Dados e integrações/Quebras de formato da OneRPM]].
- Faixas exportadas sem identificador não casam com o streaming e são ignoradas. Parte é lançamento futuro, mas há álbuns antigos e distribuídos no meio, o que é falha do export e foi cobrado.

Veja: [[03 - Artistas/Gestão de artistas]] e [[05 - Fluxos/Importação de dados]].

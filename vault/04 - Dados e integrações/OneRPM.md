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

## Cuidados conhecidos

- Alguns relatórios declaram `Creations` e `Views`, mas as linhas podem não conter esses valores.
- A leitura precisa realinhar as colunas antes de calcular receita; caso contrário, moeda, bruto e líquido podem ficar deslocados.
- O envio deve priorizar os dados agregados para reduzir o tamanho da importação.

Veja: [[03 - Artistas/Gestão de artistas]] e [[05 - Fluxos/Importação de dados]].

---
tipo: fluxo
---

# Importação de dados — detalhada

## Receita OneRPM

1. Pessoa com `importar` seleciona uma planilha `.xlsx` ou `.xls` de receita OneRPM.
2. O painel valida e interpreta os dados no navegador.
3. A API recebe no máximo 25 MB, agrega por artista/período e grava receita, histórico de importação e atualizações necessárias no cadastro.
4. Reimportar o mesmo artista e período sobrescreve o registro anterior, sem duplicar.

### Regras de qualidade

- Colunas declaradas no cabeçalho podem estar ausentes nas linhas. O parser precisa realinhar valores antes de interpretar Currency, Gross e Net.
- A configuração atual exibe receita líquida como base; câmbios de USD e EUR são parâmetros a validar com o negócio.

## Roster

1. A equipe envia uma planilha XLSX de artistas e redes sociais.
2. O painel analisa, mostra uma revisão e confirma em lote.
3. Os artistas são atualizados por slug e a importação ganha registro de auditoria.

## Streaming

Não usa upload manual: vem da sincronização OneRPM por SFTP. Veja [[04 - Dados e integrações/OneRPM]] e [[04 - Dados e integrações/Dados de streaming e receita]].

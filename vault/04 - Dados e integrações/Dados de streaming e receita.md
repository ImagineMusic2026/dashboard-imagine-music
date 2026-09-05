---
tipo: conceito
---

# Dados de streaming e receita

Streaming e receita são dados diferentes e têm origem e permissão distintas.

| Tema | Streaming | Receita |
| --- | --- | --- |
| O que mede | Consumo: plays e skips. | Monetização: bruto, líquido e valores. |
| Origem | Feed diário OneRPM por SFTP. | Planilha mensal OneRPM XLSX. |
| Granularidade | Dia, loja, país e ISRC. | Período, plataforma, faixa e território. |
| Acesso | Equipe e artista vinculado. | Apenas quem tem `verReceita`. |
| Uso | Perfil, Health Score e alertas. | Perfil financeiro e relatórios. |

O Spotify não é conectado diretamente: seus streams e receita entram pela OneRPM. Veja [[04 - Dados e integrações/OneRPM]] e [[06 - Tecnologia/Modelo de dados Firestore]].

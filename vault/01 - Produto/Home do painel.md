---
tipo: tela
rota: /home
publico: equipe
---

# Home do painel

É a leitura executiva do portfólio: mostra a temperatura do selo antes de entrar em um artista específico.

## Blocos exibidos

- **Saúde do portfólio:** média do [[03 - Artistas/Health Score|Health Score]] dos artistas avaliados, distribuição entre excelente, saudável, atenção e crítico, e composição média dos cinco pilares.
- **KPIs:** números-resumo do conjunto de artistas.
- **Aniversários da semana:** logo abaixo da saudação, só quando algum artista faz aniversário nos próximos 7 dias, com link para o perfil. Aparece mesmo que o alerta de aniversário já tenha sido marcado como visto — a cliente pediu o aviso na página inicial, e ele não pode depender de não haver críticos na frente.
- **Alertas recentes:** os cinco mais relevantes, da mesma fonte do sino e já sem os que a pessoa marcou como vistos. Dá para marcar como visto dali mesmo.
- **Destaques de streaming:** artistas que se destacam no consumo.

## Leitura correta

- A média considera somente artistas com dados suficientes para serem avaliados.
- A distribuição revela se o problema é pontual ou de portfólio.
- Um alerta operacional representa o estado de uma integração; não pertence a um artista.
- O número de alertas da Home é o mesmo do sino: os dois descontam os vistos e as categorias silenciadas.

## Relações

- [[01 - Produto/Alertas]]
- [[03 - Artistas/Health Score]]
- [[04 - Dados e integrações/OneRPM]]
- [[06 - Tecnologia/Coletas e jobs diários]]

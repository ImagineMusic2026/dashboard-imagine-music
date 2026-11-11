---
tipo: tela-e-regra
rota: /alertas
---

# Alertas

Alertas são derivados automaticamente das métricas atuais, do cadastro dos artistas e dos questionários. Não são tarefas preenchidas manualmente e não formam uma coleção própria no banco — o que fica no banco é só a marca de "visto" de cada pessoa.

## Severidades

| Severidade | Exemplos |
| --- | --- |
| Crítico | Queda forte de seguidores (a partir de -2%) ou de streaming (60% ou mais na semana). |
| Atenção | Sem postar entre 7 e 21 dias; queda leve de seguidores (a partir de -0,5%) ou streaming entre 40% e 60%; artista criado pela importação ainda sem redes. |
| Oportunidade | Conteúdo viral, post em destaque, marco de seguidores, crescimento a partir de +1% ou streaming +50% na semana; questionário respondido pelo artista; aniversário do artista. |
| Operacional | Integração falhou ou está há 48h ou mais sem sincronizar. |

## Como funciona

- A lista é ordenada por severidade e depois por recência.
- Página, sino, badge do menu e Home usam a mesma fonte de dados. Até 11/2026 a Home montava uma lista própria, sem cadastro nem questionário, e o número dela não batia com o do sino.
- Categorias pessoais podem ser silenciadas em Configurações; a preferência fica somente no navegador atual.
- Alertas operacionais, de cadastro e de questionário não podem ser silenciados.

## Marcar como visto

Pedido da cliente em 11/2026: alerta já visto tem de sair da frente. Cada alerta tem o botão **Visto** (na página e na Home); a página tem **Marcar todos como vistos**, que respeita o filtro de severidade aberto, e a lista **Vistos**, onde **Desmarcar** devolve o alerta — marcar errado tem volta.

- O visto é **pessoal** e vale em qualquer navegador: fica no banco, um documento por pessoa. Ninguém vê o visto dos outros, nem o admin.
- Some do sino, do badge, da página e da Home **enquanto a situação durar**. Medições recalculadas a cada sincronização (seguidores, streaming) e o perfil incompleto ficam escondidos até passar. Uma queda marcada em atenção que **piora** para crítico volta a aparecer; a marcada como crítica que melhora para atenção continua escondida. Evento novo volta sempre: questionário reenviado, outro conteúdo viralizando, outro marco, ou uma integração que voltou a sincronizar e caiu de novo.
- Quando a situação passa, a marca é apagada e uma repetição futura aparece como nova. Medição só conta como "passou" depois de mais de 36 horas fora da lista: um "Sincronizar agora" no meio do dia encurta a comparação e a medição some por algumas horas sem nada ter mudado. A marca de um evento fica 30 dias — um conteúdo que oscila em volta do limite de "bombando" não volta como novo no dia seguinte.
- Sino, badge, Home e página contam a **mesma lista**, carregada uma vez ao abrir o painel. Quando alguém grava algo pelo painel ela fica marcada como desatualizada e é relida ao abrir a Home ou a página de Alertas; a página de Alertas também relê se a lista tiver mais de 5 minutos, e uma aba esquecida por mais de uma hora relê ao voltar.
- O aviso de aniversário da semana e o do dia são alertas separados: marcar o primeiro não esconde o segundo.

## Categorias derivadas

Viralização, destaque, sem postar, crescimento/queda de seguidores, marco de seguidores, viralização/queda de streaming, saúde das integrações, perfil incompleto (criado pela importação), questionário respondido e aniversário do artista.

## Aniversário

Sai da data de nascimento do cadastro (ver [[03 - Artistas/Diagnósticos e questionários]]): um aviso a partir de 7 dias antes ("Aniversário em 4 dias — domingo, 15/11 (36 anos)") e outro no dia. Quem nasceu em 29/02 comemora em 28/02 nos anos comuns. A Home também mostra os aniversários da semana, independentemente do alerta.

Veja [[06 - Tecnologia/Coletas e jobs diários]] e [[03 - Artistas/Health Score]].

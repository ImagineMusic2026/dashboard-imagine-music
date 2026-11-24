---
tipo: tela
rota: /agenda
---

# Agenda

Guarda eventos da equipe relacionados ou não a um artista.

## Evento

| Campo | Uso |
| --- | --- |
| Tipo | `release`, `show`, `contrato` ou `reuniao`. |
| Título | Nome do compromisso. |
| Data | Quando ele acontece. |
| Descrição | Opcional. |
| Artista | Opcional; conecta o evento ao roster. |

## No calendário de Atividades

Pedido da cliente em 11/2026. A equipe vinha criando demanda de lançamento no quadro só para marcar a data — e uma demanda carrega etapa, responsável, prazo e carga de time que ninguém ia preencher. O lugar dessa data é aqui; o que faltava era ela aparecer onde o mês é olhado.

Agora o evento aparece também na visão **Calendário** das Atividades, em **azul**, junto das demandas. A cor diz, antes de ler, que aquilo não é trabalho na mão de ninguém. Ali o evento:

- **arrasta** para outro dia, como o card de demanda — muda só a data dele, numa escrita, sem cascata (evento não tem janela nem sucessora);
- **abre para edição** no clique, no mesmo formulário desta tela, com excluir ao lado de salvar;
- nasce ali também, pelo botão **Novo evento** do calendário, já com o dia do mês que está na tela (hoje, quando o mês exibido é o corrente). Ao salvar, o calendário pula para o mês do evento — sem isso, criar um evento olhando outro mês não mudava nada na tela e a pessoa repetia, duplicando.

O recorte que vale para ele é o de **artista** e o da **busca**. Responsável, área, tipo, prioridade e etiqueta são campos de demanda, e sumir com a data do lançamento por causa deles seria o contrário do pedido.

A leitura da coleção é cacheada e compartilhada pelas duas telas: trocar da Agenda para o calendário não paga a coleção de novo, e toda escrita da agenda invalida o cache na hora — **inclusive a que falha**, porque quem trata o erro relê para se corrigir e o cache velho faria a tela mentir. No calendário ela só é pedida quando aquela visão abre.

## Regra de acesso

Quem possui a capacidade **agenda** pode criar, editar e excluir eventos. Por padrão, admin e marketing a possuem; artista não.

O CRUD é feito diretamente no Firestore, respeitando as regras de segurança. Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

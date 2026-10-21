---
tipo: tela
rota: /atividades
---

# Atividades

O fluxo de atendimento da equipe: do pedido à entrega, com cronograma, responsáveis e prazos. É dado **manual** — nada aqui vem de sincronização.

A tela é configurável: as colunas, o vocabulário, os campos e os modelos de projeto são definidos em **Configurações › Quadro de atividades** (só admin).

## Visões

Todas leem a **mesma** coleção e o mesmo recorte de filtros. Trocar de visão não custa leitura nova.

| Visão | Responde |
| --- | --- |
| Quadro | Em que etapa cada demanda está. Kanban, arrastar entre colunas, raias por artista/responsável/área, limite de WIP por coluna. |
| Cronograma | Quando cada coisa acontece. Barras de início a prazo, dependências entre demandas, marcos, caminho crítico, arrastar para reprogramar. |
| Lista | Muita demanda de uma vez, ordenável por prazo, prioridade, progresso ou responsável. |
| Calendário | O que vence no mês, pela data de entrega. |
| Carga do time | Quanto cada pessoa está segurando, em pontos de esforço, mais o tempo médio por etapa. |

## Demanda

| Campo | Uso |
| --- | --- |
| Título | O que precisa ser feito. |
| Etapa | Coluna do fluxo. As colunas são configuráveis; a marcada como **entrega** carimba a conclusão. |
| Prioridade | Baixa, Média, Alta, Urgente. |
| Tipo | Natureza do pedido (lançamento, conteúdo, show…). Configurável. |
| Área | Time dono da demanda. Configurável. |
| Artista | Opcional; conecta ao roster. Sem artista = demanda interna. |
| Responsável | Quem está com ela na mão. |
| Início e prazo | A janela da demanda — é o que desenha a barra do cronograma. |
| Marco | Acontecimento sem duração (losango no cronograma). |
| Esforço | P, M ou G. Alimenta a carga do time. |
| Etiquetas | Marcadores livres. |
| Checklist | Subtarefas leves, com barra de progresso. |
| Subtarefas | Demanda dentro de demanda. O progresso da mãe é a média dos filhos. |
| Dependências | "Só começa depois que aquela terminar" — as setas do cronograma. |
| Links | Referências externas (Drive, YouTube). Sem upload: o projeto não tem Storage. |
| Comentários | Fio de conversa dentro da demanda. |

## Modelos de projeto

Um modelo com etapas cria a demanda mãe **e** todas as subtarefas de uma vez, já datadas e encadeadas. É o que evita remontar o mesmo lançamento do zero toda vez. Os modelos são editáveis na configuração; ao criar, os valores são copiados — mudar o modelo depois não mexe no que já existe.

De fábrica vêm: lançamento de single, campanha de conteúdo, show e demanda avulsa.

## Indicadores

Em aberto, atrasadas, paradas há 7 dias ou mais, sem responsável, entregues no mês, tempo médio do início à entrega e o gargalo (coluna mais cheia). Todos respeitam os filtros da tela e saem da lista já carregada — nenhum custa leitura extra. Os que são clicáveis acendem o filtro correspondente.

## Regra de acesso

Quem possui a capacidade **atividades** cria, edita, move e exclui demandas. Por padrão admin e marketing a possuem; artista **não** — são demandas internas do time.

O **colaborador** com a área Atividades enxerga só as demandas em que é o responsável, e nelas faz tudo, inclusive excluir. O que ele cria fica com ele, e ele não repassa. Nas demandas dele, uma antecessora ou demanda mãe da equipe aparece como "demanda da equipe", sem opção de remover. Os indicadores e o cronograma dele contam só o que é dele.

Configurar o quadro (colunas, campos, visões, modelos) é só **admin**: mudar uma coluna afeta o quadro de todo mundo ao mesmo tempo.

Comentário só pode ser editado ou apagado pelo próprio autor (ou pelo admin). As regras conferem a autoria inteira: o nome gravado tem de ser o do perfil de quem comenta, a data é a do servidor, e editar mexe só no texto.

Links da demanda só viram link clicável quando são endereço da web, e-mail (`mailto:`) ou telefone (`tel:`). Esquemas que executam algo ao clicar nunca são gravados.

## Notas de operação

- Uma coluna, tipo ou área **em uso** não pode ser removida na configuração — a tela mostra quantas demandas dependem dela e bloqueia. Remover deixaria demandas invisíveis.
- O campo **Responsável** não pode ser desligado enquanto houver colaborador ativo com acesso às Atividades: ele só enxerga as demandas em que é o responsável, e sem o campo o quadro dele fica vazio. Se o campo já estiver desligado, a configuração mostra o aviso e deixa ligar. Foi o que travou o primeiro designer da Imagine em 21/10/2026.
- Renomear uma coluna é seguro a qualquer momento: a chave gravada nas demandas não muda, só o rótulo na tela.
- Arrastar a barra de uma demanda que tem sucessoras **não** empurra ninguém sozinho; o cronograma oferece o empurrão numa faixa de confirmação.
- Excluir uma demanda solta as subtarefas dela (viram demandas de topo) e remove as setas que apontavam pra ela.
- Se a conferência de uso não carregar, a remoção de coluna também fica bloqueada — "não sei quantas demandas há aqui" é tratado como "não deixa", que é o lado seguro.
- O **caminho crítico** é a corrente de dependências mais longa pela duração planejada, não o cálculo de folga total do MS Project. Para um cronograma de lançamento aponta o mesmo gargalo, mas a diferença está registrada para não ser cobrada como defeito.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

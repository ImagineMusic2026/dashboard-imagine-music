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
| Quadro | Em que etapa cada demanda está. Kanban, arrastar entre colunas, raias por artista/responsável/área, limite de WIP por coluna. O card é enxuto de propósito: título (já com o artista na frente) e responsável. |
| Cronograma | Quando cada coisa acontece. Barras de início a prazo, dependências entre demandas, marcos, caminho crítico, arrastar para reprogramar. |
| Lista | Muita demanda de uma vez, ordenável por prazo, prioridade, progresso ou responsável. |
| Calendário | O que vence no mês, pela data de entrega. O dia mostra até 6 demandas; o "+N" abre o resto ali mesmo. |
| Carga do time | Quanto cada pessoa está segurando, em pontos de esforço, mais o tempo médio por etapa. |

O filtro de **artista** fica na barra principal, ao lado da busca, e acende quando há um escolhido (pedido da cliente em 11/2026): é o recorte que a equipe mais faz. Responsável, área, tipo, prioridade, etiqueta, concluídas e atrasadas continuam em **Filtros**.

## Demanda

| Campo | Uso |
| --- | --- |
| Título | O que precisa ser feito ("Lançamento", "Card", "Presskit"). Aparece como **Artista - título** — ver abaixo. |
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

## Padrão do título

Pedido da cliente em 11/2026, para saber de imediato de que artista é cada demanda: em toda tela o título aparece como `Nome do artista - título`. O nome vem do **cadastro**, não é digitado — renomear o artista muda todas as demandas dele, e as raias, os grupos e o detalhe usam o mesmo nome. Demanda interna (sem artista) mostra o título como está: as "(IMAGINE MUSIC) …" sem artista escolhido seguem assim até alguém escolher o artista Imagine Music nelas.

- No formulário o nome fica fixo antes do campo, com a prévia de como vai aparecer. O que se grava é só o que a pessoa escreve; se ela digitar o nome mesmo assim, ele é tirado ao salvar. Editando, trocar para **Interna** sem mexer no título devolve o título como estava gravado — o nome que o campo tirou ao abrir identificava a demanda.
- Títulos antigos, com o nome escrito à mão nas pontas — "(OS CLONES) PROGRAMAR…", "LANÇAMENTO MUSICAL - GLAUCO", "LINK BIO [GLAUCO]", "REVISAR LANÇAMENTO DE (SILFARLEY)", "Youtube - Os Clones" — aparecem limpos, sem migração. Ao editar, o campo já abre sem o nome. Vale o nome abreviado pelas primeiras palavras: entre parênteses basta uma ("(IVANA)" para "Ivana Barreto"); depois de um traço, duas ("Os Clones"), porque "Turnê - Bahia" numa demanda da Bahia Hits é o lugar. Também vale o nome antigo de um artista renomeado.
- Na dúvida, o nome **fica** — repetido é feio, cortado errado some texto, e salvar o formulário grava o corte. Por isso não sai: no meio do título ("Revisar redes de Nenho (YouTube)"); dentro de parêntese ou aspas com mais coisa ("Show (Nenho & Glauco)", 'Divulgar “Arraiá do Nenho”'); depois de artigo, conector ou vírgula ("Ajustar a luz", "Nenho feat. Glauco", "Show do Nenho e do Glauco", "CARD FELIZ ANIVERSÁRIO, GLAUCO!"); em traço colado dos dois lados ("Beira-Mar", "instagram.com/nenho"); depois de barra ("JUNINHO/NENHO" é dupla). Num título que mistura maiúsculas e minúsculas, nome escrito em minúscula é palavra comum ("Mapa de luz" para uma artista Luz).
- Com o nome no título, a linha do artista saiu do card do quadro e o nome pequeno saiu da lista: só repetiam. O link para o perfil do artista continua no detalhe da demanda.
- A busca e a ordenação por título da lista usam o título como aparece — ordenar por título já agrupa por artista.

## Modelos de projeto

O título sugerido pelo modelo não leva o nome do artista — ele entra sozinho pelo padrão do título. Por isso o marco do lançamento de single virou **Dia do lançamento**, como o "Dia do show": com o nome na frente, a mãe "Lançamento" e o marco "Lançamento" apareceriam iguais. Configuração salva antes disso ainda tem o marco "Lançamento"; nela a mãe nasce com o nome do modelo ("Lançamento de single"). Um modelo com etapas cria a demanda mãe **e** todas as subtarefas de uma vez, já datadas e encadeadas. É o que evita remontar o mesmo lançamento do zero toda vez. Os modelos são editáveis na configuração; ao criar, os valores são copiados — mudar o modelo depois não mexe no que já existe.

De fábrica vêm: lançamento de single, campanha de conteúdo, show e demanda avulsa.

## O card do quadro

O card mostra **título e responsável** — nada mais. O artista vem na frente do título, pelo padrão do título; a linha própria dele, com avatar, saiu em 11/2026 porque só repetia o nome. Tipo, área, prioridade, descrição, progresso, etiquetas, prazo, esforço e os selos de subtarefa, comentário, link e dependência vivem no detalhe, que abre ao clicar no título. A decisão é de 03/11/2026: o card cheio passava de 200px e meia dúzia de demandas já jogavam a rolagem do quadro pra fora da tela.

Duas exceções ficaram, porque não custam altura e custam caro de perder: a barra colorida da esquerda (cor da etapa, vermelha quando atrasou) e o selo **Atrasada**, que impede o atraso de ser sinalizado só por cor.

A coluna também tem **teto de altura** e rola por dentro. Sem ele o quadro crescia com os cards e a barra de rolagem horizontal — a que anda entre as etapas — ia parar no pé da página.

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
- No calendário o dia mostra até **6** demandas (eram 3) e a célula cresce com o conteúdo a partir de um piso de 140px — um mês tranquilo continua compacto, e a semana que tem um dia cheio é a única que estica. O **+N demandas** é um botão: abre as escondidas na própria célula e vira "mostrar menos".
- Desligar um campo na configuração continua valendo para o formulário, o detalhe e as outras visões; no card do quadro só **artista** e **responsável** têm efeito, porque os demais já não aparecem lá. Com **artista** desligado, os títulos aparecem como foram escritos, sem o nome na frente, em todas as visões.
- O **caminho crítico** é a corrente de dependências mais longa pela duração planejada, não o cálculo de folga total do MS Project. Para um cronograma de lançamento aponta o mesmo gargalo, mas a diferença está registrada para não ser cobrada como defeito.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

---
tipo: funcionalidade
---

# Exportar dados do artista

Botão no topo do [[03 - Artistas/Perfil do artista]] que reúne tudo o que o painel sabe sobre um artista em um documento só. Nasceu de um pedido da Imagine: jogar os dados num assistente de IA e pedir análise, relatório, plano de ação.

## Duas saídas, dois destinos

**Copiar** põe o documento em texto na área de transferência, para colar direto num assistente. É o botão em destaque, porque é o uso que originou a funcionalidade.

**Baixar planilha** gera um arquivo de Excel com a identidade visual da Imagine, para quem vai filtrar, somar e fazer gráfico.

As duas saem exatamente dos mesmos dados, reunidos uma vez — não têm como divergir.

PDF foi descartado de propósito: paginação e diagramação viram ruído para a IA, que gasta atenção decifrando a forma em vez do conteúdo.

## O que evita a IA errar

Três regras guiam o documento, e cada uma existe contra um erro concreto de leitura:

**Ausência nunca vira zero.** Onde não há medição, está escrito "não medido". Um Instagram não coletado escrito como `0` faria a IA concluir que o artista não tem público lá — e escrever isso no relatório. Na planilha isso é ainda mais importante, porque célula vazia no Excel vale zero em qualquer soma; por isso a ausência aparece por extenso, em cinza itálico, mesmo custando o tipo numérico da coluna.

**Todo número traz a janela e a fonte.** "23 milhões de reproduções" sozinho não diz se é do mês ou da vida inteira.

**Tudo é datado.** Métrica de três meses atrás lida como atual gera recomendação errada com toda a confiança.

O documento abre com uma seção explicando essas convenções à própria IA. É barato e melhora visivelmente a resposta.

## O período afeta só a evolução

Dá para escolher 28 dias, 90 dias ou todo o histórico — e isso vale **apenas para a evolução dia a dia**. Os outros blocos são retratos de janelas fixas que não dão para recortar: as faixas mais tocadas, os vídeos do público, a consulta à Soundcharts e os índices. Cada um carimba a própria janela.

Um seletor que mudasse o rótulo sem mudar o dado faria o documento afirmar um período que ele não tem — o mesmo erro do zero no lugar do "não medido", só que na dimensão do tempo.

Os períodos oferecidos estão ancorados no que existe: a série de streaming começa em fevereiro de 2026 e as redes têm cerca de três meses. Oferecer "últimos dois anos" voltaria vazio e pareceria que o artista não tinha público.

O padrão é a janela curta porque cada período custa cinco leituras por dia de histórico — quem precisa do histórico inteiro escolhe, em vez de todo mundo pagar por ele. Ver [[06 - Tecnologia/Custo de leitura do Firestore]].

## Receita entra por escolha, nunca por descuido

A opção de incluir receita vem **desmarcada** e só aparece para quem tem a permissão. O documento pode ir para uma IA de terceiro, e faturamento não deveria viajar junto sem alguém decidir. Quando entra, sai **separada por moeda e com a instrução explícita de não somar moedas diferentes** — o painel nunca soma, e a IA precisa herdar a regra.

## Coluna vazia some

Quando uma rede não tem série no período escolhido, a coluna sai da tabela e o documento diz quais faltaram. Uma coluna inteira de "não medido" ocupa espaço sem informar, e ainda arrisca ser lida como estagnação.

Veja [[03 - Artistas/Perfil do artista]] e [[02 - Acesso e equipe/Perfis e permissões]].

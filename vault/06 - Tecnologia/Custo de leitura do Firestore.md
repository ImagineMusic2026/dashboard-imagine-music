---
tipo: operacao
---

# Custo de leitura do Firestore

O banco do painel cobra por **documento lido**, e a conta está no plano gratuito: **50 mil leituras por dia**. Isso não é um detalhe de infraestrutura — é uma restrição de produto, e já derrubou o painel duas vezes.

A cliente decidiu não migrar para o plano pago. Então cada tela precisa caber no orçamento, e "adicionar um card" é uma decisão com preço.

## As duas quedas

**Agosto de 2026.** O sino de notificações carregava o roster inteiro duas vezes por tela. Chegou a 67 mil leituras num dia e o painel ficou sem dados. A correção foi cortar por código: limitar as séries, cachear por artista e dar cinco minutos de validade ao cache.

**09 de setembro de 2026.** Aconteceu de novo, e a causa foi o próprio trabalho de medição: o script que conta o custo do perfil lê de verdade para contar, e foi executado cinco vezes seguidas enquanto alguém ajustava a saída. Somado à importação do catálogo, a duas rodadas de atribuição de fonogramas e ao levantamento dos 97 artistas na Soundcharts, estourou.

A lição da segunda é específica e vale escrever: **a ferramenta de diagnóstico gasta o recurso que diagnostica.** Rodar uma vez, anotar o número, comparar com o anotado.

A cota zera à meia-noite do **horário do Pacífico**, que é como o Firebase conta o dia. Não é meia-noite de Brasília, e não há como acelerar.

## Quanto custa abrir um perfil

Medido em 09/09/2026, no maior artista do roster:

| | leituras |
| --- | ---: |
| Antes | 740 |
| Depois dos fonogramas sob demanda | 431 |
| Depois das abas | **82** |

A 740 por perfil, 68 aberturas esgotavam o dia inteiro. A 82, cabem mais de 600 — e sobra orçamento para as outras telas.

O que ainda pesa, e é legítimo: as cinco séries diárias de 90 dias somam cerca de 420 leituras. Elas alimentam gráficos que estão de fato na tela (o comparativo de canais desenha quatro curvas, o Health Score desenha a sua). Encurtar a janela para 30 dias economizaria bastante, mas **mudaria o significado dos números** — "variação no período" passaria a ser de um mês em vez de três. É decisão da Imagine, não otimização.

## Os padrões que o painel usa

**Contador desnormalizado.** Quando a tela só precisa de "quantos", o número fica gravado no próprio cadastro do artista e é atualizado por quem mexe na coleção. Contar ao vivo custaria uma leitura por documento. É assim com os fonogramas.

**Uma leitura dividida por vários cards.** O documento de métricas do artista é pedido por oito cards diferentes e lido uma vez só, por um cache de curta duração. O mesmo vale para as séries diárias, desde que peçam a mesma janela — a janela faz parte da chave do cache.

**Carregar sob demanda.** Lista longa só é buscada quando alguém pede. O card anuncia o tamanho e espera o clique.

**Montar só o que está visível.** Esconder com CSS não adianta: o componente monta e lê igual. Só não montar economiza.

**Invalidar depois de escrever.** Quem grava precisa derrubar o cache, senão a tela mostra o número de antes e parece que o botão não funcionou.

## Antes de acrescentar um card

Existe um medidor no repositório que replica o que cada card pede e devolve o custo por aba. Rode **uma vez**, num artista grande, e leve o número para a discussão. É mais rápido que discutir por intuição, e mais barato que descobrir depois.

Veja [[06 - Tecnologia/Arquitetura técnica]] e [[03 - Artistas/Perfil do artista]].

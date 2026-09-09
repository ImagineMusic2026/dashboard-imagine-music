---
tipo: regra-de-negocio
metodologia: IAOS-DOC-02 v1.2
---

# Estágio — Índice Geral de Estágio (IGE)

Índice de 0 a 100 que posiciona a **escala de mercado** alcançada pelo projeto. Vem da metodologia IAOS v1.2 (04/09/2026) e aparece no perfil do artista, logo abaixo do Health Score.

Os dois medem coisas diferentes e a metodologia separou de propósito: o IGE responde "que tamanho o projeto alcançou"; o [[03 - Artistas/Health Score]] responde "quão saudável ele está para esse tamanho". Confundir porte com desempenho foi o problema que a v1.2 veio resolver. O Health Score **não** foi alterado.

## Componentes

| Componente | Peso | Origem | Situação |
| --- | --- | --- | --- |
| Audiência ajustada | 30% | Instagram + TikTok + YouTube (painel) | Ativo |
| Consumo musical e audiovisual | 40% | Spotify monthly listeners + YouTube views/28d | Fonte disponível ([[04 - Dados e integrações/Soundcharts]]) |
| Airplay | 20% | Execuções em rádio/28d | Fonte disponível, mas rasa — ver abaixo |
| Mercado ao vivo | 10% | Declaração da equipe | Ativo |

Faixas do estágio: Pré-descoberta < 20 · Descoberta 20–39,99 · Desenvolvimento 40–59,99 · Consolidação 60–79,99 · Mainstream 80–100.

## Cobertura e provisoriedade

Até 09/09/2026 a cobertura máxima era 40%, porque consumo e airplay não tinham fonte. O [[04 - Dados e integrações/Soundcharts]] resolveu isso sem custo adicional: o acesso funciona, é sob demanda e cobre os quatro componentes.

O painel calcula o índice **sobre a cobertura disponível** e mostra três coisas juntas: o percentual coberto, a marca "provisório" e um ND em cada dimensão ausente. Nada é redistribuído em silêncio — a metodologia proíbe o silêncio, não a renormalização declarada.

A marca de provisório continua valendo, mas o motivo mudou. Não é mais falta de dado; é falta das faixas que convertem o dado em nota.

Zerar o ausente seria pior: na simulação sobre o roster (04/09/2026), um artista de 4,9 milhões de audiência cairia em "Descoberta".

## Desvio consciente — fator de equilíbrio

A tabela oficial corta a audiência conforme a concentração na maior rede. Aplicada ao pé da letra hoje, **74 de 86 artistas cairiam no fator 0,40** e 71 deles têm **uma** rede medida — o corte puniria buraco de coleta, não concentração real.

Por isso o painel só aplica o fator quando há **pelo menos duas redes medidas**; abaixo disso mostra "fator não aplicado — só 1 rede medida". **Pendente de confirmação com a Imagine.**

A causa de fundo é de coleta, não de cadastro: 84 artistas têm Instagram cadastrado e 11 têm métrica; TikTok, 66 contra 13.

## Mercado ao vivo

A equipe escolhe uma das seis descrições padronizadas; o score vem da tabela e nunca é digitado. Na dúvida entre dois níveis, escolher o menor.

Fica em `projetos/{slug}`, não em `artistas/{slug}` — é classificação da equipe sobre o projeto (o nível 0 é "mercado praticamente inativo") e o artista lê o próprio cadastro no portal. Grava nível, score, data e responsável, como a metodologia exige. Exige a permissão de cadastrar/editar artistas.

## Pendências antes de completar a metodologia

- ~~Soundcharts contratado e integrado (60% do índice).~~ **Resolvido em 09/09/2026** — está no plano PRO, sem custo novo. Ver [[04 - Dados e integrações/Soundcharts]].
- **Rever o peso de 20% do airplay**, ou as faixas dele, à luz do que a fonte consegue enxergar (ver a seção seguinte).
- Pesos do Health Score para o estágio Pré-descoberta — a v1.2 define 5 estágios e só 4 linhas de peso.
- Faixas esperadas por estágio para cada métrica do Health Score — citadas na v1.2, não especificadas.
- Confirmar o desvio do fator de equilíbrio.

Veja [[03 - Artistas/Health Score]] e [[04 - Dados e integrações/Integrações]].

## Faixas de consumo e airplay

A v1.2 fixa os pesos (consumo 40%, airplay 20%) e a escala de saída, mas **não publica** quantos ouvintes ou execuções correspondem a cada degrau. Sem essa conversão, contratar o Soundcharts sozinho não fecharia o índice: os números chegariam crus e os dois componentes seguiriam ND.

As faixas abaixo foram calibradas por nós em 05/09/2026, na mesma forma das tabelas que a metodologia já define, em ordens de grandeza compatíveis com um selo regional brasileiro. **Pendentes de homologação pela Imagine** — trocar é editar duas tabelas em `src/lib/iaos/ige.ts`, nada mais no cálculo depende dos valores.

**Consumo** — ouvintes mensais no Spotify + views/28d no YouTube, somados:

| Faixa | Nota |
| --- | --- |
| < 5 mil | 5 |
| < 50 mil | 20 |
| < 250 mil | 40 |
| < 1 milhão | 60 |
| < 5 milhões | 80 |
| 5 milhões ou mais | 100 |

**Airplay** — execuções em rádio nos últimos 28 dias:

| Faixa | Nota |
| --- | --- |
| < 50 | 5 |
| < 500 | 20 |
| < 2.500 | 40 |
| < 10.000 | 60 |
| < 50.000 | 80 |
| 50.000 ou mais | 100 |

O degrau 5 existe pelo mesmo motivo que existe na tabela de mercado ao vivo: "medido e praticamente nulo" não é o mesmo que "não medido", e não pode virar 20. Métrica ausente continua `null` e o componente sai ND, conforme o §8.

Por que isso importa na prática: um artista que hoje aparece como Descoberta com 40% de cobertura pode cair para Pré-descoberta quando a cobertura fechar. A leitura provisória tende a ser otimista.

## Airplay medido — a faixa acima não cabe neste roster

Com a fonte disponível, deu para conferir a tabela de airplay contra a realidade. Ela não se sustenta.

Em doze meses, **15 dos 97 artistas** têm alguma execução de rádio registrada. Os outros 82 empatam em zero. E entre os 15, a distância é enorme: o primeiro colocado soma 1.329 execuções e o segundo, 121.

Traduzindo para a tabela acima, em janela de 28 dias: o maior artista do roster tira **20** de 100 no airplay. O segundo tira 5. Todo o resto sai ND ou 5. A faixa de topo, de 50 mil execuções, é cerca de seiscentas vezes o que o maior artista da casa alcança — ela nunca vai ser usada.

Isso deixa duas conclusões separadas, e convém não misturá-las:

**Sobre a tabela.** As faixas foram calibradas por ordem de grandeza plausível, não por dado observado, e a de airplay errou por ordens de grandeza. Quando as faixas oficiais chegarem, esta é a primeira que precisa ser conferida contra o roster real — se ela também partir de milhares de execuções, o componente inteiro vira ruído.

**Sobre o peso.** Um componente que vale 20% do índice e no qual 85% do roster empata em zero não ordena ninguém: ele apenas subtrai a mesma quantidade de quase todo mundo. Vale levar isso à Imagine como pergunta de desenho, não como defeito de implementação.

E uma ressalva que **não pode ser dita errado**: quase toda a execução detectada está em duas emissoras baianas. A explicação provável é que a fonte não monitora as rádios regionais do Nordeste, e não que os artistas não toquem no rádio. As duas frases descrevem o mesmo número e só uma delas é defensável.

## Mercado ao vivo — o que fica registrado

A equipe escolhe uma das seis descrições padronizadas e o score vem da tabela oficial; ninguém digita nota. Ficam gravados **nível, score, data da avaliação, responsável e uma observação livre**.

A data da avaliação é separada da data do registro de propósito: a avaliação costuma sair de uma reunião e ser digitada dias depois, e a metodologia pede a data em que se avaliou, não a de quem digitou.

Veja [[03 - Artistas/Dossiê do artista]] para as outras evidências da alavanca de Expansão.

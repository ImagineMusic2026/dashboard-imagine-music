---
tipo: integracao
plataforma: Soundcharts
---

# Soundcharts

## Papel no painel

É a fonte que faltava para o [[03 - Artistas/Estágio (IGE)]]. Fecha consumo (40% do índice) e airplay (20%), e ainda reforça audiência e mercado ao vivo. Sem ela, o IGE nunca passava de 40% de cobertura.

## Como a consulta acontece

Sob demanda, no momento em que alguém pede o diagnóstico — **não** há sincronização noturna. A decisão veio da cliente, em 08/09/2026: ela só precisa do dado na hora de gerar o diagnóstico e não quer nada consultando o tempo todo.

Isso simplifica muito. Não existe rotina agendada, coleção nova nem acúmulo de histórico: o painel pergunta, recebe, grava o resultado junto do diagnóstico e para por aí. Cada consulta guarda **quando foi consultada**, para que um estágio antigo não seja lido como atual.

## O que o plano cobre

O plano PRO da Imagine inclui o MCP, que é o canal usado. A API tradicional é venda separada e **não** está assinada — a cliente estava certa quando disse isso. Não há custo adicional para o painel funcionar.

A cota é de **10 mil requisições por mês**, compartilhada por toda a equipe: o uso da própria Geyse no site e as consultas do painel saem do mesmo bolso. Como cada diagnóstico gasta poucas unidades, sobra folga larga.

## O que dá para pedir

| Necessidade | O que responde |
| --- | --- |
| Audiência por rede, com variação | Seguidores em Spotify, YouTube, TikTok, Instagram, Facebook e Deezer |
| Consumo | Audiência de escuta por plataforma de streaming |
| Airplay | Execuções por emissora, com nome e país da rádio |
| Mercado ao vivo | Shows passados e futuros, com local, cidade e estado |
| Identidade | Gênero, país e um estágio de carreira próprio da Soundcharts |

## O que descobrimos sobre o roster

Em 09/09/2026 cruzamos os 98 artistas do painel com a base deles. Dois achados mudam o que dá para prometer.

**O estágio de carreira da Soundcharts não serve para conferir a régua da metodologia.** Numa escala global, 86 dos 97 artistas encontrados saem como "cauda longa" e apenas dois sobem um degrau. O maior artista do roster, com 5,8 milhões de audiência somada, fica no mesmo balde que quase todo mundo. A ferramenta simplesmente não tem resolução nesse recorte — o que, pelo avesso, é o melhor argumento a favor de a Imagine ter régua própria, calibrada para o mercado regional.

**O airplay existe, mas é rasíssimo.** Em doze meses, só 15 artistas têm alguma execução registrada, e o primeiro tem onze vezes mais que o segundo. Isso é discutido em detalhe no [[03 - Artistas/Estágio (IGE)]], porque afeta o peso de 20% do índice.

O ponto que **não** pode ser dito errado: quase toda a execução detectada está em duas emissoras baianas. A leitura honesta é que a Soundcharts não monitora as rádios regionais que tocam esses artistas — não que os artistas não toquem no rádio. São afirmações diferentes e só uma delas é sustentável.

## Qualidade do cruzamento

Casar artista por nome é arriscado: a base deles tem milhares de homônimos para nomes curtos. O caminho confiável é resolver pelo endereço do Spotify já cadastrado no painel, que devolve o artista exato.

Hoje 19 dos 98 artistas não têm esse endereço no cadastro e caem no casamento por nome, que é palpite — um deles trouxe execuções de uma rádio portuguesa, quase certamente outra pessoa. **Preencher o Spotify desses 19 é a tarefa mais barata para deixar qualquer consulta confiável**, e é trabalho de cadastro, não de desenvolvimento.

## Acesso

A credencial é técnica, do tipo próprio para sistemas, criada uma única vez no console de desenvolvedor da conta. Não depende da senha de ninguém e continua valendo se a senha mudar. Vive apenas como variável de ambiente, nunca no repositório — ver [[06 - Tecnologia/Segurança e dados sensíveis]].

O plano tem um assento de usuário só. Convidar mais gente pode gerar cobrança na conta da cliente e não deve ser feito sem autorização dela.

## Conferência

Existem duas verificações prontas: uma que confirma se o acesso funciona e lista o que está disponível, e outra que cruza o roster inteiro e devolve o retrato de audiência, airplay e estágio de cada artista. A segunda serve para o dia em que as faixas de corte chegarem — dá para ver em minutos se elas separam o roster ou jogam quase todo mundo no mesmo balde.

Veja [[04 - Dados e integrações/Integrações]] e [[03 - Artistas/Estágio (IGE)]].

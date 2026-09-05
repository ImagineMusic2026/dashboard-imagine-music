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
| Consumo musical e audiovisual | 40% | Spotify monthly listeners + YouTube views/28d | Pendente de Soundcharts |
| Airplay | 20% | Execuções em rádio/28d | Pendente de Soundcharts |
| Mercado ao vivo | 10% | Declaração da equipe | Ativo |

Faixas do estágio: Pré-descoberta < 20 · Descoberta 20–39,99 · Desenvolvimento 40–59,99 · Consolidação 60–79,99 · Mainstream 80–100.

## Cobertura e provisoriedade

Enquanto o Soundcharts não estiver integrado, a cobertura máxima é 40%. O painel calcula o índice **sobre a cobertura disponível** e mostra três coisas juntas: o percentual coberto, a marca "provisório" e um ND em cada dimensão ausente. Nada é redistribuído em silêncio — a metodologia proíbe o silêncio, não a renormalização declarada.

Zerar o ausente seria pior: na simulação sobre o roster (04/09/2026), um artista de 4,9 milhões de audiência cairia em "Descoberta".

## Desvio consciente — fator de equilíbrio

A tabela oficial corta a audiência conforme a concentração na maior rede. Aplicada ao pé da letra hoje, **74 de 86 artistas cairiam no fator 0,40** e 71 deles têm **uma** rede medida — o corte puniria buraco de coleta, não concentração real.

Por isso o painel só aplica o fator quando há **pelo menos duas redes medidas**; abaixo disso mostra "fator não aplicado — só 1 rede medida". **Pendente de confirmação com a Imagine.**

A causa de fundo é de coleta, não de cadastro: 84 artistas têm Instagram cadastrado e 11 têm métrica; TikTok, 66 contra 13.

## Mercado ao vivo

A equipe escolhe uma das seis descrições padronizadas; o score vem da tabela e nunca é digitado. Na dúvida entre dois níveis, escolher o menor.

Fica em `projetos/{slug}`, não em `artistas/{slug}` — é classificação da equipe sobre o projeto (o nível 0 é "mercado praticamente inativo") e o artista lê o próprio cadastro no portal. Grava nível, score, data e responsável, como a metodologia exige. Exige a permissão de cadastrar/editar artistas.

## Pendências antes de completar a metodologia

- Soundcharts contratado e integrado (60% do índice).
- Pesos do Health Score para o estágio Pré-descoberta — a v1.2 define 5 estágios e só 4 linhas de peso.
- Faixas esperadas por estágio para cada métrica do Health Score — citadas na v1.2, não especificadas.
- Confirmar o desvio do fator de equilíbrio.

Veja [[03 - Artistas/Health Score]] e [[04 - Dados e integrações/Integrações]].

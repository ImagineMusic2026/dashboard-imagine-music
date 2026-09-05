---
tipo: regra-de-negocio
---

# Health Score

Nota de 0 a 100 que orienta triagem do roster. É calculada a partir de dados coletados, não de estimativas.

Mede **saúde**, não porte. O tamanho de mercado é medido separadamente pelo [[03 - Artistas/Estágio (IGE)]], seguindo a metodologia IAOS v1.2. A revisão que torna estes pesos variáveis por estágio ainda não foi aplicada — depende de lacunas abertas descritas naquela nota.

## Pilares e pesos

| Pilar | Peso | Leitura |
| --- | --- | --- |
| Audiência | 20% | Total de seguidores de Instagram, YouTube e TikTok. |
| Crescimento | 15% | Variação desde a coleta anterior. |
| Engajamento | 25% | Interação relativa ao tamanho da audiência. |
| Conteúdo | 15% | Recência e frequência de publicações. |
| Carreira & Negócio | 25% | Volume e momentum de streaming OneRPM. |

## Faixas

Excelente: 80–100 · Saudável: 60–79 · Atenção: 40–59 · Crítico: 0–39.

## Regras de honestidade

- Artista sem nenhum sinal-base fica sem score, não recebe nota inventada.
- Crescimento aparece somente a partir da segunda coleta.
- Pilar sem dado sai da conta e os pesos restantes são redistribuídos proporcionalmente.

O score é carimbado diariamente depois das sincronizações. Parâmetros de referência: audiência máxima em 1 milhão de seguidores, recência de conteúdo zera aos 45 dias e volume de conteúdo satura em 12 posts por 30 dias.

Veja [[01 - Produto/Home do painel]], [[01 - Produto/Alertas]] e [[06 - Tecnologia/Coletas e jobs diários]].

## Régua v1.2 (prévia, decisões tomadas pela liderança técnica)

A régua adaptativa da metodologia IAOS v1.2 está implementada e aparece como **prévia** dentro do card de Estágio, ao lado do número oficial. O score oficial do painel **não mudou** — trocar exigiria pendurar a nota de 96 artistas num estágio ainda provisório e criaria um degrau no histórico de 74 dias.

Quatro pilares (a audiência saiu, virou os 30% do IGE), com faixa esperada e peso pelo estágio. Os parâmetros ficam todos em um único ponto: `PARAMETROS_V12`.

Como a v1.2 não publica as faixas, elas foram calibradas sobre o roster real em 04/09/2026, com dois critérios: onde há amostra, a mediana do estágio pontua ~50; onde a amostra é pequena (n ≤ 4 nos estágios altos), a escada é suavizada para ser monótona em vez de colar no ruído.

Decisões que aguardam confirmação da Imagine:

- **Pré-descoberta herda os pesos de Descoberta** — a v1.2 define 5 estágios e publica 4 linhas de peso.
- **Conteúdo não é adaptativo.** A v1.2 nomeia crescimento e engajamento como as métricas que não podem ter régua única; cadência não entra na lista. Calibrar cadência pelo roster premiaria a dormência — a mediana da Descoberta é 139 dias sem publicar.
- **Crescimento usa referência de mercado, não a mediana do roster** (~6%/mês na Descoberta a ~2%/mês no Mainstream). A variação diária de seguidores é 0,00% para a maioria porque as plataformas arredondam a contagem de canais pequenos.
- **"Dados insuficientes" não vira "crítico".** A v1.2 junta os dois na faixa 0–34; o painel mantém a regra antiga de não dar nota a quem não tem sinal.

Efeito medido no roster: 40 artistas sobem, 40 caem, variação média de +0,8 ponto. O que mais muda é o engajamento — views/inscritos tem mediana de 87% na Descoberta e 5% no Mainstream, e a régua única de hoje inflava o pequeno e punia o grande.


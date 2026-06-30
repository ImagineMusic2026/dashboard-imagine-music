# Metodologia do Health Score — Painel Imagine

> Documento de referência para validação com a gestão artística da Imagine.
> Cada critério aqui é um **parâmetro ajustável** — a ideia é exatamente revisar
> os números juntos para que o score reflita a estratégia da Imagine.
>
> Versão da metodologia: calibrada em 23/06/2026 sobre o roster real.
> Nomenclatura dos pilares alinhada ao contrato em 30/06/2026.

---

## 1. O que é o Health Score

O **Health Score** é um número único de **0 a 100** que resume, em um só lugar, o
quão "saudável" está a presença digital de um artista **hoje**. Ele serve para
**triagem**: bater o olho no roster inteiro e saber onde a atenção da equipe é
mais urgente, sem precisar abrir métrica por métrica.

Pontos importantes:

- É calculado a partir de **dados reais já coletados** (Instagram, YouTube,
  TikTok e streaming via OneRPM) — os **mesmos** dados que alimentam os alertas.
  Não há estimativa nem "achismo".
- É **recalculado todo dia** e guarda histórico, então existe uma **linha de
  evolução** do score de cada artista ao longo do tempo.
- É **honesto**: artista sem dado suficiente **não recebe um número falso** (ver
  princípio na seção 2).

---

## 2. Princípios de design

Três decisões guiam toda a metodologia:

1. **Honestidade acima de cobertura.** Se um artista não tem nenhum sinal de base
   (nenhuma rede e nenhum streaming), ele **fica sem score** em vez de receber um
   número inventado. E quando falta **um** pilar (ex.: artista só tem Instagram,
   sem streaming), o score **não é penalizado** por isso — ele é calculado só
   sobre os pilares que existem, com os pesos reequilibrados (ver seção 4).

2. **Resistência a evento isolado.** O engajamento usa a **mediana** dos posts
   recentes, não a média. Assim, um único viral não "infla" a saúde do artista, e
   um único post fraco não derruba. O score mede tendência, não sorte.

3. **Estabilidade e comparabilidade.** As faixas (Excelente / Saudável / Atenção
   / Crítico) são fixas, o cálculo é o mesmo para todos, e o streaming combina
   volume (estável) com momentum (sensível) numa proporção que evita que um pico
   de uma semana mexa demais no número.

---

## 3. Os cinco pilares

O score é a combinação de **cinco pilares**, cada um também numa escala de 0 a
100. Os pesos abaixo são o **coração da metodologia** — é o primeiro lugar onde a
gestão pode opinar.

| Pilar | Peso | O que mede | Fonte |
|---|---|---|---|
| **Audiência** | **20%** | Tamanho da base — total de seguidores somados | Instagram + YouTube + TikTok |
| **Crescimento** | **15%** | Momentum — variação de seguidores desde a última coleta | Instagram + YouTube |
| **Engajamento** | **25%** | Interação real por publicação, relativa ao tamanho da base | Instagram + YouTube |
| **Conteúdo** | **15%** | Cadência — há quanto tempo não posta + volume no último mês | Instagram + YouTube |
| **Carreira & Negócio** | **25%** | Consumo real — volume de streams (28 dias) + momentum recente | OneRPM |

**Engajamento e Carreira & Negócio são os pilares de maior peso (25% cada)** — a
leitura é de que "as pessoas estão de fato consumindo e interagindo" importa mais
do que puramente o tamanho da base. Esse é um ponto explícito de validação.

> **Alinhamento com o contrato.** O contrato lista quatro pilares — Audiência,
> Engajamento, Conteúdo e **Carreira & Negócio**. Os três primeiros são idênticos;
> **Carreira & Negócio** é medido hoje pelo **streaming / consumo real** (OneRPM) e
> será reforçado pela **receita** assim que a OneRPM liberar as rotas. O painel
> ainda traz um pilar **extra** — **Crescimento** (momentum de seguidores) — como
> refinamento além do escopo contratado.

### 3.1. Audiência (20%)

Soma de seguidores de Instagram, YouTube e TikTok. *Observação:* o YouTube só
entra quando o canal **expõe** a contagem de inscritos (canais que ocultam não
contam, para não zerar artificialmente).

O total vira nota numa **escala logarítmica**, porque a diferença entre 1 mil e
10 mil importa muito mais do que entre 1 milhão e 1,01 milhão:

| Seguidores totais | Nota |
|---|---|
| 1.000 | 50 |
| 10.000 | 67 |
| 100.000 | 83 |
| 1.000.000 | 100 |

> A meta de "topo" (1 milhão = nota 100) é **absoluta**, não relativa à mediana do
> roster — decisão consciente, explicada na seção 6.

### 3.2. Crescimento (15%)

Variação percentual de seguidores **desde a coleta anterior** (Instagram e
YouTube carimbam o "antes" a cada sincronização). O TikTok não entra aqui porque a
API dele não expõe histórico de seguidores.

- **0%** (estável) → nota **50** (neutro)
- **+1%** → nota **100**
- **−1%** → nota **0**

> Como a coleta é ~diária, isso lê o crescimento praticamente dia a dia. A
> sensibilidade (±1% = nota máxima/mínima) é um parâmetro de validação.
>
> Crescimento só conta quando já existe **uma medição anterior** carimbada (a
> partir do 2º sync). Até lá, o score do artista é composto pelos outros pilares.

### 3.3. Engajamento (25%)

A interação **mediana por publicação**, dividida pelo tamanho da base — ou seja,
"de cada X seguidores, quantos realmente reagem":

- **Instagram:** (curtidas + comentários) por post, mediana dos posts recentes,
  dividida por seguidores. Faixa de referência: **0,3% a 5%** (5%+ é excepcional).
- **YouTube:** views por vídeo, mediana dos vídeos recentes, dividida por
  inscritos. Faixa de referência: **3% a 1500%** (a cauda é enorme em canais
  pequenos, onde um vídeo bom rende muito mais views do que inscritos).

Quem tem as duas redes recebe a **média** das duas notas. As faixas são tratadas
em escala logarítmica para não "saturar todo mundo em 100" (ver Calibração,
seção 6).

### 3.4. Conteúdo (15%)

Mede **cadência de publicação**, combinando duas coisas:

- **Recência** (peso 60%): há quanto tempo saiu o último post.
  0 dias → 100; **45 dias → 0** (~1 mês já é o limite do aceitável).
- **Volume** (peso 40%): quantos posts nos últimos 30 dias.
  **12 posts/mês (~3 por semana) → 100**.

### 3.5. Carreira & Negócio (25%)

Consumo real na OneRPM (streaming), combinando:

- **Volume** (peso 70%): total de streams nos últimos 28 dias, em escala log.
  500 → 0; ~20 mil → 50; 800 mil+ → 100.
- **Momentum** (peso 30%): última semana vs. média das 3 semanas anteriores.
  Estável → 50; **+50% → 100**; **−50% → 0**.

A proporção 70/30 faz o pilar refletir o **tamanho** do consumo sem ficar volátil
com um pico isolado de uma semana.

---

## 4. Como o número final é montado

O score é a **média ponderada dos pilares que têm dado**, com os pesos
**reequilibrados** quando algum pilar falta.

**Exemplo:** um artista com Instagram e YouTube, mas **sem** streaming. O pilar
Carreira & Negócio (25%) simplesmente sai da conta, e os 25% restantes são redistribuídos
proporcionalmente entre Audiência, Crescimento, Engajamento e Conteúdo. O artista
não é punido por não estar (ainda) na OneRPM.

Isso garante que o score seja **comparável** entre artistas com perfis de dados
diferentes, sem inventar pilar que não existe.

---

## 5. Faixas de classificação

O número de 0 a 100 vira um rótulo de cor para leitura rápida:

| Faixa | Score | Cor | Leitura |
|---|---|---|---|
| **Excelente** | 80 – 100 | Verde | Presença forte e ativa em todas as frentes |
| **Saudável** | 60 – 79 | Violeta | Bem, sem alarme |
| **Atenção** | 40 – 59 | Âmbar | Algum pilar puxando para baixo — vale olhar |
| **Crítico** | 0 – 39 | Vermelho | Sinal fraco em múltiplas frentes |

Para os artistas em **Atenção** ou **Crítico**, o painel nomeia o **pilar mais
fraco** ("Perdendo seguidores", "Engajamento baixo", "Postando pouco", "Audiência
pequena" ou "Streaming baixo") — assim a equipe sabe *onde* agir, não só que há um
problema.

---

## 6. Por que algumas réguas são "absolutas" (calibração)

A calibração foi medida em **23/06/2026** sobre o roster real (script
`scripts/analise-health.mjs`, que imprime a distribuição dos sinais brutos). Duas
decisões valem destaque para a discussão:

- **Engajamento entra em escala logarítmica** porque as taxas têm **cauda longa**
  — no YouTube, a mediana de views/inscritos fica perto de 70%, mas o percentil 90
  chega a ~870% em canais pequenos. Numa régua linear, quase todo mundo saturaria
  em 100 e o pilar perderia poder de diferenciação.

- **Audiência e cadência usam metas ABSOLUTAS**, não a mediana do roster. Motivo:
  hoje boa parte do roster **não posta há meses**. Se a meta fosse a mediana do
  próprio grupo, estaríamos "premiando a dormência" — um artista parado pareceria
  mediano só porque os colegas também estão parados. As metas absolutas (1M de
  seguidores = 100, postar a cada poucos dias = 100) mantêm a régua ligada à
  ambição, não ao status quo.

Para recalibrar no futuro, basta rodar o script de novo e ajustar as faixas.

---

## 7. Visão de portfólio (home)

Na home, os scores individuais são agregados em:

- **Média** do portfólio (0–100) e **quantos artistas** têm dado suficiente para
  ter score ("avaliados");
- **Distribuição** por faixa (quantos Críticos / Atenção / Saudáveis / Excelentes);
- **Composição média** pilar a pilar — onde o portfólio inteiro está forte ou
  fraco (ex.: "audiência alta, mas conteúdo baixo no geral").

---

## 8. Atualização

O score é **carimbado 1×/dia** por artista (cron na Vercel, 9h, depois das
sincronizações de plataforma). Esse carimbo diário é o que constrói a **linha de
evolução** do score — visível no card de cada artista assim que houver alguns dias
de coleta.

---

## 9. Critérios abertos para validação ⭐

Esta é a seção para a gestão da Imagine opinar. Cada item abaixo é uma escolha
**deliberada** que pode ser ajustada para alinhar à estratégia artística.

**A) Pesos dos pilares** — hoje: Audiência 20% · Crescimento 15% · Engajamento
25% · Conteúdo 15% · Carreira & Negócio 25%.
→ *Engajamento e Carreira & Negócio pesam mais. Faz sentido para a Imagine, ou
algum pilar deveria pesar mais/menos?*

**B) Faixas de classificação** — hoje: Excelente ≥80, Saudável 60–79, Atenção
40–59, Crítico <40.
→ *Os cortes estão no lugar certo? Ex.: "Crítico" deveria começar antes de 40?*

**C) Meta de audiência** — hoje: 1 milhão de seguidores = nota 100.
→ *1M é o "topo" adequado para o porte dos artistas da Imagine?*

**D) Sensibilidade de crescimento** — hoje: ±1% de variação por coleta (~diária)
já leva a nota ao extremo.
→ *±1%/dia é a régua certa, ou é sensível/rígido demais?*

**E) Faixas de engajamento** — hoje: Instagram 0,3%–5%; YouTube 3%–1500%.
→ *Esses pisos e tetos batem com o que a Imagine considera bom engajamento?*

**F) Cadência de conteúdo** — hoje: último post com 45 dias zera a recência; 12
posts/mês satura o volume; mistura 60% recência + 40% volume.
→ *"45 dias = ruim" e "3 posts/semana = ideal" são as metas certas? O peso pende
para recência — concordam?*

**G) Carreira & Negócio (streaming)** — hoje: 500 a 800 mil streams/28d na escala
de volume; ±50% semana a semana no momentum; mistura 70% volume + 30% momentum.
→ *Os limites de volume e a sensibilidade de momentum fazem sentido para o
catálogo?*

**H) Regras de honestidade** — hoje: sem nenhum pilar de base, não há score;
crescimento só conta a partir do 2º sync; pilar ausente é reequilibrado (não
penaliza).
→ *Concordam com não exibir score sem dado, em vez de mostrar um número parcial?*

---

### Resumo dos parâmetros atuais (referência rápida)

| Parâmetro | Valor atual |
|---|---|
| Peso Audiência / Crescimento / Engajamento / Conteúdo / Carreira & Negócio | 20 / 15 / 25 / 15 / 25 % |
| Faixas (Excelente / Saudável / Atenção / Crítico) | ≥80 / 60–79 / 40–59 / <40 |
| Audiência: nota 100 em | 1.000.000 seguidores |
| Crescimento: nota 0 / 50 / 100 | −1% / 0% / +1% por coleta |
| Engajamento IG (faixa) | 0,3% – 5% |
| Engajamento YT (faixa) | 3% – 1500% |
| Conteúdo: recência zera em | 45 dias sem postar |
| Conteúdo: volume satura em | 12 posts / 30 dias |
| Conteúdo: mistura | 60% recência + 40% volume |
| Streaming: faixa de volume | 500 – 800.000 streams / 28d |
| Streaming: momentum nota 0 / 50 / 100 | −50% / estável / +50% semanal |
| Streaming: mistura | 70% volume + 30% momentum |
| Cadência de atualização | 1×/dia (cron 9h) |

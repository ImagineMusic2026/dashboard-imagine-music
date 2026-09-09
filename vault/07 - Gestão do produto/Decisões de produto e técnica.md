---
tipo: registro-de-decisoes
---

# Decisões de produto e técnica

Registre aqui decisões que evitam rediscussão no futuro. Cada nova entrada deve ter data, contexto, decisão, motivo e consequência.

## 2026-09-09 — Soundcharts consultado sob demanda, sem sincronização

**Decisão:** o painel consulta a Soundcharts no momento em que alguém pede o diagnóstico, e não por rotina agendada. Cada resultado guarda a data em que foi consultado.

**Motivo:** pedido explícito da cliente — ela só precisa do dado na hora de gerar o diagnóstico e não quer nada consultando o tempo todo. Some a rotina noturna, some a coleção de histórico e some a preocupação com cota.

**Consequência:** um estágio antigo não pode ser lido como atual, por isso a data da consulta aparece junto do resultado. Ver [[04 - Dados e integrações/Soundcharts]].

## 2026-09-09 — O estágio de carreira da Soundcharts não confere a régua da metodologia

**Decisão:** não usar o estágio de carreira que a Soundcharts atribui como validação do [[03 - Artistas/Estágio (IGE)]].

**Motivo:** foi testado no roster inteiro e não tem resolução neste recorte — 86 dos 97 artistas caem no mesmo balde, incluindo o maior. Uma escala global não distingue artistas de um selo regional brasileiro.

**Consequência:** a régua da Imagine não tem referência externa de conferência, o que reforça a necessidade das faixas oficiais. Pelo avesso, o resultado é o melhor argumento a favor de a metodologia ser calibrada regionalmente.

## 2026-09-09 — Catálogo da OneRPM consolidado pelas três contas de selo

**Decisão:** o catálogo passa a ser importado das três contas de selo de uma vez, com cada faixa registrando de qual conta veio.

**Motivo:** o catálogo antigo cobria só uma conta e deixava faixas com streaming real sem identificação. Além disso, duas das contas ainda não têm feed de streaming ligado, e sem marcar a origem não haveria como explicar por que uma faixa conhecida aparece sem nenhum play.

**Consequência:** faixa com nome e streaming zerado deixa de parecer defeito. Ver [[04 - Dados e integrações/OneRPM]].

## 2026-08-13 — Cofre separado por projeto

**Decisão:** manter o Painel Imagine em seu próprio cofre, dentro de `Desktop/Obsidian`.

**Motivo:** separar o conhecimento de cada produto e preservar um grafo focado.

**Consequência:** código e documentação operacional continuam separados; o cofre recebe conceitos, fluxos e decisões, não credenciais.

## Decisão existente — Receita em coleção separada

**Decisão:** dados financeiros ficam em `receitas/{slug}`, separados de `artistas/{slug}`.

**Motivo:** o marketing pode acompanhar o roster sem receber acesso automático ao financeiro.

**Consequência:** a regra `verReceita` protege uma fronteira de dados independente.

## Decisão existente — Score honesto com pesos reequilibrados

**Decisão:** artista sem sinal-base não recebe Health Score; pilares ausentes redistribuem pesos.

**Motivo:** evitar nota inventada e não penalizar artista por uma fonte ainda não conectada.

**Consequência:** a comparação precisa considerar quais artistas já possuem dados. Veja [[03 - Artistas/Health Score]].

## Decisão existente — Questionário externo com escopo mínimo

**Decisão:** link público responde somente a um questionário de um artista e não abre o painel.

**Motivo:** coletar informações antes do portal sem liberar dados internos.

**Consequência:** revogação remove o token e um novo compartilhamento gera outro endereço. Veja [[05 - Fluxos/Questionários públicos]].

## Decisão — Viralização mostra medição, não os vídeos

**Decisão:** a tela de Viralização mostra quantos vídeos o público fez com cada música e leva pra busca do TikTok, em vez de exibir os vídeos.

**Motivo:** nenhuma API pública lista os vídeos de um som — a Display API devolve só os da conta autorizada, e a busca por som é exclusiva da Research API, restrita a instituições acadêmicas dos EUA e da Europa. Raspar o site quebraria os Termos e o app aprovado do painel.

**Consequência:** a equipe vê tração, tendência e países por faixa; os vídeos em si continuam sendo vistos no TikTok. Veja [[01 - Produto/Viralização]].

## Decisão — Ranking do roster junto do status do sync

**Decisão:** o ranking de viralização do selo é gravado dentro de `integracoes/onerpm-tiktok`, pelo próprio sync.

**Motivo:** montar o ranking na tela custaria uma leitura por artista (~85) a cada visita, e a cota gratuita do Firestore já derrubou o painel uma vez.

**Consequência:** a lista do selo custa uma leitura e envelhece com o sync diário; o detalhe de um artista continua lendo o documento dele.

## Decisão — IGE separado do Health Score, com cobertura à vista

**Decisão:** o Estágio (IGE da metodologia IAOS v1.2) entrou como card próprio no perfil, sem alterar o Health Score.

**Motivo:** 60% do índice depende do Soundcharts, que ainda não está integrado. Trocar os pesos do Health Score agora faria a nota de 96 artistas variar em função de um estágio apurado com 40% de cobertura.

**Consequência:** o índice é calculado sobre a cobertura disponível e sempre exibe percentual coberto, marca "provisório" e ND por dimensão. Veja [[03 - Artistas/Estágio (IGE)]].

## Decisão — Fator de equilíbrio exige duas redes medidas

**Decisão:** o corte por concentração de audiência só é aplicado quando o painel mede pelo menos duas redes do artista.

**Motivo:** a regra literal jogaria 74 de 86 artistas no fator 0,40, e 71 deles têm uma rede medida — o corte puniria falha de coleta, não concentração real, contra o §8 da própria metodologia.

**Consequência:** desvio declarado na tela ("fator não aplicado") e pendente de confirmação com a Imagine.

## Decisão — Régua v1.2 entra como prévia, não como substituição

**Decisão:** o Health Score adaptativo da v1.2 foi implementado e exibido ao lado do score oficial, que permanece inalterado.

**Motivo:** a nota oficial alimenta home, lista de artistas, insights e o carimbo diário do histórico. Trocá-la agora penduraria 96 artistas num estágio apurado com 40% de cobertura e criaria um degrau no gráfico de evolução.

**Consequência:** a Imagine compara as duas réguas na tela antes de decidir; virar a chave é trocar quem chama o cálculo. Veja [[03 - Artistas/Health Score]].

## 2026-09-04 — Porte e saúde medidos separados

**Contexto:** o Health Score contava seguidores junto com engajamento e cadência, misturando "que tamanho o artista tem" com "como ele vai".

**Decisão:** a audiência saiu do Health Score e virou o componente de 30% do [[03 - Artistas/Estágio (IGE)]]. O Health Score em produção **não** mudou.

**Motivo:** é a separação que a metodologia IAOS v1.2 exige, e sem ela um artista grande e parado pontuava como um artista pequeno e crescendo.

**Consequência:** existem duas leituras no perfil, e elas respondem perguntas diferentes. A régua v1.2 aparece **ao lado** da oficial, como prévia, até a Imagine homologar as faixas — trocar a régua é decisão dela, não efeito colateral de um deploy.

## 2026-09-05 — Cronograma no lugar de só kanban

**Contexto:** a cliente pediu "algo como MS Project" para as Atividades.

**Decisão:** as demandas ganharam janela de datas, dependências, subtarefas e marcos, e o quadro passou a ter cinco visões sobre a **mesma** coleção. As colunas, o vocabulário, os campos e os modelos passaram a ser configuráveis pelo admin.

**Motivo:** um kanban responde "em que etapa está"; a pergunta da gestão era "quando acontece e o que trava o quê".

**Consequência:** a configuração é única para o time — não há quadro pessoal, e mudar uma coluna muda a tela de todos. O caminho crítico é a corrente mais longa pela duração planejada, não a folga total do MS Project; a simplificação está registrada em [[01 - Produto/Atividades]].

## 2026-09-05 — Situação de evidência é derivada, nunca gravada

**Contexto:** o documento de cadastro-base pede que release, presskit e afins tenham status "disponível / desatualizado / ausente".

**Decisão:** o painel grava **quando** alguém conferiu o link e calcula o status na tela, com janela de 180 dias. A única exceção é a situação do catálogo, gravada com data e responsável.

**Motivo:** status gravado envelhece sozinho — um presskit marcado como "disponível" em março continuaria dizendo isso em dezembro. Já era a escolha feita na situação dos contratos.

**Consequência:** os carimbos precisam vir do servidor, senão o status derivado deixa de significar algo. E a janela de 180 dias é uma escolha nossa, aberta a revisão: o documento pede o status mas não define o prazo.

## 2026-09-05 — Patrimônio artístico em subcoleção

**Contexto:** o inventário (IPI, IPN, licenciamento, parecer "Restrito") foi primeiro modelado como um campo dentro de `projetos/{slug}`, com a permissão aplicada só na escrita e na tela.

**Decisão:** movido para `projetos/{slug}/patrimonio/inventario`, com leitura sob `contratos`.

**Motivo:** `projetos/{slug}` libera leitura para toda a equipe e regra do Firestore é **por documento** — não esconde campo. Quem tivesse `editarArtistas` receberia titularidade e licenciamento no navegador, mesmo com o bloco escondido na tela. Esconder na interface não é fronteira.

**Consequência:** custa uma leitura a mais por perfil aberto, e só para quem tem `contratos`. É o mesmo movimento que os contratos já haviam feito, pelo mesmo motivo.

## 2026-09-05 — Agenda como link, não como cadastro de shows

**Contexto:** o documento pedia, em páginas seguidas, o link do Google Calendar e o cálculo de volume, recorrência, sazonalidade, público/privado e distribuição geográfica.

**Decisão:** a cliente escolheu o link.

**Motivo:** menos trabalho para a equipe, e a agenda já existe fora do painel.

**Consequência:** **os cinco cálculos não saem de um link.** Enquanto for assim, a medida de palco é a declaração de Mercado ao Vivo. Registrado aqui para não virar expectativa frustrada mais adiante.

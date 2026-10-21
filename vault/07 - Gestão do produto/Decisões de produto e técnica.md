---
tipo: registro-de-decisoes
---

# Decisões de produto e técnica

Registre aqui decisões que evitam rediscussão no futuro. Cada nova entrada deve ter data, contexto, decisão, motivo e consequência.

## 2026-10-21 — Colaborador é um papel à parte, fora da equipe

**Contexto:** a cliente quis dar acesso a um designer só ao quadro de Atividades e sugeriu uma opção "Outros" com caixas do que a pessoa pode ver. A matriz de permissões já existia, mas só valia em cima de marketing, e ser da equipe dá acesso fixo a artistas, métricas e ao time.

**Decisão:** novo papel `colaborador`, fora de `isStaff()`, que só recebe as áreas marcadas no convite. Nas Atividades ele vê e mexe só nas demandas em que é o responsável (resposta da cliente).

**Motivo:** convidar como marketing e desligar chaves deixaria o designer lendo o roster, os projetos, as métricas e a lista do time pelo navegador. Esconder menu não é fronteira; a regra do Firestore é por documento.

**Consequência:** cada área nova para o colaborador exige antes uma fronteira própria nas regras. Por isso a fase 1 tem só Atividades.

## 2026-10-21 — Convite não pode ser alterado pelo convidado

**Contexto:** ao desenhar o colaborador, a leitura das regras mostrou que quem tinha o link de um convite podia trocar o papel do próprio convite para admin antes do aceite, e gravar um mapa de permissões próprio no perfil. Até um artista convidado podia se dar acesso à receita de todo o roster.

**Decisão:** o convidado só marca o convite como aceito, no mesmo lote em que o perfil nasce. O perfil não aceita campos além dos do convite, e as permissões têm de ser exatamente as do convite. Receita, importação e agenda passaram a exigir ser da equipe.

**Motivo:** o papel vinha do convite, e o convite era editável por quem o recebia.

**Consequência:** o aceite agora é uma gravação única (perfil e convite juntos). Os casos de abuso ficaram cobertos por um teste de regras no emulador.

## 2026-09-09 — Perfil do artista em abas, montando só a aberta

**Decisão:** o perfil deixa de ser uma rolagem com dezesseis cards e passa a ter cinco abas, com apenas a aba ativa montada.

**Motivo:** custo, não estética. Cada card lê os próprios dados e a conta está no plano gratuito. Abrir o perfil do maior artista custava 740 leituras; com os fonogramas sob demanda caiu para 431, e com as abas para 82. Esconder com CSS não resolveria — o componente monta e lê igual.

**Consequência:** alertas e o comparativo apontam para cards que podem estar em outra aba, então a navegação passa a trocar de aba, expandir e rolar, nessa ordem. "O que merece atenção" fica na primeira aba de propósito: é o único bloco que avisa antes de alguém procurar. Ver [[06 - Tecnologia/Custo de leitura do Firestore]] e [[03 - Artistas/Perfil do artista]].

## 2026-09-09 — Exportação em texto para IA, não em PDF

**Decisão:** a exportação do artista sai em texto estruturado (para colar num assistente) e em planilha (para o Excel). PDF foi descartado.

**Motivo:** o destino define o formato. Paginação e diagramação viram ruído para uma IA, que gasta atenção decifrando a forma em vez do conteúdo. A cliente pediu exatamente para jogar os dados num assistente e pedir análise.

**Consequência:** onde não há medição o documento escreve "não medido" em vez de zero, e todo número carrega a janela e a fonte — sem isso a IA conclui ausência de público a partir de ausência de coleta. Ver [[03 - Artistas/Exportar dados do artista]].

## 2026-09-09 — Artistas das contas irmãs entram pelo critério da conta

**Decisão:** os artistas das contas irmãs da Imagine na OneRPM entram no roster; os performers que só assinam álbum na conta principal, não.

**Motivo:** contar faixas seria o critério errado. Entre quem assina álbum na conta principal sem estar no roster há Maiara & Maraisa, Zé Neto & Cristiano e Tierry — eles assinam porque a faixa é dividida, não porque pertencem ao casting.

**Consequência:** roster de 98 para 110, com 288 faixas que estavam sem dono. Os novos nascem sem redes cadastradas e sem streaming, até as credenciais das contas irmãs chegarem. Ver [[03 - Artistas/Gestão de artistas]].

## 2026-09-09 — Airplay cai para 5% no IGE, contra a v1.2

**Decisão:** os pesos do índice passam a ser audiência 35%, consumo 45%, mercado ao vivo 15% e airplay 5%. A metodologia v1.2 fixa 30/40/20/10.

**Motivo:** medido no roster real, o airplay a 20% não ordenava ninguém — 15 dos 97 artistas têm execução de rádio em doze meses, 81,6% dela num único artista, e os outros 82 empatavam em zero. Um componente onde 85% do roster empata só subtrai a mesma nota de quase todos. A causa provável é a fonte não monitorar rádio regional do Nordeste, não os artistas não tocarem.

A cliente propôs inverter airplay e mercado ao vivo, ou limitar airplay a 5%. Preferimos a segunda: a Soundcharts tem show registrado para apenas 2 dos 97 artistas, então mercado ao vivo continua sendo dado declaratório sem corroboração externa — a mesma ressalva que a levou a limitá-lo a 10% originalmente. Subiu a 15%, não a 20%.

**Consequência:** um artista com airplay medido e quase nulo perde 2,9 pontos em vez de 12. Sem o Soundcharts ligado, a cobertura máxima do índice sobe de 40% para 50%. As faixas de conversão do airplay continuam erradas por ordens de grandeza — peso menor reduz o estrago, não corrige a causa. Ver [[03 - Artistas/Estágio (IGE)]].

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

---
tipo: tela
rota: /artistas/[slug]
metodologia: IAOS — Cadastro-base do projeto/artista
---

# Dossiê do artista — Alavancas estratégicas

Bloco no perfil do artista onde a equipe mantém, ao longo do tempo, as evidências que o IAOS pede. Vem do documento **"Cadastro-base do projeto/artista"** enviado pela Imagine em 05/09/2026.

A decisão que molda o bloco inteiro é da cliente: *"a ideia é que eles fiquem dentro do painel e não inseridos no momento do cadastro"*. Ou seja, **não** é um formulário de cadastro maior — é uma ficha que se preenche aos poucos, e cujo valor está em mostrar o que ainda falta.

O **Mercado ao Vivo**, que no documento é a quinta evidência de Expansão, não mora aqui: não é link e tem nota que entra no índice, então fica em [[03 - Artistas/Estágio (IGE)]].

## Os cinco blocos

| Bloco | Conteúdo | Onde é gravado |
| --- | --- | --- |
| Cadastro-base | Data de entrada no IAOS, Soundcharts Artist ID, ImagineBio, ImagineUp | `artistas/{slug}` |
| Equipe responsável | Quem da Imagine atende o artista (até 12 pessoas) | `projetos/{slug}` |
| Expansão de mercado | Agenda, release, presskit, notoriedade | `projetos/{slug}` |
| Crescimento digital | Painel de mídia paga: link, plataforma e período | `projetos/{slug}` |
| Patrimônio artístico | IPI, IPN, editora, sociedade, obras, masters, situação do catálogo | `projetos/{slug}/patrimonio/inventario` |

## Situação das evidências

Cada link de Expansão aparece como **disponível**, **desatualizado** ou **ausente**. Essa palavra **não é gravada**: o painel guarda quando alguém conferiu o link e deriva o resto, com a janela em 180 dias.

Gravar o status faria ele envelhecer sozinho — um presskit marcado como "disponível" em março continuaria dizendo isso em dezembro. É a mesma escolha já feita na situação dos contratos.

A única exceção é a **situação do catálogo** (Liberado / Parcial / Restrito / Não verificado). Ali o valor é gravado, com data e responsável, porque é parecer de titularidade: "Restrito" não deixa de ser verdade porque seis meses passaram.

O carimbo de quem conferiu vem do **servidor**, nunca do navegador, e só é renovado quando a URL muda de fato. Se viesse no pedido, qualquer um marcaria um link de 2024 como conferido hoje e o status derivado viraria ficção.

## Regra de acesso

O dossiê exige **editarArtistas** (admin e marketing por padrão). O inventário de patrimônio exige **contratos** (admin por padrão), tanto para ver quanto para gravar — decisão da cliente em 05/09/2026.

O patrimônio mora numa **subcoleção**, e não num campo de `projetos/{slug}`, porque aquele documento libera leitura para toda a equipe e regra do Firestore é por documento: não esconde campo. Dentro dele, titularidade e licenciamento chegariam inteiros ao navegador de quem tem só `editarArtistas`. É o mesmo movimento que os contratos já fizeram. Ver [[06 - Tecnologia/Rotas e fronteiras de acesso]].

Toda escrita passa por `POST /api/artistas/dossie`, com a permissão escolhida por bloco no servidor.

## Notas de operação

- **Sem upload.** Onde o documento pede "links comprobatórios", guarda-se a URL — o projeto não tem Firebase Storage. Quem abrir o link precisa ter acesso à pasta no Drive.
- **Agenda é um link** do Google Calendar, escolha da cliente. Consequência a alinhar: volume, recorrência, sazonalidade, público/privado e distribuição geográfica **não saem de um link**. Enquanto for assim, a medida de palco é a declaração de Mercado ao Vivo.
- **Soundcharts e ImagineUp ficam vazios** por ora — o primeiro espera assinatura, o segundo espera o aplicativo existir.
- **Fonogramas como intérprete e a lista de ISRCs não são campo manual**: saem do catálogo, no card de Fonogramas. Contratos e licenças ficam no card de Contratos.
- O botão de editar fica desabilitado enquanto a leitura não volta. É de propósito: abrir o formulário antes disso mostraria campos vazios de dados que existem, e salvar gravaria esse vazio por cima.

## Pendências do documento

- O documento **pula do item 3 para o item 5** — ou é resíduo de numeração, ou falta uma alavanca no arquivo enviado.
- A janela de 180 dias para "desatualizado" foi escolha nossa; o documento pede o status mas não diz o prazo.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

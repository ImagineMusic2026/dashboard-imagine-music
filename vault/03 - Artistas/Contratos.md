---
tipo: recurso-interno
visibilidade: staff
---

# Contratos

A ficha de contrato de cada artista e, desde 11/2026, a **emissão e a assinatura** do contrato pelo próprio painel. Fica na aba **Receita** do perfil, atrás da capacidade `contratos` — admin por padrão, marketing fechado. O artista não vê nada disso, nem pelo portal.

## Duas origens

| Origem | O que é |
| --- | --- |
| **Anexado** | O de sempre: a ficha (tipo, vigência, percentual, observações) com um **link** para o PDF que já vive no Drive. O painel não guarda arquivo. |
| **Gerado** | Emitido a partir de um modelo. O texto, os campos preenchidos e as duas assinaturas moram dentro do próprio documento do contrato. |

A **situação** de cada documento (vigente, a vencer, vencido, encerrado, a iniciar) é calculada pelas datas. O **estado** do contrato gerado (rascunho, aguardando o artista, falta a Imagine, assinado) é calculado pelas assinaturas e pelo link ativo.

## Status do contrato do artista

Em **Receita → Contratos**, a equipe pode selecionar e salvar **Contrato ativo**, **Sem contrato**, **Aguardando assinatura** ou **Renovação de contrato**. O acompanhamento é manual e fica disponível mesmo sem um documento cadastrado, inclusive para contratos tratados fora do painel. O campo começa sem seleção até a equipe registrar o status. Datas, assinaturas e estados dos documentos seguem seus próprios fluxos.

O status fica em `projetos/{slug}/acompanhamentoContratual/status` e usa a capacidade `contratos` para leitura e escrita.

## Modelos

Editáveis só pelo admin em **Configurações › Modelos de contrato**. O contrato é texto comum, com `{{chave}}` onde varia; cada chave vira um campo marcado como "a equipe preenche" (ao emitir) ou "o artista preenche" (pelo link). A tela acusa variável citada sem campo e campo que o texto não usa.

Linha inteira em MAIÚSCULAS vira título. Não há sintaxe para aprender — quem escreve o modelo escreve o contrato, e é assim que contrato se escreve. **Não há tabela**: os anexos do contrato de distribuição que eram grade (catálogo de fonogramas, plano de marketing) viraram campos de texto.

Algumas variáveis o painel preenche sozinho e não viram campo: `artista_nome`, `vigencia_inicio`, `vigencia_fim`, `percentual`, `data_hoje`, `foro` e os dados da Imagine (`empresa_razao_social`, `empresa_cnpj`, `empresa_endereco`, `empresa_email`).

**O modelo é copiado, não vinculado.** Ao emitir, o texto e a definição dos campos entram no documento do contrato. Editar o modelo depois não muda nada do que já foi emitido — é a mesma regra dos modelos de projeto do quadro, e aqui ela é o que impede um contrato assinado de mudar sozinho. Pelo mesmo motivo a data que sai no documento fica congelada em `emitidoEm`: calculada na hora de desenhar, o PDF regerado no ano que vem traria outra data e o código de verificação deixaria de bater.

O contrato de distribuição da cliente está cadastrado como modelo. **Ele não está no código** — o repositório é público.

## O fluxo

1. A equipe abre o card Contratos e clica em **Gerar contrato**: escolhe o modelo, preenche vigência, percentual e os campos da equipe, e confere a prévia.
2. Ao emitir, o painel cria o contrato e o **link público**, que já vai para a área de transferência. Manda-se por WhatsApp.
3. O artista abre `/c/{token}` sem login, lê o contrato (que se preenche conforme ele digita), preenche os dados dele, assina num quadro de desenho e marca o aceite.
4. Um admin **contra-assina pelo painel**.
5. Qualquer um dos dois baixa o PDF.

## A assinatura

É assinatura eletrônica **simples** (MP nº 2.200-2/2001 e Lei nº 14.063/2020), feita pelo próprio painel, sem serviço externo. O que a sustenta é a trilha, e ela é carimbada pelo **servidor**, nunca pelo navegador: data, IP, user-agent e o **SHA-256 do texto renderizado** no instante da assinatura. É o hash que prova depois que o documento não mudou; ele sai no bloco de auditoria do PDF.

As duas assinaturas são calculadas por rotas diferentes, cada uma renderizando o contrato por conta própria a partir do banco — e chegam ao mesmo hash. Se um dia divergirem, a causa é renderização, não assinatura.

O link vale por **uma** assinatura: reenviar devolve 409. A Imagine só contra-assina depois do artista — contra-assinar antes registraria um acordo que não houve.

## O PDF

Sai pela **impressão do navegador** ("Salvar como PDF"), como o do questionário. Sem biblioteca de PDF e sem Storage: o documento é **regerado** sob demanda a partir do que está no Firestore (texto copiado, valores e assinaturas). É por isso que a decisão de não ter Storage continua de pé mesmo com contrato assinado dentro do painel — nada aqui é arquivo.

## Notas de operação

- **O link é a credencial.** O público nunca lê o Firestore: quem resolve o token é a rota, com Admin SDK. Revogar apaga o documento do link e o endereço morre na hora.
- **Regra do Firestore não roda no Admin SDK**, então a validação da rota pública é a única que existe: só as chaves que o modelo declarou como do artista, obrigatórios conferidos, aceite exigido e teto no tamanho da imagem.
- Apagar o contrato revoga o link junto — token apontando para contrato apagado abriria uma página de assinatura sem documento.
- Se a criação do link falhar depois de o contrato já existir, o contrato **não** é emitido de novo: o card oferece "Gerar o link de assinatura".
- A contra-assinatura passa por rota, então o cache de leitura do cliente precisa ser derrubado na mão — sem isso o card segue dizendo "falta a Imagine" por até cinco minutos.
- O link do questionário e o do contrato são coleções diferentes e capacidades diferentes: aquele é de `editarArtistas`, este é de `contratos`.

Veja [[06 - Tecnologia/Modelo de dados Firestore]], [[06 - Tecnologia/Rotas e fronteiras de acesso]] e [[02 - Acesso e equipe/Perfis e permissões]].

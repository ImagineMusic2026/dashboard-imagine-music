---
tipo: arquitetura
camada: dados
---

# Modelo de dados Firestore

Firestore é o banco central. Leituras no cliente respeitam regras; dados sensíveis e escritas de serviço ocorrem por Admin SDK.

## Coleções principais

| Coleção                                    | Finalidade                                                              | Observação de acesso                        |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------- |
| `artistas/{slug}`                          | Cadastro e redes vinculadas.                                            | Staff ou artista dono do slug lê.           |
| `projetos/{slug}`                          | Dados comerciais internos: conta do selo, e-mail, serviços e anotações. | Somente staff lê.                           |
| `receitas/{slug}`                          | Receita OneRPM agregada.                                                | Sensível; exige `verReceita`.               |
| `users/{uid}`                              | Perfil, papel, ativo, vínculo e overrides.                              | Pessoa lê a si; staff lê a equipe.          |
| `convites/{token}`                         | Convites de acesso. O de colaborador traz `permissoes` (as áreas).      | Link por token; listagem restrita.          |
| `agenda/{id}`                              | Releases, shows, contratos e reuniões.                                  | Quem tem `agenda` lê e altera.              |
| `integracoes/{doc}`                        | Status de Meta, TikTok, YouTube e OneRPM.                               | Staff lê; servidor escreve.                 |
| `configuracoes/{doc}`                      | Configurações gerais e a do quadro de atividades.                       | Membro ativo lê; admin escreve.             |
| `atividades/{id}`                          | Demandas do quadro: etapa, datas, dependências, subtarefas, checklist.  | Quem tem `atividades` lê e altera.          |
| `diagnosticos/{slug}/questionarios/{tipo}` | Respostas Projeto/Artista.                                              | Staff ou artista vinculado.                 |
| `links-questionario/{token}`               | Token de formulário externo.                                            | A API valida; o público não lê diretamente. |

## Subcoleções que existem para separar acesso

Regra do Firestore é **por documento** e não esconde campo. Quando parte de um documento precisa de uma fronteira mais estreita que o resto, ela vira subcoleção:

| Subcoleção | Por quê |
| --- | --- |
| `projetos/{slug}/contratos/{id}` | Vigência, percentual e o PDF assinado exigem `contratos`, enquanto o projeto inteiro é legível por toda a equipe. |
| `projetos/{slug}/patrimonio/inventario` | Mesma razão: IPI, IPN, licenciamento e o parecer "Restrito" exigem `contratos`. Ver [[03 - Artistas/Dossiê do artista]]. |
| `atividades/{id}/comentarios/{id}` | Aqui o motivo é **custo**, não sigilo: comentários viajariam em toda leitura do quadro. O card mostra só o contador denormalizado `qtdComentarios`; o fio só é lido ao abrir a demanda. |

## Campos acrescentados em 09/2026

`artistas/{slug}` ganhou `imagineBio`, `imagineUp`, `soundchartsId` e `entradaIaos` — fatos públicos do artista, que ele enxerga no portal.

`projetos/{slug}` ganhou `mercadoAoVivo` (nível, score, data da avaliação, responsável e observação), `equipe`, `expansao` e `digital`. São juízo da equipe **sobre** o artista, e por isso ficam do lado que ele não lê.

`configuracoes/atividades` guarda o quadro configurável: etapas, tipos, áreas, etiquetas, campos ligados, visões e modelos de projeto. Um documento só, cacheado — nada de uma coleção com um documento por coluna.

## Métricas sociais

`metricas-sociais/{slug}` guarda o snapshot atual e subcoleções diárias: Instagram, TikTok, YouTube, Health Score e streaming. `streaming-detalhe/atual` mantém o top 150 de faixas e top 25 de países do último recorte.

## Segurança essencial

- `receitas` é separada de `artistas` para permitir roster sem financeiro.
- Tokens de TikTok e YouTube nunca podem ser lidos pelo cliente.
- Coleções não declaradas nas regras caem em bloqueio total.
- Upserts usam merge; o detalhe atual do streaming é sobrescrito por completo a cada sync.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Arquitetura técnica]].

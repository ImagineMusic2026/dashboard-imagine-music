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
| `convites/{token}`                         | Convites de acesso.                                                     | Link por token; listagem restrita.          |
| `agenda/{id}`                              | Releases, shows, contratos e reuniões.                                  | Quem tem `agenda` lê e altera.              |
| `integracoes/{doc}`                        | Status de Meta, TikTok, YouTube e OneRPM.                               | Staff lê; servidor escreve.                 |
| `configuracoes/{doc}`                      | Configurações gerais, como WhatsApp do portal.                          | Membro ativo lê; admin escreve.             |
| `diagnosticos/{slug}/questionarios/{tipo}` | Respostas Projeto/Artista.                                              | Staff ou artista vinculado.                 |
| `links-questionario/{token}`               | Token de formulário externo.                                            | A API valida; o público não lê diretamente. |

## Métricas sociais

`metricas-sociais/{slug}` guarda o snapshot atual e subcoleções diárias: Instagram, TikTok, YouTube, Health Score e streaming. `streaming-detalhe/atual` mantém o top 150 de faixas e top 25 de países do último recorte.

## Segurança essencial

- `receitas` é separada de `artistas` para permitir roster sem financeiro.
- Tokens de TikTok e YouTube nunca podem ser lidos pelo cliente.
- Coleções não declaradas nas regras caem em bloqueio total.
- Upserts usam merge; o detalhe atual do streaming é sobrescrito por completo a cada sync.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Arquitetura técnica]].

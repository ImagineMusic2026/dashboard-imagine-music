---
tipo: regra-de-negocio
tema: acesso
---

# Perfis e permissões

O painel não possui cadastro público. O acesso da equipe começa por convite.

| Perfil | Papel geral |
| --- | --- |
| `admin` | Acesso total, inclusive gestão da equipe e convites. |
| `marketing` | Acesso operacional parcial; não visualiza receita dos artistas. |
| `colaborador` | Pessoa de fora do time fixo (ex.: um designer). Entra só nas áreas marcadas no convite. |
| Artista | Acessa o portal próprio, perfil e diagnósticos vinculados. |

## Regras importantes

- Marketing pode criar e editar artistas quando possui a capacidade `editarArtistas`.
- Exclusão de artista é restrita ao admin.
- As regras do Firestore reforçam a autorização além da interface.
- Convites de artistas e convites de membros da equipe são fluxos distintos.

## Colaborador

Pedido da cliente em 21/10/2026: dar acesso a um designer só ao quadro de Atividades.

- **Não é equipe.** Não vê artistas, métricas, receita, alertas, busca global nem o time. No menu aparecem só as áreas dele e Configurações, onde fica apenas a aba Perfil.
- **Áreas concedíveis.** Hoje só Atividades, porque é a única área com fronteira própria nas regras do Firestore. Liberar outra área exige antes transformar a leitura dela, que hoje é "de equipe", em capacidade nas regras.
- **Atividades recortadas.** Ele vê, cria, edita, move, comenta e exclui **só as demandas em que é o responsável**. O que ele cria fica com ele, e ele não repassa a demanda. Demanda mãe e antecessoras também têm de ser dele: não pendura nada em projeto da equipe nem desmonta a sequência que a equipe montou.
- **Sem padrão.** O papel nasce sem nenhuma capacidade; o convite liga as áreas. Na matriz de permissões ele só tem chave nas áreas concedíveis, e não há "restaurar padrão", que tiraria todo o acesso.
- A equipe atribui demandas a ele pelo campo Responsável, onde ele aparece junto do time.

Veja: [[05 - Fluxos/Convites e acesso]], [[03 - Artistas/Gestão de artistas]] e [[06 - Tecnologia/Arquitetura técnica]].

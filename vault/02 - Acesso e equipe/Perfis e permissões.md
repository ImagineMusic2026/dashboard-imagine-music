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
| Artista | Acessa o portal próprio, perfil e diagnósticos vinculados. |

## Regras importantes

- Marketing pode criar e editar artistas quando possui a capacidade `editarArtistas`.
- Exclusão de artista é restrita ao admin.
- As regras do Firestore reforçam a autorização além da interface.
- Convites de artistas e convites de membros da equipe são fluxos distintos.

Veja: [[05 - Fluxos/Convites e acesso]], [[03 - Artistas/Gestão de artistas]] e [[06 - Tecnologia/Arquitetura técnica]].

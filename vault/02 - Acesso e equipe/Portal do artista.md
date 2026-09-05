---
tipo: experiencia
publico: artista
---

# Portal do artista

O portal é a experiência isolada para quem possui o papel `artista`. Ele não abre o dashboard da equipe.

## Acesso

- Após login, artista é direcionado para `/meu-perfil`.
- O acesso é ligado a um único `artistaSlug` escolhido no convite.
- Um artista sem vínculo vê o estado de perfil ainda não vinculado e deve falar com a equipe.

## O que pode fazer

- Consultar o próprio perfil e dados liberados a ele.
- Preencher diagnósticos Projeto e Artista.
- Conectar ou desconectar a própria conta TikTok e camada Analytics do YouTube.

## O que não pode fazer

Não acessa Home, roster, receita, configurações, agenda ou dados de outros artistas.

O guard do portal bloqueia membros da equipe e o guard do dashboard redireciona artistas para cá. Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[03 - Artistas/Perfil do artista]].

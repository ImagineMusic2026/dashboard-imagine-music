---
tipo: tela
rota: /artistas/[id]
---

# Perfil do artista

É a ficha consolidada do artista. O slug interno permanece estável mesmo que nome ou descrição mudem, preservando os dados relacionados.

## Cards e dados

- [[03 - Artistas/Health Score]]: nota, cinco pilares e evolução histórica quando já existem ao menos dois dias de dados.
- Redes sociais: última coleta de Instagram, TikTok e YouTube; visível à equipe.
- Streaming OneRPM: plays, skips, histórico, plataforma, país, faixas e skip rate; visível à equipe.
- Receita: resumo financeiro por plataforma; exibido somente a quem tem `verReceita`.
- Redes cadastradas: links de Spotify, YouTube, Instagram e TikTok.
- [[03 - Artistas/Diagnósticos e questionários]]: questionários Projeto e Artista.

## Ações

- Favoritar artista: estrela pessoal da pessoa logada, para reencontrá-lo pela lista de favoritos.
- Criar ou editar artista: capacidade `editarArtistas`.
- Excluir artista: somente admin.
- Gerar/revogar conexão TikTok ou YouTube para um artista: capacidade `conexoesArtista`.

Veja [[03 - Artistas/Gestão de artistas]], [[04 - Dados e integrações/Integrações]] e [[02 - Acesso e equipe/Perfis e permissões]].

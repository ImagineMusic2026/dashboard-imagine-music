---
tipo: recurso
---

# Diagnósticos e questionários

Cada artista possui dois questionários de estruturação: **Projeto** e **Artista**. Eles registram progresso, origem da resposta (artista ou equipe) e data de envio.

## No perfil interno

Quem possui `editarArtistas` pode preencher, editar, visualizar respostas e exportá-las em PDF.

## Link externo sem login

1. A equipe gera um link específico para um artista e um tipo de questionário.
2. O destinatário abre `/q/{token}` e responde o mesmo formulário, sem ver outra área do painel.
3. A resposta é salva como origem `artista` e gera o alerta de questionário respondido.
4. Ao revogar, o documento do link é removido; o endereço antigo não volta a funcionar. Gerar novamente cria um token novo.

O link não permite acessar dados do painel, somente aquele formulário. Veja [[05 - Fluxos/Questionários públicos]] e [[06 - Tecnologia/Modelo de dados Firestore]].

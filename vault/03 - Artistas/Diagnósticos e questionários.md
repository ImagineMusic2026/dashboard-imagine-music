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

O link não permite acessar dados do painel, somente aquele formulário.

## Data de nascimento

O questionário Artista abre com a pergunta de data de nascimento, num campo de data. Quando o questionário é **enviado**, a resposta vai para o cadastro do artista, onde alimenta o alerta de aniversário. Rascunho não leva nada.

- Pelo link público, a própria rota do link faz a cópia no envio.
- Pelo portal e pelo painel, o formulário chama uma rota do servidor depois do envio.
- Nos dois caminhos a cópia parte do questionário **gravado**, e não do formulário: a data nunca vem do navegador, e a que já estava gravada (respondida em outra aba, ou pela equipe) também vai.
- O questionário preenche o cadastro vazio e atualiza o que ele mesmo gravou antes. **Data digitada pela equipe no cadastro fica**, e a que a equipe apagou também não volta — se o artista responder outra, a equipe vê no questionário e decide. Resposta vazia nunca apaga a data do cadastro.
- O questionário Artista passou de 22 para 23 perguntas. Quem já tinha completado aparece com 22 de 23 até responder a data; o selo de enviado e o alerta de questionário respondido não mudam.
- A data fica de fora da exportação para IA (ver [[03 - Artistas/Exportar dados do artista]]). Veja [[05 - Fluxos/Questionários públicos]] e [[06 - Tecnologia/Modelo de dados Firestore]].

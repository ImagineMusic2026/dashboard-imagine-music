---
tipo: recurso-interno
visibilidade: staff
---

# Projeto comercial interno

É o lado comercial do cadastro de artista, separado da ficha pública para a equipe. O artista não pode vê-lo nem pelo portal.

## Informações possíveis

- Conta do artista no selo.
- E-mail do projeto.
- Serviços previstos.
- Anotações gerais da equipe.

## Por que é separado

Essas informações ficam em `projetos/{slug}`, e não em `artistas/{slug}`, porque regras do Firestore protegem documentos inteiros — não campos individuais. Assim, o portal pode ler o cadastro do próprio artista sem expor notas internas da equipe.

O card só aparece para staff e quando há alguma informação preenchida. Veja [[03 - Artistas/Perfil do artista]] e [[06 - Tecnologia/Modelo de dados Firestore]].

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

## Serviços previstos

Em **Artistas → Novo artista** ou **Perfil do artista → Editar**, a seção **Serviços previstos** marca os serviços daquele artista. A lista oferecida é o **catálogo do painel**, igual para todos.

O catálogo é editado em **Configurações → Artistas**, e só por admin. Foi pedido da cliente em 11/2026: até então um serviço novo era digitado dentro da ficha de um artista e só existia lá — o serviço criado para o Fulano não aparecia para marcar no Beltrano. O que se grava no artista é a **chave** do serviço, e o rótulo vem sempre do catálogo (ver [[06 - Tecnologia/Modelo de dados Firestore]] para o porquê). Cadastro antigo, que gravou o nome, continua casando pela mesma chave.

Três consequências:

- **Renomear é seguro a qualquer momento.** Só o rótulo muda; todo artista que já tinha o serviço continua com ele, com o nome novo, sem migração.
- **Serviço em uso não é removido.** A configuração mostra quantos artistas dependem dele e bloqueia — é a mesma regra das colunas do quadro. Se a conferência de uso não carregar, a remoção também fica bloqueada.
- **A ordem do catálogo é a ordem da coluna Serviços** na lista de artistas. Reordenar ali reordena a coluna inteira.

Serviço que um artista tem e que não está no catálogo — ficha de antes de 11/2026, ou serviço retirado da lista depois — aparece no formulário num bloco **Fora do catálogo**, marcado, e sai no X. Na configuração ele aparece com um botão que o traz para a lista, que é o caminho de "criei isso num artista e agora quero em todos" sem redigitar.

## Por que é separado

Essas informações ficam em `projetos/{slug}`, e não em `artistas/{slug}`, porque regras do Firestore protegem documentos inteiros — não campos individuais. Assim, o portal pode ler o cadastro do próprio artista sem expor notas internas da equipe.

O card só aparece para staff e quando há alguma informação preenchida. Veja [[03 - Artistas/Perfil do artista]] e [[06 - Tecnologia/Modelo de dados Firestore]].

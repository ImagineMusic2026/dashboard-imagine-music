---
tipo: arquitetura
---

# Rotas e fronteiras de acesso

## Públicas

- `/` — landing.
- `/login` e `/aceitar-convite`.
- `/q/{token}` — questionário externo limitado ao token.
- `/privacidade`, `/termos`, callbacks de conexão TikTok e YouTube.

## Área da equipe

`/home`, `/artistas`, perfil de artista, `/alertas`, `/conteudo`, `/agenda`, `/importar`, `/integracoes` e `/configuracoes`.

## Portal do artista

`/meu-perfil` e rotas de diagnóstico do artista logado.

## Proteção em três níveis

1. **Interface:** provider de autenticação e gates escondem ações sem capacidade.
2. **Servidor:** rotas internas validam token Firebase, papel e capacidade.
3. **Firestore:** regras impedem leitura/escrita fora do permitido.

Não existe middleware central; guards client-side, APIs e regras trabalham juntos. Isso não dispensa validar a autorização no servidor antes de cada operação sensível.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

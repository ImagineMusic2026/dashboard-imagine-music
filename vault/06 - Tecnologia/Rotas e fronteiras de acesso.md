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

## Escritas que passam obrigatoriamente pelo servidor

`projetos/{slug}` e `artistas/{slug}` negam escrita pelo navegador. O que a equipe edita nessas coleções vai por rota com Admin SDK:

| Rota | O que grava | Permissão |
| --- | --- | --- |
| `POST /api/artistas/dossie` | Os cinco blocos do dossiê | `editarArtistas`, exceto `patrimonio`, que exige `contratos` |
| `POST /api/artistas/mercado-ao-vivo` | Nível declarado, com score da tabela oficial | `editarArtistas` |

Dois motivos para não abrir essas escritas ao cliente: a **nota** do mercado ao vivo tem que vir da tabela oficial e não do navegador, e os **carimbos** de quem conferiu e quando sustentam o status derivado das evidências — se viessem no corpo do pedido, deixariam de significar algo.

## Proteção em três níveis

1. **Interface:** provider de autenticação e gates escondem ações sem capacidade.
2. **Servidor:** rotas internas validam token Firebase, papel e capacidade.
3. **Firestore:** regras impedem leitura/escrita fora do permitido.

Não existe middleware central; guards client-side, APIs e regras trabalham juntos. Isso não dispensa validar a autorização no servidor antes de cada operação sensível.

Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

---
tipo: fluxo
---

# Questionários públicos

Questionários permitem coletar um diagnóstico de um artista através de um link público com token.

## Fluxo

1. A equipe gera ou compartilha o link do questionário.
2. A pessoa responde pela rota pública.
3. As respostas ficam relacionadas ao diagnóstico/artista.

## Comportamentos importantes

- Um token revogado retorna 404.
- Uma falha temporária deve ter estado próprio; ela não deve ser apresentada como “link inativo”.
- Os links públicos usam o conceito de `links-questionario/{token}` e são resolvidos pelo painel antes de abrir a página pública.

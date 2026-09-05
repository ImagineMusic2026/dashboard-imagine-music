---
tipo: integracao
plataforma: Meta-Instagram
---

# Meta e Instagram

## Modelo de acesso

Usa um token central de System User do Business Manager para ler todas as contas do Instagram que foram atribuídas. Não há login individual do artista para essa integração.

## Operação

1. Quem tem `integracoes` usa **Descobrir contas**.
2. O painel relaciona `@handle` ao IG User ID e grava o vínculo no artista.
3. A sincronização coleta seguidores, alcance, visualizações, engajamento e posts.
4. O snapshot e o histórico diário alimentam perfil, alertas e Health Score.

O token é usado com `appsecret_proof`. Status e possíveis erros aparecem no card de integrações. Veja [[04 - Dados e integrações/Integrações]] e [[06 - Tecnologia/Coletas e jobs diários]].

---
tipo: integracao
plataforma: YouTube
---

# YouTube

## Duas camadas

| Camada | Acesso | Dados |
| --- | --- | --- |
| Data API pública | Chave da Imagine; qualquer canal mapeado. | Inscritos, visualizações, vídeos e engajamento. |
| Analytics privada | OAuth do artista. | Tempo de exibição, retenção e inscritos ganhos/perdidos. |

## Operação

- A equipe com `integracoes` descobre canais por URL ou handle, associa o `channelId` e sincroniza.
- O artista pode conectar ou desconectar sua própria camada Analytics pelo perfil/portal.
- Desconectar remove tokens de Analytics, mas a coleta pública do canal mapeado continua.

Os tokens Analytics são server-only. Veja [[04 - Dados e integrações/Integrações]] e [[06 - Tecnologia/Coletas e jobs diários]].

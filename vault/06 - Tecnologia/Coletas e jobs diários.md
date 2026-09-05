---
tipo: operacao
---

# Coletas e jobs diários

Os jobs diários são executados pela Vercel em UTC. A ordem é intencional: o Health Score só roda após receber os dados das plataformas.

| UTC | Processo | Destino principal |
| --- | --- | --- |
| 05:00 | OneRPM streaming | Métricas e histórico de streaming. |
| 06:00 | Meta / Instagram | Snapshot e histórico Instagram. |
| 07:00 | TikTok | Snapshot e histórico TikTok. |
| 08:00 | YouTube | Snapshot e histórico YouTube. |
| 09:00 | Health Score | Histórico diário de saúde. |

## Acionamento manual

Quem possui `integracoes` pode disparar os syncs de plataformas; o cron usa um segredo próprio. Depois de cada execução, o estado e o erro (se houver) são persistidos para a área de Integrações e para os [[01 - Produto/Alertas|alertas operacionais]].

## Cuidados

- Falha em uma fonte deixa aquele pilar como ausente no score, sem inventar valor.
- Variável nova na Vercel só passa a valer após redeploy.
- Atualizações, importações e sincronizações devem invalidar o cache de leitura relacionado.

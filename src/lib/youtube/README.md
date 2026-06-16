# Integração YouTube — 2 camadas (Data API + Analytics)

Coleta métricas do canal do artista no YouTube e exibe no perfil e na página de
Integrações. Tudo roda **no servidor** (rotas em `/api/integracoes/youtube/*`);
API key, secret e tokens nunca vão para o navegador.

## As 2 camadas

| | Camada PÚBLICA | Camada PRIVADA |
|---|---|---|
| API | **Data API v3** | **YouTube Analytics API** |
| Auth | **API key** (uma só) | **OAuth do Google por artista** |
| Cobre | inscritos, views totais, nº de vídeos, engajamento dos vídeos recentes | tempo de exibição, duração média, views da janela, inscritos ganhos/perdidos |
| Quem | **todos** os canais mapeados, sem autorização | só quem **conectou** |

A pública funciona sozinha (só com a API key) e já mostra dados pra todo mundo;
a privada é **aditiva** — entra conforme cada artista autoriza. Por isso o painel
não fica refém da verificação do Google nem de todo mundo conectar.

## Como funciona (visão de código)

```
src/lib/youtube/                   # camada da API (SERVER-ONLY)
  config.ts        env (API key + OAuth client) + endpoints + "configurado?"
  client.ts        Data API (key/Bearer) + Analytics (Bearer) + OAuth token + retry
  oauth.ts         URL de consentimento do Google + state assinado (HMAC)
  channel.ts       PÚBLICO: resolve URL/@handle -> channelId + estatísticas + vídeos recentes
  analytics.ts     PRIVADO: reports.query do YouTube Analytics
src/lib/metricas-sociais/          # persistência (campo `youtube` + historico-youtube)
src/app/api/integracoes/youtube/
  descobrir/       POST (admin)             -> resolve channelId dos links e grava
  sincronizar/     GET (cron) | POST (admin)-> público p/ todos + Analytics p/ conectados
  conectar/        GET (admin|artista)      -> { url } de consentimento (Analytics)
  callback/        GET (público, via state) -> troca code, grava token + coleta inicial
  desconectar/     POST (admin|artista)     -> remove o token (Analytics)
```

Dados no Firestore:
- `artistas/{slug}.redes.youtube.id` — channelId (gravado na descoberta/conexão).
- `youtube-tokens/{slug}` — **tokens OAuth (SEGREDO, server-only)**. Regras negam todo acesso do client.
- `metricas-sociais/{slug}.youtube` — snapshot (público + `analytics?`) + `historico-youtube/{dia}`.
- `integracoes/youtube` — status (canais mapeados, conectados na Analytics, última coleta).

Leitura das métricas liberada a qualquer membro ativo (não são sensíveis). Tokens
e escrita: só servidor.

## Vincular e sincronizar

1. **Camada pública:** Integrações → card *YouTube* → **"Descobrir canais"**
   (resolve o channelId pelos links cadastrados) → **"Sincronizar agora"**.
2. **Camada Analytics (por artista):** no perfil do artista (admin "Gera link") ou
   no portal do artista ("Conectar meu YouTube"). O cron diário
   (`vercel.json`, 08:00 UTC) coleta as duas camadas.

## Variáveis de ambiente

```
YOUTUBE_API_KEY=...            # camada pública (Data API)
YOUTUBE_CLIENT_ID=...          # camada Analytics (OAuth)
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=https://SEU-PAINEL/api/integracoes/youtube/callback
YOUTUBE_SCOPES=...             # opcional (default yt-analytics.readonly + youtube.readonly)
CRON_SECRET=...               # já usado pelo Meta/TikTok; protege o cron
```

## Setup no Google + testes

Runbook passo a passo (projeto, ativar APIs, API key, OAuth consent, test users x
verificação): [`docs/youtube-setup.md`](../../../docs/youtube-setup.md).

# Integração TikTok — métricas via Display API

Coleta métricas públicas do TikTok dos artistas (seguidores, curtidas, nº de
vídeos e engajamento dos vídeos recentes) via **Login Kit + Display API** e
exibe no perfil do artista e na página de Integrações. Tudo roda **no servidor**
(rotas em `/api/integracoes/tiktok/*`); Client Secret e tokens nunca vão para o
navegador.

## Diferença-chave para o Meta

O Meta usa **um** System User token que lê **todas** as contas. O TikTok **não
tem** equivalente para dados orgânicos: **cada artista autoriza a própria conta**
(OAuth). O painel guarda, por artista, um `access_token` (~24h) + `refresh_token`
(~365d, que rotaciona a cada uso) e **renova sozinho** na sincronização.

## Como funciona (visão de código)

```
src/lib/tiktok/                    # camada da API (SERVER-ONLY)
  config.ts        env vars (client key/secret/redirect/scopes) + endpoints
  client.ts        OAuth (troca/renova token) + Display API (Bearer) + retry
  oauth.ts         monta a URL de consentimento + state assinado (HMAC)
  insights.ts      coleta métricas de uma conta (perfil + vídeos recentes)
src/lib/metricas-sociais/          # persistência (client lê, servidor escreve)
  types.ts · client.ts · firestore.ts   (campo `tiktok` + historico-tiktok)
src/app/api/integracoes/tiktok/
  conectar/        GET  (admin|artista)      -> { url } de autorização
  callback/        GET  (público, via state) -> troca code, grava token + coleta inicial
  sincronizar/     GET (cron) | POST (admin) -> renova token, coleta, grava
  desconectar/     POST (admin|artista)      -> remove o token (para a coleta)
```

Dados no Firestore:
- `artistas/{slug}.redes.tiktok` — `{ id: open_id, handle, url }` (gravado ao conectar).
- `tiktok-tokens/{slug}` — **tokens OAuth (SEGREDO, server-only)**. Regras negam todo acesso do client.
- `metricas-sociais/{slug}.tiktok` — snapshot atual + subcoleção `historico-tiktok/{YYYY-MM-DD}`.
- `integracoes/tiktok` — status (contas conectadas/coletadas, última sincronização).

Leitura das métricas liberada a qualquer membro ativo (não são sensíveis,
diferente de `receitas`). Tokens e escrita: só servidor.

## Fluxo de autorização (quem clica o quê)

Como o artista autoriza com a **própria** conta TikTok:
- **Portal do artista** (`/meu-perfil`): botão **“Conectar meu TikTok”** →
  redireciona o navegador do artista para o consentimento.
- **Perfil no painel** (visão da equipe): **“Gerar link de conexão”** → o admin
  copia a URL e envia ao artista (o admin **não** completa o OAuth, senão
  vincularia a conta dele). O artista abre o link e autoriza; cai numa página
  pública de confirmação (`/tiktok-conectado`).

O `state` carrega o `slug` + destino e é **assinado com o Client Secret** — o
callback confia nele (não em parâmetro do navegador) para saber de quem é o
token. Vale 15 minutos.

## O que a Display API entrega (e o que não)

- ✅ Perfil + estatísticas (`/user/info/`): seguidores, seguindo, curtidas
  totais, nº de vídeos. Exige escopos `user.info.profile` + `user.info.stats`.
- ✅ Vídeos públicos recentes (`/video/list/`): views/curtidas/comentários/
  compartilhamentos — agregados como sinal de engajamento. Exige `video.list`.
- ⛔ **Alcance/impressões no nível de conta** → é da **Business API** (exige
  conta Business + Business Center), não da Display API.

A coleta é tolerante a falha: um escopo ausente ou endpoint indisponível vira
`null` e entra em `avisos`, sem derrubar o restante.

## Variáveis de ambiente

Copie de `.env.example`. Em produção (Vercel), defina em **Settings →
Environment Variables**:

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=https://SEU-PAINEL/api/integracoes/tiktok/callback
TIKTOK_SCOPES=user.info.basic,user.info.profile,user.info.stats,video.list  # opcional
CRON_SECRET=...                 # já usado pelo Meta; protege o cron
```

## Setup no TikTok + testes

Runbook passo a passo (criar app, escopos, redirect URI, App Review/Sandbox,
autorizar contas, testar): [`docs/tiktok-setup.md`](../../../docs/tiktok-setup.md).

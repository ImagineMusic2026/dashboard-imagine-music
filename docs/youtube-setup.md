# Setup da integração YouTube (Data API + Analytics) — passo a passo

Runbook pra **ligar** a integração que já está construída no código
(`src/lib/youtube/`). São **2 camadas** com credenciais independentes:

- **PÚBLICA** (Data API v3) — só uma **API key**. Lê qualquer canal público
  (inscritos, views, vídeos, engajamento). **Sem autorização por artista.**
- **PRIVADA** (Analytics API) — **OAuth do Google por artista**. Traz tempo de
  exibição, retenção, inscritos ganhos/perdidos. Só para quem conectar.

> A pública funciona sozinha e já mostra dados pra todo mundo; a privada é
> aditiva. Dá pra ligar só a pública primeiro e deixar a Analytics pra depois.

> **Quem faz o quê:** 🛠️ **Você (dev)** monta tudo no Google Cloud; 🧑‍💼
> **artista** só entra na hora de conectar a Analytics (autoriza a conta dele).

---

## Parte 0 — Pré-requisitos 🧑‍💼

- [ ] O canal do YouTube do artista é **público**.
- [ ] (Só para a camada Analytics) o artista consegue **logar no Google/YouTube** do canal na hora de autorizar.

---

## Parte 1 — Projeto no Google Cloud + ativar as APIs 🛠️

1. [ ] Acesse **https://console.cloud.google.com** → crie (ou escolha) um **projeto** (ex.: "Painel Imagine").
2. [ ] **APIs e serviços → Biblioteca** → ative as DUAS:
   - **YouTube Data API v3** (camada pública)
   - **YouTube Analytics API** (camada privada)

---

## Parte 2 — Camada PÚBLICA: API key 🛠️

1. [ ] **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
2. [ ] Copie a chave → vai pra `YOUTUBE_API_KEY`.
3. [ ] *(Recomendado)* Em **Restringir chave → Restrições de API**, limite à **YouTube Data API v3**. Não use restrição por referenciador (a chave é usada no servidor, sem referer).

> Só com isso a camada pública já funciona: "Descobrir canais" + "Sincronizar".

---

## Parte 3 — Camada PRIVADA: OAuth (consent + client) 🛠️

### 3a. Tela de consentimento
1. [ ] **APIs e serviços → Tela de consentimento OAuth** → tipo **External** → preencha nome do app, e-mail de suporte e contato.
2. [ ] Em **Escopos**, adicione:
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/youtube.readonly`
3. [ ] Em **Usuários de teste**, adicione as contas Google dos artistas que vão testar (até 100).

### 3b. OAuth Client ID
4. [ ] **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**.
5. [ ] Em **URIs de redirecionamento autorizados**, registre o EXATO:
   - Produção: `https://SEU-PAINEL.vercel.app/api/integracoes/youtube/callback`
   - Local: `http://localhost:3000/api/integracoes/youtube/callback`
6. [ ] Copie **Client ID** → `YOUTUBE_CLIENT_ID` e **Client secret** → `YOUTUBE_CLIENT_SECRET`.

---

## Parte 4 — Test users x Verificação (a economia de prazo) 🛠️🧑‍💼

- **Testing (sem verificação)** — com o app em "Testing", as contas adicionadas
  como **usuários de teste** já autorizam e tudo funciona. Bom pra validar.
  - ⚠️ **Atenção:** no modo Testing, o **refresh token do Google expira em 7 dias**.
    Ou seja, o artista precisaria **reconectar a cada ~semana**. Serve pra piloto.
- **Published + Verified (produção)** — publique o app e submeta os escopos
  (`yt-analytics.readonly` é **sensível**) à **verificação do Google**. Depois de
  verificado: qualquer conta autoriza e os **refresh tokens não expiram** por
  tempo. É o que você quer pro uso contínuo.

> A camada **pública** não depende de nada disto — segue funcionando sempre.

---

## Parte 5 — Plugar no projeto 🛠️

### Local (`.env.local`)
```
YOUTUBE_API_KEY=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/integracoes/youtube/callback
CRON_SECRET=<o mesmo já usado pelo Meta/TikTok>
```

### Produção (Vercel)
- [ ] **Settings → Environment Variables**: `YOUTUBE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` (a `.../callback` de produção). `CRON_SECRET` já existe.
- [ ] O cron diário já está em `vercel.json` (08:00 UTC).

---

## Parte 6 — Mapear canais e sincronizar 🛠️🧑‍💼

**Camada pública** (admin):
1. [ ] Confirme que os artistas têm o **link do canal** cadastrado (`redes.youtube.url` — `/channel/UC…`, `/@handle` ou `/user/…`).
2. [ ] Integrações → card **YouTube** → **"Descobrir canais"** (resolve o channelId pelos links).
3. [ ] **"Sincronizar agora"** → coleta inscritos, views e engajamento.

**Camada Analytics** (por artista):
4. [ ] No **perfil do artista** (admin) → **"Gerar link de Analytics"** → envie ao artista; ou o **artista no portal** → **"Conectar meu YouTube"**.
5. [ ] Após conectar, **"Sincronizar agora"** (ou o cron) traz tempo de exibição, retenção e inscritos ganhos/perdidos no card do artista.
6. [ ] *(Opcional)* `node scripts/sync-youtube.mjs --url <URL_DO_APP>` (requer `CRON_SECRET`).

> A tendência só aparece após **≥ 2 dias** de coleta. O Analytics tem ~2-3 dias
> de atraso (a janela termina ontem).

---

## Parte 7 — Quando algo vier vazio ou der erro 🛠️

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Descoberta acha **0 canais** | links não cadastrados / formato estranho | confira `redes.youtube.url` (Parte 6) |
| Canal mapeado mas **sem inscritos** | o canal escondeu a contagem | esperado; o card mostra "ocultos" |
| **API key** dá erro 403 | API não ativada / chave restrita demais | ative a Data API v3 e revise as restrições (Parte 1/2) |
| OAuth: **redirect_uri_mismatch** | URI não bate | iguale `YOUTUBE_REDIRECT_URI` à URI do client, caractere a caractere |
| Analytics parou após ~1 semana | app em "Testing" (refresh token expira em 7d) | reconecte, ou publique + verifique (Parte 4) |
| **quotaExceeded** | cota diária (10.000 unidades) | a descoberta por busca custa caro; já pulamos canais mapeados |

---

## O que esta integração cobre (e o que não cobre)

- ✅ **Canal no YouTube (público)**: inscritos, views totais, nº de vídeos e o engajamento dos vídeos recentes.
- ✅ **Analytics (privado, quem conectar)**: tempo de exibição, duração média, views da janela, inscritos ganhos/perdidos.
- ⛔ **Demografia/retenção por vídeo, fontes de tráfego detalhadas** → extensões da Analytics API, fase futura.
- ⛔ **Streaming/receita do YouTube Music** → vem do **OneRPM**, pipeline separado.

Detalhes de implementação: `src/lib/youtube/README.md`.

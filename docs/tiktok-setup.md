# Setup da integração TikTok (Login Kit + Display API) — passo a passo

Runbook pra **ligar** a integração que já está construída no código
(`src/lib/tiktok/`). O código não precisa de mudança; o que falta é criar o app
no TikTok, preencher as variáveis de ambiente e **cada artista autorizar a
própria conta**. Dá pra compartilhar este arquivo com o cliente.

> **Quem faz o quê:** 🧑‍💼 **Cliente / artista** (dono da conta) ou 🛠️ **Você
> (dev)**. Alguns passos são feitos juntos.

> **Diferença para o Meta:** lá um único token lê todas as contas. No TikTok
> **não existe** isso para dados orgânicos — **cada artista autoriza a conta
> dele** (OAuth). O painel guarda os tokens por artista e renova sozinho.

---

## Parte 0 — Pré-requisitos nas contas dos artistas 🧑‍💼

- [ ] A conta do TikTok do artista é **pública** (conta privada não expõe métricas/vídeos).
- [ ] O artista consegue **fazer login no TikTok** no momento de autorizar (é ele quem clica em "Autorizar").
- [ ] Recomendado **conta Creator ou Business** (melhor consistência dos números). Não é obrigatório para a Display API.

> A Display API entrega **seguidores, curtidas totais, nº de vídeos** e o
> **engajamento dos vídeos recentes** (views/curtidas/comentários/shares).
> **Alcance/impressões por conta** é só na **Business API** (exige conta
> Business + Business Center) — fora do escopo atual.

---

## Em qual conta criar o app? 🧑‍💼🛠️

Crie o app numa conta da **Imagine (cliente)** — **não** na conta pessoal do dev.

> **Por quê:** no TikTok, a conta dona do app **não** decide quais artistas você
> lê (cada artista autoriza a própria conta via OAuth) — ela decide só **quem
> controla e mantém** a integração. Logo o app é um ativo da Imagine: se ficar
> na conta pessoal do dev e ele sair, a cliente perde o controle (renovar token,
> refazer App Review etc.) e a integração pode quebrar.

- [ ] Registrar a conta com **e-mail da Imagine** (corporativo/Workspace de preferência; não o Gmail pessoal de uma pessoa só).
- [ ] Escolher o tipo **Organização/empresa** (não pessoa física) e verificar como Imagine — ajuda no review e nos limites.
- [ ] O dev faz o setup logado nessa conta (ou como membro, se o console permitir); o **Client Secret** vai pro deploy (Vercel), que o dev gerencia.
- [ ] ⚠️ **Não** crie na conta pessoal "pra depois transferir": o TikTok **não** tem transferência fácil de app entre contas (diferente do Meta). Comece já na conta certa.

---

## Parte 1 — Criar o App no TikTok for Developers 🛠️ (na conta da Imagine — ver acima)

1. [ ] Acesse **https://developers.tiktok.com** → faça login → **Manage apps** → **Connect an app** (criar app).
2. [ ] Preencha nome, ícone e descrição do app (a TikTok exige isso já no começo).
3. [ ] Em **App credentials**, anote:
   - **Client key** → vai pra `TIKTOK_CLIENT_KEY`
   - **Client secret** → vai pra `TIKTOK_CLIENT_SECRET`

> 🔒 O **Client Secret** dá acesso ao app. Nunca cole no front, em print público
> nem no git. Ele só vive no servidor (variável sem `NEXT_PUBLIC_`).

---

## Parte 2 — Adicionar os produtos e escopos 🛠️

1. [ ] No app, em **Add products**, adicione **Login Kit** e **Display API**.
2. [ ] Em **Login Kit → Configuration**, registre o **Redirect URI** (precisa ser **exato**):
   - Produção: `https://SEU-PAINEL.vercel.app/api/integracoes/tiktok/callback`
   - Local (para testar): `http://localhost:3000/api/integracoes/tiktok/callback`
   - Pode cadastrar os dois. O valor usado precisa bater **caractere a caractere** com `TIKTOK_REDIRECT_URI` (ou com o derivado da origem, se deixar a env vazia).
3. [ ] Solicite/ative os **escopos**:
   - `user.info.basic`  ← identidade básica (open_id, nome, avatar)
   - `user.info.profile` ← `@username`, bio, verificado
   - `user.info.stats`  ← **seguidores, seguindo, curtidas totais, nº de vídeos**
   - `video.list`       ← **lista de vídeos públicos (views/curtidas/comentários/shares)**

> Os nomes `user.info.profile`, `user.info.stats` e `video.list` podem aparecer
> como **escopos que exigem aprovação** (App Review). Veja a Parte 3.

---

## Parte 3 — Sandbox x App Review (a economia de prazo) 🛠️🧑‍💼

- **Sandbox (modo de teste)** — todo app tem um. Você adiciona **contas-alvo de
  teste** (os próprios artistas, até o limite do sandbox) e valida **todo o
  fluxo** — conectar, coletar, exibir — **sem App Review**. É por aqui que você
  começa.
  - [ ] No app → **Sandbox** → adicione as contas TikTok dos artistas que vão testar.
- **App Review (produção)** — para autorizar **qualquer** conta (fora do
  sandbox), submeta o app à revisão dos escopos (`user.info.stats`, `video.list`
  etc.). A TikTok costuma pedir **vídeo de demonstração do fluxo**, justificativa
  de uso dos dados e uma **Privacy Policy** pública.
  - [ ] Preparar o material e submeter quando o fluxo já estiver validado no sandbox.

---

## Parte 4 — Plugar no projeto 🛠️

### Local (`.env.local` na raiz — não vai pro git)
Copie de `.env.example` e preencha:

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=http://localhost:3000/api/integracoes/tiktok/callback
TIKTOK_SCOPES=user.info.basic,user.info.profile,user.info.stats,video.list   # opcional
CRON_SECRET=<o mesmo já usado pelo Meta>
```

### Produção (Vercel)
- [ ] **Project → Settings → Environment Variables**: adicione `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` (a URL `.../callback` de produção) e, se quiser, `TIKTOK_SCOPES`. O `CRON_SECRET` já existe (do Meta).
- [ ] O cron diário já está em `vercel.json` (07:00 UTC). **Plano Hobby = ~1 execução/dia por cron** (bate certo).

---

## Parte 5 — Conectar as contas e sincronizar (a ordem importa) 🛠️🧑‍💼

A conexão é **por artista** (cada um autoriza a própria conta). Dois caminhos:

**A) O artista conecta sozinho (recomendado quando ele tem login no portal)** 🧑‍💼
1. [ ] O artista entra no **portal** (`/meu-perfil`).
2. [ ] No perfil dele, toca em **“Conectar meu TikTok”** → é levado ao TikTok → **Autorizar** → volta com a conta conectada.

**B) O admin gera um link e envia ao artista** 🛠️→🧑‍💼
1. [ ] No painel, abra o **perfil do artista** → **“Gerar link de conexão”** (copia a URL).
2. [ ] Envie o link ao artista (WhatsApp/e-mail). **Não abra você mesmo** — quem abrir autoriza a **própria** conta.
3. [ ] O artista abre o link → **Autorizar** → cai numa página de confirmação.

Depois de conectar:
4. [ ] Página **Integrações** → card **TikTok** → **“Sincronizar agora”** (admin). Coleta as métricas e grava.
5. [ ] Abra o **perfil do artista** → o card **TikTok** mostra seguidores, curtidas, vídeos e engajamento recente.
6. [ ] *(Opcional, via terminal)* `node scripts/sync-tiktok.mjs --url <URL_DO_APP>` (requer `CRON_SECRET`). Para um só artista: `--slug nome-do-artista`.

> O gráfico de tendência só aparece após **≥ 2 dias** de coleta (precisa de 2
> pontos de histórico). No 1º dia é normal vir só o número, sem a curva.

---

## Parte 6 — Quando algo vier vazio ou der erro 🛠️

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Botão "Conectar" dá **erro 503** | envs não definidas | preencha `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` (Parte 4) |
| TikTok recusa com **redirect_uri mismatch** | URI não bate com a registrada | iguale `TIKTOK_REDIRECT_URI` à URI do app, caractere a caractere (Parte 2) |
| Conta conecta mas **sem métricas** | escopo `user.info.stats`/`video.list` não concedido, ou conta privada | confirme escopos (Parte 2/3) e conta pública (Parte 0) |
| Funciona no sandbox, **falha com outras contas** | app ainda não passou no App Review | adicione a conta ao sandbox, ou submeta o review (Parte 3) |
| **"Views/engajamento"** vazios, resto ok | escopo `video.list` ausente ou sem vídeos públicos | conceda `video.list`; some sobre os vídeos recentes |
| Parou de coletar depois de meses | refresh token expirou (~365d sem uso) | o artista **reconecta** (Parte 5) |
| Erro de rate limit | limite por hora | o código já faz retry; o padrão é sync agendado, não ao vivo |

---

## O que esta integração cobre (e o que não cobre)

- ✅ **TikTok orgânico**: seguidores, seguindo, curtidas totais, nº de vídeos e o
  engajamento (views/curtidas/comentários/shares) dos vídeos recentes.
- ⛔ **Alcance/impressões por conta e demografia** → **Business API** (conta
  Business + Business Center), fase futura.
- ⛔ **Receita/streaming** (inclusive plays musicais no TikTok) → vem do **OneRPM**, pipeline separado.
- ⛔ **Instagram** → integração Meta separada (`src/lib/meta/`).

Detalhes de implementação (como o código funciona por dentro): `src/lib/tiktok/README.md`.

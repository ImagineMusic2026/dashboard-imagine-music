# Setup da integração Meta (Instagram) — passo a passo

Runbook pra **ligar** a integração que já está construída no código (`src/lib/meta/`).
O código não precisa de mudança; o que falta é configurar o lado do Meta e
preencher 4 variáveis de ambiente. Dá pra compartilhar este arquivo com o cliente.

> **Quem faz o quê:** marquei cada bloco com 🧑‍💼 **Cliente** (dono das contas /
> do Business Manager) ou 🛠️ **Você (dev)**. Alguns passos vocês fazem juntos.

Versão da Graph API usada pelo código: **v23.0** (configurável em `META_GRAPH_VERSION`).
Os rótulos do painel do Meta mudam de tempos em tempos — se algum nome estiver
diferente, procure o equivalente mais próximo.

---

## Parte 0 — Pré-requisitos nas contas dos artistas 🧑‍💼

Sem isto, a API **não retorna métricas** (volta vazio, não dá erro claro):

- [ ] Cada Instagram dos artistas é **Business** ou **Creator** (não pode ser conta pessoal).
- [ ] Cada conta IG está **vinculada a uma Página do Facebook**.
- [ ] As Páginas e contas IG estão dentro de **um Meta Business Manager que o cliente administra** (business.facebook.com → Configurações do negócio). **Este é o ponto que decide se você pula o App Review** (ver Parte 3).
- [ ] Cada artista tem **≥ 100 seguidores** se você quiser **demografia de audiência** (idade/gênero/local). Abaixo disso o Meta não devolve esse recorte — os outros números (seguidores, alcance, views) funcionam normalmente.

> Demografia ainda **não** é coletada pelo código atual — fica pra uma fase
> seguinte. Os pré-requisitos de conta acima valem pro que já existe.

---

## Parte 1 — Criar o App no Meta 🛠️ (com o cliente, se o app for da conta dele)

1. [ ] Acesse **https://developers.facebook.com** → **My Apps** (Meus Apps) → **Create App** (Criar App).
2. [ ] No "o que você quer fazer", escolha uma opção que dê **acesso à Graph API** (ex.: **Other / Outro**) e, no tipo, selecione **Business**. Conclua a criação.
3. [ ] Em **App Settings → Basic** (Configurações → Básico), anote:
   - **App ID** → vai pra `META_APP_ID`
   - **App Secret** (clique em *Show*) → vai pra `META_APP_SECRET`
4. [ ] *(Recomendado)* Em **App Settings → Advanced**, ligue **Require App Secret** — o código já manda o `appsecret_proof` em toda chamada, então isso fecha o cerco sem nenhum ajuste extra.

> 🔒 O **App Secret** dá acesso ao app. Nunca cole no front, em print público nem
> no git. Ele só vive no servidor (variável sem `NEXT_PUBLIC_`).

---

## Parte 2 — Criar o System User e gerar o token 🧑‍💼 (admin do Business Manager)

O **System User token** é o que permite **um único token acessar todas as contas**
atribuídas, sem login por artista, e pode ser **não-expirável**.

1. [ ] Entre em **Business Settings** (Configurações do negócio) → menu esquerdo **Users → System Users** (Usuários → Usuários do sistema).
2. [ ] **Add** (Adicionar) → dê um nome (ex.: `painel-imagine`) → função **Admin** → confirme.
3. [ ] Com o System User selecionado, clique em **Add Assets** (Adicionar ativos) e atribua:
   - **Apps** → o app da Parte 1, com **Manage App / Controle total**.
   - **Pages** (Páginas) → **todas** as Páginas do Facebook ligadas aos Instagram dos artistas, com controle total.
   - **Instagram accounts** (Contas do Instagram), se aparecer como categoria separada → as contas dos artistas.
4. [ ] Clique em **Generate New Token** (Gerar novo token) → selecione o **app** no dropdown.
5. [ ] Marque **exatamente estas permissões** (a de insights é a que mais gente esquece):
   - `instagram_basic`
   - `instagram_manage_insights`  ← **métricas; sem ela não vem alcance/views/engajamento**
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
6. [ ] *(Se houver a opção)* defina expiração como **Never / Nunca**.
7. [ ] **Generate Token** → **copie e guarde na hora** (o Meta não mostra de novo) → vai pra `META_SYSTEM_USER_TOKEN`.

> Token de System User é "long-lived" e, em geral, não expira — mas **invalida** se
> as permissões do app mudarem, o app for editado/removido, o acesso à Página for
> revogado, ou a posse do negócio for transferida. Se as métricas pararem do nada,
> suspeite disto primeiro e gere um token novo.

---

## Parte 3 — Acesso Padrão x App Review (a economia de prazo) 🛠️🧑‍💼

- **Acesso Padrão (Standard Access)** — funciona pra contas que o **seu Business
  Manager possui ou gerencia** e que estão **adicionadas ao app**. Como as contas
  dos artistas estão no Business da Imagine (Parte 0), você fica aqui e **pula o
  App Review completo**. É o caminho que você quer.
- **Acesso Avançado (Advanced Access)** — só é exigido pra ler contas de **fora**
  do seu Business Manager. Aí sim precisa submeter o app à revisão das permissões
  `instagram_manage_insights`, etc. Evite enquanto der.

- [ ] Confirmar que **todas** as contas-alvo estão no Business Manager do cliente. Qualquer conta de fora ou ficará sem dados, ou vai exigir App Review.

---

## Parte 4 — Plugar no projeto 🛠️

### Local (`.env.local` na raiz — não vai pro git)
Copie de `.env.example` e preencha:

```
META_APP_ID=...
META_APP_SECRET=...
META_SYSTEM_USER_TOKEN=...
META_GRAPH_VERSION=v23.0          # opcional (já é o default)
CRON_SECRET=<gere um valor aleatório>
```

`CRON_SECRET`: qualquer string aleatória longa (ex.: no terminal `openssl rand -hex 32`,
ou no PowerShell `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`).
É o segredo que protege a sincronização automática.

### Produção (Vercel)
- [ ] **Project → Settings → Environment Variables**: adicione as **mesmas 4** (`META_APP_ID`, `META_APP_SECRET`, `META_SYSTEM_USER_TOKEN`, `CRON_SECRET`) — e `META_GRAPH_VERSION` se quiser fixar.
- [ ] O cron diário já está em `vercel.json` (06:00 UTC). **Plano Hobby = ~1 execução/dia** (bate certo). Pro permite mais frequente — aí ajuste o `schedule`.

---

## Parte 5 — Testar (a ordem importa) 🛠️

1. [ ] Suba o app (`npm run dev` local, ou um deploy na Vercel com as envs).
2. [ ] Confirme que os artistas têm o **@ do Instagram cadastrado** (`redes.instagram.handle` ou a URL) — é por ele que a descoberta casa conta ↔ artista.
3. [ ] Página **Integrações** → card **Instagram** → **"Descobrir contas"** (precisa ser admin). O relatório mostra quantas casaram, quem ficou sem conta e contas do Meta não usadas.
4. [ ] No mesmo card → **"Sincronizar agora"**. Deve coletar as métricas e gravar.
5. [ ] Abra o **perfil de um artista** → o card **Instagram** mostra seguidores, alcance, views, interações etc.
6. [ ] *(Opcional, via terminal)* `node scripts/sync-meta.mjs --url <URL_DO_APP>` (precisa do `CRON_SECRET` no ambiente). Para um só artista: `--slug nome-do-artista`.

> O gráfico de tendência só aparece depois de **≥ 2 dias** de coleta (precisa de 2
> pontos de histórico). No 1º dia é normal vir só o número, sem a curva.

---

## Parte 6 — Quando algo vier vazio ou der erro 🛠️

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Descoberta acha **0 contas** | token sem `pages_show_list`, ou contas não atribuídas ao System User | revise a Parte 2 (assets + escopos) |
| Artista casou mas **sem métricas** | conta não é Business/Creator, ou não está ligada a uma Página | Parte 0 |
| **"Visitas ao perfil"** sempre `—` | `profile_views` varia/foi descontinuado conforme a versão da Graph API | esperado; o código degrada com elegância. Confirme o nome do campo na referência da `META_GRAPH_VERSION` se quiser recuperar |
| Tudo parou de repente | token invalidado (permissão mudou / posse transferida) | gere um token novo (Parte 2) |
| Demografia/audiência não aparece | não é coletada ainda **e** exige ≥100 seguidores | fase futura |
| Erro de rate limit | ~limite por hora por conta | o código já faz retry com backoff; o padrão é sync agendado, não ao vivo |

---

## O que esta integração cobre (e o que não cobre)

- ✅ **Instagram** (e a base pra Páginas do Facebook): seguidores, alcance, views, interações, contas engajadas, publicações.
- ⛔ **Receita/streaming** (royalties, plays) → vem do **OneRPM**, pipeline separado.
- ⛔ **TikTok / Spotify / YouTube** → cada um tem API própria, fase futura.
- ⛔ **Demografia de audiência e métricas de Stories** → previstas, mas não no código atual.

Detalhes de implementação (como o código funciona por dentro): `src/lib/meta/README.md`.

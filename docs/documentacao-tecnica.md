# Documentação Técnica — Painel de Acompanhamento de Artistas (Imagine Group)

> Handoff para a equipe técnica que dará continuidade ao projeto. Público-alvo: desenvolvedores. Data: **30/06/2026**.

---

## 1. Visão Geral & Arquitetura

O **Painel de Acompanhamento de Artistas — Imagine Group** é uma aplicação **Next.js 14 (App Router) em TypeScript** que centraliza métricas de redes sociais, streaming e receita dos artistas do selo, com Health Score, alertas, agenda e portal individual para artistas.

**Pilares da arquitetura:**

- **Frontend:** Next.js 14 (App Router), TypeScript 5, React 18, Tailwind CSS 3 + shadcn/ui (sobre Base UI), tema dark.
- **Banco de dados:** Firebase **Firestore** (projeto `painel-imagine-music`) é o banco central. Leitura via Web SDK (cliente, respeitando regras), escrita exclusiva via **Admin SDK** (servidor).
- **Autenticação:** Firebase Auth com RBAC de 3 papéis (`admin`, `marketing`, `artista`) e 4 capacidades delegáveis.
- **Integrações:** Meta/Instagram (Graph API), TikTok (Login Kit + Display API), YouTube (Data API pública + Analytics API privada), OneRPM (streaming via SFTP + receita via XLSX).
- **Jobs agendados:** 5 crons diários da Vercel (`vercel.json`).
- **Deploy:** Vercel, auto-deploy da branch `main` para `painel.imaginegroup.com.br` (produção com SSL).

**Estrutura de rotas:**

- **Layout root** (`src/app/layout.tsx`): envolve toda a aplicação no `AuthProvider`; tema dark (`className="dark"`), fontes Plus Jakarta Sans / JetBrains Mono (via `next/font/google`), `lang="pt-BR"`, `suppressHydrationWarning`.
- **3 grupos de rotas protegidas:** `(auth)`, `(dashboard)`, `(portal)`.
- **5 páginas públicas:** landing (`/`), `/privacidade`, `/termos`, `/tiktok-conectado`, `/youtube-conectado`.
- **Páginas de aplicação** (login/aceitar-convite, dashboard, portal) + **21 endpoints de API** (`src/app/api/**/route.ts`).

**Sem `middleware.ts`.** Não existe middleware na raiz de `src` nem na raiz do projeto (confirmado). Toda proteção é feita por:

1. **Guards client-side** (`AuthGuard` no dashboard, `PortalGuard` no portal);
2. **Guards server-side** nas rotas de API (`src/lib/server-auth.ts`);
3. **Regras do Firestore** (`firestore.rules`) no banco.

O grupo `(dashboard)` é para a equipe (staff: admin/marketing). O grupo `(portal)` é isolado ao próprio perfil do artista (`/meu-perfil`). Sidebar e Topbar são colapsáveis, com busca global por `⌘K` / `Ctrl+K`.

---

## 2. Como Rodar Localmente

### Pré-requisitos

- **Node.js** (runtime Node obrigatório — Firebase Admin e `ssh2` não rodam em Edge Runtime).
- Acesso ao projeto Firebase `painel-imagine-music`.
- Credenciais das integrações (ver seção 11).

### Configuração do ambiente

1. Copie o template de variáveis:

   ```
   cp .env.example .env.local
   ```

   `.env.local` é **gitignored** — preencha com os valores reais. Em produção, a Vercel lê as mesmas variáveis das configurações do projeto.

2. **Credencial Admin SDK (dev local):** coloque o arquivo `serviceAccountKey.json` na raiz do projeto (gitignored). Em produção, a credencial vem da env `FIREBASE_SERVICE_ACCOUNT` (JSON inline). Veja o comentário em `.env.example`: em dev local a env fica em branco e a API lê o `serviceAccountKey.json` da raiz; em produção (Vercel) cola-se o JSON inteiro da service account, em uma linha só.

### Scripts npm

| Comando | Descrição |
|---|---|
| `npm run dev` | Next.js dev em `http://localhost:3000` |
| `npm run build` | Build de produção (saída em `.next/`) |
| `npm start` | Servidor de produção |
| `npm run lint` | `next lint` |

Para rodar scripts operacionais:
- `node scripts/<arquivo>.mjs` (scripts `.mjs`)
- `npx tsx scripts/<arquivo>.ts` (scripts `.ts`)

---

## 3. Estrutura de Pastas

```
painel-imagine/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Layout root (AuthProvider, tema dark)
│   │   ├── globals.css               # estilos globais / tema
│   │   ├── page.tsx                  # Landing pública
│   │   ├── privacidade/ , termos/    # Páginas legais (LGPD/termos)
│   │   ├── tiktok-conectado/         # Callback público pós-OAuth TikTok
│   │   ├── youtube-conectado/        # Callback público pós-OAuth YouTube
│   │   ├── (auth)/                   # /login, /aceitar-convite
│   │   ├── (dashboard)/              # Painel da equipe (AuthGuard + shell)
│   │   │   ├── home/ artistas/ alertas/ conteudo/
│   │   │   ├── agenda/ importar/ integracoes/ configuracoes/
│   │   ├── (portal)/                 # Portal do artista (PortalGuard + shell)
│   │   │   └── meu-perfil/
│   │   └── api/                      # Endpoints (crons, OAuth, CRUD, importação)
│   │       ├── membros/ artistas/ integracoes/
│   │       ├── importar/ faixas/ health/
│   ├── components/                   # UI, layouts, auth, portal, integrações, etc.
│   │   ├── auth/                     # auth-provider, auth-guard, gates
│   │   ├── layout/                   # sidebar, topbar, dashboard-shell, busca-global
│   │   ├── portal/                   # portal-guard, portal-shell
│   │   ├── integracoes/ artistas/ home/ alertas/
│   │   ├── configuracoes/ importar/
│   └── lib/                          # Lógica de domínio
│       ├── firebase.ts               # Client SDK (auth, db)
│       ├── firebase-admin.ts         # Admin SDK (adminAuth, adminDb)
│       ├── users.ts  permissions.ts  # RBAC
│       ├── server-auth.ts            # Guards de API
│       ├── invites.ts  email.ts
│       ├── meta/ tiktok/ youtube/ onerpm/
│       ├── metricas-sociais/ health/ alertas/ agenda/
│       ├── artistas/ roster/
├── scripts/                          # 31 scripts operacionais (.mjs/.ts) + 1 .d.ts
├── firestore.rules                   # Regras de segurança Firestore
├── firebase.json  .firebaserc        # Config Firebase CLI
├── vercel.json                       # Config de crons
├── next.config.mjs                   # serverComponentsExternalPackages (ssh2)
├── tailwind.config.ts  postcss.config.mjs  components.json
├── tsconfig.json                     # paths: @/* -> src/*
├── package.json  package-lock.json
├── .env.example                      # Template de variáveis
└── docs/
    ├── metodologia-health-score.md   # Metodologia do Health Score (cliente)
    ├── meta-instagram-setup.md       # Setup da integração Meta
    ├── tiktok-setup.md               # Setup da integração TikTok
    └── youtube-setup.md              # Setup da integração YouTube
```

Total: **177** arquivos `.ts`/`.tsx` (em `src/` + `scripts/`).

---

## 4. Stack & Dependências

### Produção

| Pacote | Versão | Para que serve |
|---|---|---|
| `next` | 14.2.35 | Framework (App Router) |
| `react` / `react-dom` | 18 | UI |
| `typescript` | 5 | Tipagem |
| `firebase` | 12.14.0 | Web SDK (auth + Firestore cliente) |
| `firebase-admin` | 13.10.0 | Admin SDK (escrita servidor) |
| `tailwindcss` | 3.4.1 (dev) | Estilos (+ `tailwindcss-animate`, `tw-animate-css`) |
| `recharts` | 3.8.1 | Gráficos |
| `@emailjs/browser` | 4.4.1 | Envio de e-mails de convite |
| `ssh2-sftp-client` | 12.1.1 | SFTP da OneRPM (streaming) |
| `shadcn` | 4.7.0 | CLI/componentes UI |
| `@base-ui/react` | 1.4.1 | Primitivos de UI (Base UI) |
| `lucide-react` | 1.14.0 | Ícones |
| `class-variance-authority` / `clsx` / `tailwind-merge` | — | Utilitários de classe (variants/merge) |
| `xlsx` | 0.20.3 (via CDN da SheetJS) | Parse de planilhas (roster + receita OneRPM) |

### Dev

`@types/node`, `@types/react`, `@types/react-dom`, ESLint + `eslint-config-next`, PostCSS 8, `tailwindcss-animate`.

### Configuração de build relevante

- **`next.config.mjs`**: declara `ssh2` e `ssh2-sftp-client` em `experimental.serverComponentsExternalPackages` (mantém o binário nativo fora do bundle do webpack).
- **`tsconfig.json`**: paths `@/*` → `src/*`.
- **Edge Runtime NÃO é suportado** (Firebase Admin + SFTP são Node-only). Os handlers de cron/sync exportam `runtime='nodejs'`, `dynamic='force-dynamic'`, `maxDuration=60` (o auxiliar `/api/faixas/titulos` usa `maxDuration=30`).

---

## 5. Modelo de Dados (Firestore)

Projeto: `painel-imagine-music`. **Escrita: exclusivamente via Admin SDK** (regras negam escrita no cliente em todas as coleções modeladas). **Leitura: cliente, respeitando papel/permissões.**

### Coleções de topo

| Coleção / Doc | Conteúdo | Leitura (regra) | Escrita |
|---|---|---|---|
| `artistas/{slug}` | Cadastro (nome, `redes{spotify,youtube,instagram,tiktok}` com `{url,id,handle}`, etc.) | `isStaff()` OU `isArtistaDe(slug)` | Admin SDK (`/api/artistas/criar\|atualizar\|excluir` — **admin-only**; importar roster) |
| `receitas/{slug}` | **SENSÍVEL** — receita agregada OneRPM (totalBRL, streams, moedas, receitaPorPlataforma, totais, periodo, ...) | `podeVerReceita()` | Admin SDK (`/api/importar/onerpm`) |
| `users/{uid}` | Perfil (email, nome, role, ativo, artistaSlug?, permissoes?, conviteToken?) | `get`: self OU `isStaff()`; `list`: `isStaff()` | `create`: `isAdmin()` OU auto-criação ao aceitar convite; `update`/`delete`: `isAdmin()` |
| `convites/{token}` | Convite (token UUID, email, nome, role, status, criadoPor, criadoEm, artistaSlug?, aceitoEm?) | `get`: liberado (`if true`, link secreto); `list`: `isAdmin()` | `create`/`delete`: `isAdmin()`; `update`: `isAdmin()` OU o convidado (email do token) |
| `agenda/{id}` | Eventos (tipo `release\|show\|contrato\|reuniao`, titulo, descricao?, data, artistaSlug?, artistaNome?, criadoPor, criadoEm) | `podeAgenda()` | `podeAgenda()` — **CRUD client-side** (`src/lib/agenda/client.ts`), sem rota API |
| `cadastros/{id}` | Auditoria de import do roster | `isAdmin()` | Admin SDK (`/api/importar/roster`) |
| `importacoes/{id}` | Histórico de import OneRPM receita (id determinístico `artistaSlug+período`) | `podeImportar()` | Admin SDK (`/api/importar/onerpm`) |
| `integracoes/{doc}` | Status das integrações. Docs: `meta`, `tiktok`, `youtube`, `onerpm` (status, ultimaSincronizacao, erro? + campos específicos) | `isStaff()` | Admin SDK |
| `tiktok-tokens/{slug}` | **SEGREDO server-only** — openId, accessToken, refreshToken, expirações (~24h/~365d), scope | `allow read, write: if false` | Admin SDK apenas |
| `youtube-tokens/{slug}` | **SEGREDO server-only** — channelId?, accessToken, refreshToken, expirações (~1h), scope. Refresh token do Google não expira por tempo | `allow read, write: if false` | Admin SDK apenas |
| `catalogo-faixas/{isrc}` | Catálogo de faixas (ISRC → título): titulo?, link? (só Deezer), releaseDate?, album?, upc?, artista?, naoEncontrado?, fonte (`'onerpm'` = catálogo oficial importado \| `'deezer'` = fallback), atualizadoEm | **NÃO há regra própria** → cai no catch-all (`if false`): cliente NÃO lê direto. Consumido via `POST /api/faixas/titulos` (sessão ativa) | Admin SDK (background) |

> **Atenção (regra catch-all):** `firestore.rules` termina com `match /{document=**} { allow read, write: if false; }`. Qualquer coleção sem `match` explícito (ex.: `catalogo-faixas`) fica totalmente bloqueada para o cliente — o acesso a essas é sempre via Admin SDK no servidor.

### `metricas-sociais/{slug}` — doc principal + subcoleções

Doc principal `MetricasSociaisDoc`: `slug`, `instagram`, `tiktok`, `youtube`, `streaming`, `atualizadoEm`. **Leitura:** `isStaff()` OU `isArtistaDe(slug)`. **Escrita:** Admin SDK. (Mesma regra vale para todas as subcoleções abaixo.)

| Subcoleção | Doc ID | Conteúdo (resumo) |
|---|---|---|
| `historico/{YYYY-MM-DD}` | dia | Instagram: seguidores, alcance, visualizacoes, interacoesTotais, coletadoEm |
| `historico-tiktok/{YYYY-MM-DD}` | dia | TikTok: seguidores, curtidas, videos, viewsRecentes, coletadoEm |
| `historico-youtube/{YYYY-MM-DD}` | dia | YouTube: inscritos, viewsTotais, viewsRecentes, minutosExibidos (Analytics), coletadoEm |
| `historico-health/{YYYY-MM-DD}` | dia | Health Score: score (0-100), 5 pilares (audiencia?, crescimento?, engajamento?, conteudo?, streaming?), seguidoresTotal, coletadoEm |
| `historico-streaming/{YYYY-MM-DD}` | dia | OneRPM: streams, skips, coletadoEm |
| `streaming-detalhe/atual` | `atual` (fixo) | periodo, porFaixa[] (top **150**, isrc+streams+skips), porPais[] (top **25**), coletadoEm. Sobrescrito a cada sync (`.set()` sem merge) |

**Quem escreve cada subcoleção:**
- `historico*` social: syncs de plataforma (Meta/TikTok/YouTube).
- `historico-streaming` + `streaming-detalhe`: `/api/integracoes/onerpm/sincronizar`.
- `historico-health`: `/api/health/snapshot`.

**Gotchas do modelo:**
- Receita é coleção **separada** de `artistas` de propósito — permite marketing ver o roster sem ver o financeiro (regras diferentes).
- Upserts usam `merge: true` em `metricas-sociais`, `artistas`, `receitas` (gravar Instagram não apaga TikTok). Exceção: `streaming-detalhe/atual` é gravado com `.set()` **sem** merge (sobrescreve).
- `isArtistaDe(slug)` exige `userData().role == 'artista'` e `userData().artistaSlug == slug` — artista logado em **apenas um** slug.
- Pilares de `historico-health` podem ser `null` quando faltam dados (ex.: crescimento sem medição anterior); o score agregado tolera nulls (renormaliza os pesos).
- Import OneRPM receita usa **ID determinístico** — reimport do mesmo período sobrescreve sem duplicar.

---

## 6. Autenticação & Permissões

### Papéis (Role)

`type Role = 'admin' | 'marketing' | 'artista'` (`src/lib/users.ts`).

| Papel | Acesso |
|---|---|
| `admin` | Total — gerencia time, convites, integrações, receita |
| `marketing` | Staff parcial — sem receita sensível por padrão; pode receber capacidades por delegação |
| `artista` | Portal restrito ao próprio `artistaSlug` |

Metadados (label, classe, gradiente CSS) em `roleMeta` (`src/lib/users.ts`).

### Capacidades delegáveis

`type Capacidade = 'verReceita' | 'agenda' | 'integracoes' | 'importar'` (`src/lib/users.ts`; padrões em `src/lib/permissions.ts`). **Não existe uma capacidade `gerenciarTime`** — a gestão de membros é admin-only e é imposta diretamente por `exigirAdmin` nas rotas e por `isAdmin()` nas regras.

Padrão por papel (`PADRAO` em `permissions.ts`):

| Capacidade | admin | marketing | artista |
|---|---|---|---|
| `verReceita` | ✓ | ✗ | ✗ |
| `agenda` | ✓ | ✓ | ✗ |
| `integracoes` | ✓ | ✗ | ✗ |
| `importar` | ✓ | ✗ | ✗ |

**Permissão efetiva** (`temPermissao(user, cap)`): `user.permissoes?.[cap] ?? PADRAO[role]?.[cap] ?? false`. Ou seja, o **override por pessoa** (em `users/{uid}.permissoes`) sobrescreve o padrão do papel; papel desconhecido nunca passa. Papéis estruturais (`ehStaff`, `ehArtista`) não são editáveis — só as 4 capacidades são delegáveis.

### Enforcement em 3 camadas (lógica espelhada)

| Camada | Arquivo | Como |
|---|---|---|
| **1. UI (cliente)** | `auth-provider.tsx`, gates | `useAuth().pode(cap)` chama `temPermissao`; gates renderizam children só se a capacidade existir |
| **2. API (servidor)** | `src/lib/server-auth.ts` | `exigirAdmin`, `exigirSessaoAtiva`, `exigirPermissao(req, cap)`, `autorizarCronOuAdmin`, `autorizarCronOuPermissao`. Tokens Bearer (Firebase ID token) no header `Authorization` |
| **3. Firestore** | `firestore.rules` | `isAtivo()`, `isAdmin()`, `isStaff()`, `isArtistaDe(slug)`, `podeVerReceita()`, `podeImportar()`, `podeAgenda()` |

`AuthProvider` (`src/components/auth/auth-provider.tsx`) expõe `useAuth()` com `{ user, appUser, role, pode, loading }`. Escuta `onAuthStateChanged`; para cada user logado faz `getAppUser(uid)`. Trata `permission-denied` graciosamente caso `/users` ainda não tenha regras publicadas.

**Guards de rota:**
- `AuthGuard` (dashboard): sem login → `/login`; se `ativo=false` → logout + `/login?desativado=1`; se artista → `/meu-perfil`.
- `PortalGuard` (portal): sem login → `/login`; logout se inativo; quem não é artista → `/home`.

### Fluxo de convites

`src/lib/invites.ts` — `type Convite { token (UUID), email, nome, role, status, criadoPor, artistaSlug? }`.

1. **Admin cria** convite (`criarConvite`) → doc em `convites/{token}` com `crypto.randomUUID()` e `serverTimestamp`; e-mail enviado via EmailJS (`@emailjs/browser`, `src/lib/email.ts`).
2. **Convidado abre** `/aceitar-convite?token=...` → `getConvite(token)` (leitura pública por token), valida `status=='pendente'`.
3. **Aceite** (`src/app/(auth)/aceitar-convite/page.tsx`): `createUserWithEmailAndPassword` → cria `users/{uid}` (role, ativo=true, `conviteToken`, `artistaSlug` se aplicável) → `marcarConviteAceito(token)` → redireciona `/home`.
4. Regra Firestore permite `create` em `users` se `isAdmin()` OU (self && email/role/artistaSlug conferem com o convite && convite pendente). Sem auto-promoção: a role vem do convite.

**Gerenciamento (Configurações):** abas time / artistas / permissões / notificações. Diálogo de convidar membro, ações por membro (mudar papel, desativar/reativar, remover), matriz de permissões (override por pessoa via `updateUserPermissoes`), convites pendentes (copiar link, cancelar).

**Operações críticas (Admin SDK):**
- `POST /api/membros/ativo` → `adminAuth.updateUser(uid, {disabled})`, `revokeRefreshTokens` se desativando, atualiza `users/{uid}.ativo`.
- `POST /api/membros/remover` → `adminAuth.deleteUser(uid)` + `adminDb.doc('users/{uid}').delete()`.
- Ambas travam **auto-desativação/auto-remoção** do admin que chama.

---

## 7. Integrações

Leitura de métricas liberada a qualquer membro ativo (respeitando regras); escrita e tokens só no servidor.

### 7.1 Meta / Instagram — Graph API

- **Modelo:** System User token centralizado (Business Manager), acessa todas as contas IG atribuídas. **Sem login por artista** (diferente de TikTok/YouTube).
- **Config:** `src/lib/meta/config.ts` (`getMetaConfig`, `metaConfigurado`). Versão default `v23.0` (`META_GRAPH_VERSION`). Base `https://graph.facebook.com/{versão}`.
- **Segurança:** exige `appsecret_proof` (HMAC-SHA256 do token + App Secret) nas requisições Graph.
- **Fluxo:** admin descobre contas → mapeia `@handle → IG User ID` (gravado em `artistas/{slug}.redes.instagram.id`) → "Sincronizar agora" ou cron coleta métricas.
- **Endpoints:**
  - `POST /api/integracoes/meta/descobrir` (**exige permissão `integracoes`**) — lista contas IG, casa com artistas, grava vínculo.
  - `GET/POST /api/integracoes/meta/sincronizar` (cron OU permissão `integracoes`) — coleta seguidores/alcance/visualizacoes/engajamento/posts; salva `InstagramSnapshot` + `historico/{dia}` + status em `integracoes/meta`. `?slug=` limita a um artista.
- **Arquivos:** `src/lib/meta/{config,client,accounts,insights}.ts`.

### 7.2 TikTok — Login Kit + Display API

- **Modelo:** OAuth por artista (cada um autoriza a própria conta). Tokens em `tiktok-tokens/{slug}` (server-only): access ~24h, refresh ~365d (rotaciona na renovação).
- **Config:** `src/lib/tiktok/config.ts`. Scopes default `user.info.basic,user.info.profile,user.info.stats,video.list`. Auth URL `https://www.tiktok.com/v2/auth/authorize/`, API base `https://open.tiktokapis.com/v2`.
- **CSRF:** `state` carrega `{slug, returnTo, ts, n}` em **base64url**, assinado com HMAC-SHA256 do Client Secret, validade 15 min, comparação `timingSafeEqual` (`src/lib/tiktok/oauth.ts`).
- **Endpoints:**
  - `GET /api/integracoes/tiktok/conectar` (admin|artista) — retorna `{ url }` de autorização.
  - `GET /api/integracoes/tiktok/callback` (público) — troca `code` por token, coleta inicial, redireciona para `returnTo` com `?tiktok=ok|erro|negado` (ex.: `/tiktok-conectado`).
  - `GET/POST /api/integracoes/tiktok/sincronizar` (cron OU permissão `integracoes`) — renova token, coleta, grava `TikTokSnapshot` + `historico-tiktok/{dia}` + `integracoes/tiktok`.
  - `POST /api/integracoes/tiktok/desconectar` (admin|artista) — remove token (histórico persiste).
- **Arquivos:** `src/lib/tiktok/{config,client,oauth,insights}.ts`.

### 7.3 YouTube — Data API (pública) + Analytics API (privada)

Duas camadas independentes (credenciais separadas):

- **Pública (Data API v3, por `YOUTUBE_API_KEY`):** lê qualquer canal mapeado (inscritos, views, vídeos, engajamento) sem autorização do artista.
- **Privada (Analytics API via OAuth Google):** tempo de exibição, retenção, inscritos ganhos/perdidos — só para quem conectou. Tokens em `youtube-tokens/{slug}` (server-only): access ~1h; **refresh token Google não expira por tempo** (só por revogação/desuso). OAuth com `access_type=offline` + `prompt=consent`.
- **Config:** `src/lib/youtube/config.ts`. Scopes default `yt-analytics.readonly` + `youtube.readonly`. Bases: `https://www.googleapis.com/youtube/v3`, `https://youtubeanalytics.googleapis.com/v2`.
- **Endpoints:**
  - `POST /api/integracoes/youtube/descobrir` (**exige permissão `integracoes`**) — resolve URL/@handle → channelId, grava vínculo.
  - `GET /api/integracoes/youtube/conectar` (admin|artista) — retorna `{ url }` de consentimento Google.
  - `GET /api/integracoes/youtube/callback` (público) — troca `code`, descobre canal, coleta pública + Analytics; redireciona com `?youtube=ok|erro|negado`.
  - `GET/POST /api/integracoes/youtube/sincronizar` (cron OU permissão `integracoes`) — auto-resolve pendentes, coleta pública+privada.
  - `POST /api/integracoes/youtube/desconectar` (admin|artista) — remove Analytics (tokens); **dados públicos continuam sendo coletados**.
- **Arquivos:** `src/lib/youtube/{config,client,oauth,channel,analytics}.ts`.

### 7.4 OneRPM — Streaming (SFTP) + Receita (XLSX)

Duas partes **distintas**:

**(A) Streaming — consumo (plays/skips)**
- **Fonte:** feed de trends via SFTP. Host `trends-data.onerpm.com:22`, user `ImagineMusic`, chave **ed25519** (passphrase obrigatória). CSVs diários em `Reports/stats/<loja>/YYYY-MM-DD.csv`. As lojas são listadas dinamicamente (diretórios sob `Reports/stats`); arquivos vazios (ex.: pandora) são pulados (`e.size > 0`). Grão: store × dia × país × ISRC.
- **Pipeline:** `trends-parse.ts` (CSV → rows) → `trends-aggregate.ts` (agrega) → `trends-aliases.ts` (mapeia slug-feed → slug-roster) → `trends-snapshot.ts` (→ `StreamingSnapshot` + `StreamingDetalheDoc`) → `trends-sync.ts` (SFTP, downloads paralelos, batch Firestore).
- **Endpoint:** `GET/POST /api/integracoes/onerpm/sincronizar` (cron OU permissão `integracoes`; param `?dias=N`, default `ONERPM_SYNC_DIAS` ou 35). Grava `metricas-sociais/{slug}.streaming` + `historico-streaming/{dia}` + `streaming-detalhe/atual` + `integracoes/onerpm`.

**(B) Receita — monetização (gross/net)**
- **Fonte:** planilha XLSX mensal (Title, Artists, Store, Currency, Quantity, Gross, Net, Territory, etc.). Upload `POST /api/importar/onerpm` (multipart, exige permissão `importar`, máx 25MB).
- **Pipeline:** `parse.ts` (XLSX → rows) → `aggregate.ts` (→ `OneRpmAggregate`) → `display.ts` (aplica `config.base` net/gross + câmbio) → `firestore.ts` (`salvarImportacao`, batch em `importacoes` + `receitas` + `artistas`).
- **Normalização:** `stores.ts` (`normalizarStore` → plataforma canônica + cor + ícone); `config.ts` hardcoda `base='net'` e câmbio placeholder (USD 5.0 / EUR 6.0 — **aguarda decisão do cliente**); BRL=1.
- **Catálogo de faixas** (`catalogo-faixas/{isrc}`, tipo em `catalogo-faixas.ts`): fonte primária é o **catálogo oficial da OneRPM** (CSV único em `data/catalog_imagine_music.csv`, importado por `scripts/importar-catalogo-onerpm.mjs` — eles reenviam o arquivo quando o catálogo mudar; basta substituir e rodar de novo). Traz título/álbum/UPC/performer/lançamento (`fonte: 'onerpm'`). O **Deezer** (`deezer.ts`) segue como fallback pros ISRCs fora do arquivo (`fonte: 'deezer'`) e é a única origem do `link` clicável. Endpoint para a UI: `POST /api/faixas/titulos` (exige sessão ativa).

**Aliases de artista** (`trends-aliases.ts`, `ALIAS_ARTISTA`): `netto-brito→neto-brito`, `herisson-rocha→herison-rocha`, `fillipe-aladin→filipe-aladim`, `willian-dicastro→william-dicastro`, `kleiton-bacelar→kleiton-barcelar`, `danniel-vieira→daniel-vieira`. Hardcoded e **permanentes por ora**: o catálogo oficial (2026-07-03) usa as mesmas grafias do feed e não cobre faixas sem ISRC, então trocar a junção pra ISRC→artista não os eliminaria.

---

## 8. Coleta de Dados & Jobs Agendados

Os crons estão definidos em **`vercel.json`** (todos os horários em **UTC**):

| Cron | Endpoint | Horário (UTC) |
|---|---|---|
| OneRPM streaming | `/api/integracoes/onerpm/sincronizar` | `0 5 * * *` (05:00) |
| Meta/Instagram | `/api/integracoes/meta/sincronizar` | `0 6 * * *` (06:00) |
| TikTok | `/api/integracoes/tiktok/sincronizar` | `0 7 * * *` (07:00) |
| YouTube | `/api/integracoes/youtube/sincronizar` | `0 8 * * *` (08:00) |
| Health Score | `/api/health/snapshot` | `0 9 * * *` (09:00) |

**Ordem importa:** o Health Score (9h) roda **depois** dos syncs de plataforma (5h-8h) — depende do snapshot consolidado. Se uma plataforma falha, a métrica correspondente fica `null` no score.

**Autorização do cron:** a Vercel envia `Authorization: Bearer ${CRON_SECRET}`. As rotas usam `autorizarCronOuAdmin(req)` (Health Score) ou `autorizarCronOuPermissao(req, 'integracoes')` (os 4 syncs de integração) — aceitam o `CRON_SECRET` **ou** um admin/permissão autenticado (para disparo manual via `POST`).

- `CRON_SECRET` **não é JWT** — é string simples comparada por igualdade (gerar com algo como `openssl rand -hex 32`). Um secret errado simplesmente cai no fallback de admin/permissão e falha lá.
- Handlers de cron/sync: `runtime='nodejs'`, `dynamic='force-dynamic'`, `maxDuration=60` (segundos).
- Execução em lotes (concorrência limitada): Meta 4 contas/vez, TikTok 4/vez, YouTube 3/vez; SFTP OneRPM 16 downloads paralelos (gravação dos artistas em lotes de 8).
- Status persistido em `integracoes/*` após cada run.
- **Gotcha:** variável de ambiente nova na Vercel só vale após **REDEPLOY** (não é hot-reload).

---

## 9. Health Score & Alertas

Health Score e Alertas são **funções puras** — não criam coleções novas. Leem `metricas-sociais/{slug}` (os mesmos dados da home e dos perfis) e produzem objetos em memória.

### Health Score

- **Núcleo:** `derivarHealthScores(mapa, nomePorSlug)` em `src/lib/health/score.ts`. Entrada: `Map<slug → MetricasSociaisDoc>`. Saída: `ArtistaSaude[]` com score 0-100 + breakdown de 5 pilares + faixa.
- **Faixas:** `excelente` (≥80), `saudavel` (≥60), `atencao` (≥40), `critico` (<40).
- **5 pilares e pesos:** Audiência 20% + Crescimento 15% + Engajamento 25% + Conteúdo 15% + **Streaming 25%** (exibido na UI e no contrato como **"Carreira & Negócio"**; a chave interna do breakdown segue `streaming`).
- **Composição:** média ponderada **só** sobre os pilares com dado (renormaliza o peso quando algum falta — artista de uma fonte só não é penalizado).
- **Resumo de portfólio:** `resumirSaude(saudes)` agrega média, contagem (avaliados), distribuição por faixa e breakdown médio.
- **Snapshot diário:** `GET/POST /api/health/snapshot` (cron 9h) carimba `historico-health/{YYYY-MM-DD}` via `salvarHistoricoHealthLote` (lotes de 400). Auth: `CRON_SECRET` ou admin (`autorizarCronOuAdmin`).
- Quem não tem **nenhum** dos pilares de base (audiência/engajamento/conteúdo/streaming) é pulado (princípio de honestidade). Crescimento só conta a partir do 2º sync (antes, `crescimento=null`).

> **A matemática completa, parâmetros de calibração e critérios estão em `docs/metodologia-health-score.md`** (documento de cliente; calibrado em 2026-06-23 via `scripts/analise-health.mjs`). Não reproduzida aqui.

### Alertas

- **Derivação:** `derivarAlertas(mapa, nomePorSlug)` (`src/lib/alertas/derivar.ts`) emite `AlertaDerivado[]`. Categorias: `viralizacao`, `destaque`, `sem_postar`, `crescimento_seguidores`, `queda_seguidores`, `marco_seguidores`, `viralizacao_streaming`, `queda_streaming`.
- **Operacionais:** `derivarAlertasOperacionais(integ)` monitora a saúde das 4 integrações. `artistaSlug='sistema:{id}'` (sem avatar). Regras: status `erro` → categoria `sync_falhou` (severidade `operacional`); conectada mas sem sincronizar há ≥48h → `sync_parado` (`operacional`).
- **Carregamento:** `carregarAlertas()` (`src/lib/alertas/client.ts`) lê em paralelo métricas sociais, artistas e status das integrações; retorna `ordenarAlertas([...derivarAlertas(...), ...derivarAlertasOperacionais(...)])`. **Fonte única** para a página `/alertas` e para o badge do sino.
- **4 severidades:** `critico` > `atencao` > `oportunidade` > `operacional` (ordem em `ORDEM_SEV`), e dentro de cada uma por recência (`ts`).
- **Preferências:** `src/lib/alertas/preferencias.ts` silencia categorias via `localStorage`.
- Alertas **não persistem** (derivados on-demand). Só o Health Score é carimbado em `historico-health` (1 doc/dia/artista) — série histórica, não cache.

---

## 10. Importação de Dados (CSV/XLSX)

### Roster (XLSX)

- `POST /api/importar/roster` (exige permissão `importar`). Parse XLSX → upsert em `artistas/{slug}` (batch) + auditoria em `cadastros/{id}`.
- `GET /api/importar/roster` lista importações (com permissão).
- Parser validável via `npx tsx scripts/verify-roster.ts '<caminho>.xlsx'`.

### Receita OneRPM (XLSX)

- `POST /api/importar/onerpm` (multipart, máx 25MB, permissão `importar`). Parse XLSX → `OneRpmAggregate` → batch em `importacoes` + `receitas` + `artistas`.
- `GET /api/importar/onerpm` lista as importações recentes.
- ID determinístico (`artistaSlug + período`): reimport do mesmo período **sobrescreve** sem duplicar.
- Parser validável via `npx tsx scripts/verify-onerpm.ts`.

### Streaming OneRPM (CSV via SFTP)

Não é upload manual — entra pela pipeline de trends (seção 7.4 A). Parser validável via `npx tsx scripts/verify-onerpm-trends.ts '<caminho>.csv'`.

---

## 11. Variáveis de Ambiente

Template em `.env.example`. `.env.local` é gitignored. Variáveis `NEXT_PUBLIC_*` vão ao browser; as demais são server-only.

| Variável | Para que serve | Onde / Notas |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK | Público (browser) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain | Público |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID | Público (`painel-imagine-music`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | Público |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID | Público |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID | Público |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Measurement ID | Público (presente em `.env.example`) |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | EmailJS — convites | Público (cliente) |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | EmailJS template | Público |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS public key | Público |
| `NEXT_PUBLIC_IMAGINE_WHATSAPP` | WhatsApp do portal (formato internacional, só dígitos) | Público |
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK (JSON inline) | Server-only. **JSON em UMA LINHA** na Vercel. Em dev local: deixar em branco e usar `serviceAccountKey.json` na raiz |
| `CRON_SECRET` | Bearer auth dos crons | Server-only. String aleatória (ex.: `openssl rand -hex 32`) |
| `META_APP_ID` | Meta Business app ID | Server-only (Graph API) |
| `META_APP_SECRET` | Meta app secret | Server-only |
| `META_SYSTEM_USER_TOKEN` | System User token (longa duração) | Server-only (Business Manager) |
| `META_GRAPH_VERSION` | Versão Graph API | Opcional, default `v23.0` |
| `TIKTOK_CLIENT_KEY` | TikTok app client key | Server-only (Login Kit) |
| `TIKTOK_CLIENT_SECRET` | TikTok app secret | Server-only |
| `TIKTOK_REDIRECT_URI` | Redirect OAuth TikTok | Opcional (derivado do origin se vazio). Deve bater EXATO com o console |
| `TIKTOK_SCOPES` | Scopes TikTok | Opcional, default `user.info.basic,user.info.profile,user.info.stats,video.list` |
| `YOUTUBE_API_KEY` | Data API v3 (camada pública) | Server-only |
| `YOUTUBE_CLIENT_ID` | OAuth (Analytics, camada privada) | Server-only |
| `YOUTUBE_CLIENT_SECRET` | OAuth secret | Server-only |
| `YOUTUBE_REDIRECT_URI` | Redirect OAuth YouTube | Opcional (derivado do origin se vazio) |
| `YOUTUBE_SCOPES` | Scopes YouTube | Opcional, default `yt-analytics.readonly youtube.readonly` |
| `ONERPM_SFTP_KEY` | Chave privada ed25519 (base64 ou PEM) | Server-only (produção/serverless) |
| `ONERPM_PASSPHRASE` | Passphrase da chave | Server-only. **Obrigatória** (não pode ser vazia) |
| `ONERPM_SYNC_DIAS` | Janela do sync streaming (dias) | Opcional, default 35 |

> **Não há `ONERPM_KEY_PATH` no template nem no código de produção** — em serverless a chave vem sempre de `ONERPM_SFTP_KEY` (a leitura é do ambiente, não de arquivo no disco).

**Variáveis só do script `sync-onerpm-trends.ts`:** `DIAS` (janela, default 120; `all` = backfill completo), `DRY` (1 = dry-run), `STORE` (filtra 1 loja para debug).

---

## 12. Deploy

- **Plataforma:** Vercel, auto-deploy da branch `main`.
- **Produção:** `painel.imaginegroup.com.br` (com SSL; CNAME no cPanel HostGator). O painel também responde no domínio `*.vercel.app`.
- **Runtime:** Node (Edge não suportado — Firebase Admin + `ssh2`). Por isso `serverComponentsExternalPackages` em `next.config.mjs`.
- **Crons:** declarados em `vercel.json` (seção 8).

**Gotchas de deploy:**
- Variável de ambiente nova na Vercel **só vale após REDEPLOY** (não é hot-reload). Vale para `CRON_SECRET` e credenciais OAuth.
- `FIREBASE_SERVICE_ACCOUNT` deve ser **JSON em uma única linha** na Vercel.
- **TikTok redirect URI** deve bater EXATO (protocolo + domínio + path) com o registro no console. App em produção desde 23/06 — confirmar que a env aponta o domínio correto.
- **YouTube:** verificação do Google **aprovada em 29/06** (sem aviso "não verificado", sem cap de 100, qualquer conta Google autoriza). Mudar branding/escopo dispara re-verificação.
- **Meta Graph API:** versão default `v23.0`; mudar `META_GRAPH_VERSION` pode afetar campos retornados (deprecations).
- `serviceAccountKey.json` **nunca** vai ao git (`.gitignore`).

---

## 13. Scripts Operacionais

São **31 scripts operacionais** em `scripts/` (`.mjs` via `node`, `.ts` via `npx tsx`) + 1 arquivo de tipos (`ssh2-sftp-client.d.ts`, não é executável). Os `check-*` são **read-only** (diagnóstico). Resumo por grupo:

### Bootstrap & acesso
- `bootstrap-firebase.mjs` — **UMA VEZ no setup**: publica `firestore.rules` e cria o doc admin em `users/{ADMIN_UID}` (UID `FJ7DlqqAFsYwGj6Lcr4E3Br5NqY2`).
- `set-role.mjs <role> [uid]` — troca `role`, para testar gates.
- `set-acesso.mjs <email-ou-uid> on|off` — espelha `/api/membros/ativo` (Auth.disabled + Firestore.ativo + revoga tokens).
- `check-acesso.mjs <email-ou-uid>` — diagnostica Auth.disabled vs Firestore.ativo.
- `deploy-firestore-rules.mjs` — publica `firestore.rules` via API (alternativa ao console).

### OneRPM streaming
- `sync-onerpm-trends.ts` — **sync/backfill principal** (SFTP → Firestore). Args `DIAS=120|all`, `DRY=1`, `STORE=spotify`. Histórico mantém últimos 180 dias (`HIST_MAX`).
- `onerpm-trends-inventory.mjs` — inventário do backfill no SFTP.
- `onerpm-trends-peek.ts` — inspeção pontual do feed de trends.
- `onerpm-reatribuir.mjs <fromSlug> <toSlug>` — migra snapshot + histórico entre slugs.
- `onerpm-register-novos.mjs` — cadastra no roster artistas que só apareceram no streaming (lista hardcoded — remover após rodar).
- `onerpm-limpar-orfaos.mjs` — remove slugs órfãos do feed já redirecionados por alias.
- `onerpm-sftp-test.mjs` — testa conexão SFTP.
- `verify-onerpm-trends.ts '<csv>'` — valida o parser de trends contra arquivo real.

### Receita
- `verify-onerpm.ts` — valida o parser da planilha de receita.
- `dedupe-importacoes.ts` — remove importações duplicadas na coleção `importacoes`.
- `split-receita.mjs` — **THROWAWAY**: migra campos de receita de `artistas/{slug}` → `receitas/{slug}` e remove os sensíveis de `artistas`. **Não rodar de novo.**
- `check-receita.mjs` — panorama (roster vs streaming vs receita vs importações).

### Syncs sociais (disparam rotas via CRON_SECRET)
- `sync-meta.mjs`, `sync-tiktok.mjs`, `sync-youtube.mjs` — `POST` para a rota `/sincronizar` com `Authorization: Bearer ${CRON_SECRET}`. Default base `http://localhost:3000`.

### Health Score
- `analise-health.mjs` — **throwaway de calibração**: distribuição de sinais brutos em percentis.
- `check-health-streaming.ts` — roda o score com dado real (impacto do pilar streaming).

### Verificações diversas (read-only)
- `check-streaming.mjs [slug]`, `check-streaming-detalhe.mjs [slug]`, `check-alertas-streaming.mjs`, `check-roster.mjs`, `check-firestore.mjs`, `check-meta.mjs` (valida token Meta; nunca imprime segredo), `streaming-sem-cadastro.mjs` (órfãos + sugestão por distância de edição), `verify-roster.ts`.

### Catálogo de faixas
- `importar-catalogo-onerpm.mjs [caminho.csv] [--dry]` — importa o catálogo oficial da OneRPM (default `data/catalog_imagine_music.csv`) pra `catalogo-faixas`: dedup por ISRC (uppercase — o CSV real mistura caixa; prefere linhas com UPC + título majoritário), normaliza NFC, ignora linhas sem ISRC, preserva `link` do Deezer e título existente se o CSV vier vazio (escrita transacional, imune a corrida com a rota de títulos) e imprime a cobertura do streaming (% dos streams com título). Idempotente.
- `prewarm-titulos.mjs` — pré-resolve ISRC→título via Deezer (fallback pro que não está no catálogo oficial), popula `catalogo-faixas` (idempotente; respeita rate limit).

---

## 14. Segurança & Dados Sensíveis

- **Escrita só via Admin SDK.** `firestore.rules` nega escrita do cliente em todas as coleções — toda alteração passa por rotas `/api` (com guards) ou scripts com `serviceAccountKey.json`. O catch-all `match /{document=**} { allow read, write: if false; }` bloqueia qualquer coleção não modelada (inclusive `catalogo-faixas`).
- **Tokens OAuth bloqueados no cliente.** `tiktok-tokens/*` e `youtube-tokens/*` têm `allow read, write: if false`. Acesso só via Admin SDK. **Nunca importar `firebase-admin` em Client Components** (acesso total) e **nunca expor tokens no client**.
- **Receita é sensível.** `receitas/{slug}` só lê com `podeVerReceita()`. Marketing por padrão não vê; admin delega por pessoa em `users/{uid}.permissoes.verReceita`. A coleção `receitas` é separada de `artistas` justamente para esse gate — a regra Firestore (não só o gate de UI) faz o bloqueio.
- **3 camadas espelhadas** (`temPermissao` em `permissions.ts`/cliente, `server-auth.ts`/API, `firestore.rules`/banco) — manter em sincronia ao mudar permissões.
- **Convites:** `convites/{token}` permite `get` por qualquer um com o UUID (link secreto), mas `list` só admin — **nunca listar publicamente**.
- **Admin não pode desativar/remover a si mesmo** (trava no servidor). Desativar revoga refresh tokens imediatamente (derruba sessões abertas).
- **CRON_SECRET** protege os crons; é comparado por igualdade (não é JWT).
- **Meta:** `appsecret_proof` (HMAC-SHA256) nas requisições Graph.
- **SFTP OneRPM:** chave ed25519 com passphrase obrigatória; em serverless via `ONERPM_SFTP_KEY` (base64/PEM), sem disco.
- **Pendências de segurança conhecidas (status):** rotacionar o Client secret do TikTok (vazou em print); reduzir para 1 client secret ativo no YouTube/Google.

---

## 15. Como Continuar (Handoff)

**Setup inicial (ambiente novo):**
1. `cp .env.example .env.local` e preencher (seção 11).
2. Colocar `serviceAccountKey.json` na raiz (dev) ou `FIREBASE_SERVICE_ACCOUNT` (Vercel).
3. `npm install` → `npm run dev`.
4. Se for um projeto Firebase novo: `node scripts/bootstrap-firebase.mjs` (publica regras + cria admin) — **só na primeira vez**.

**Ao mexer em permissões:** atualizar as **3 camadas** (`src/lib/permissions.ts`, `src/lib/server-auth.ts`, `firestore.rules`) e republicar as regras (`node scripts/deploy-firestore-rules.mjs` ou console).

**Ao adicionar/alterar variável de ambiente na Vercel:** fazer **REDEPLOY** (não é hot-reload).

**Operação das integrações:**
- Instagram exige IG User ID vinculado (descoberta automática via `/descobrir` ou manual) — sem ele, o artista não entra no sync Meta.
- TikTok/YouTube: artista conecta a própria conta; o `artistaSlug` deve ser setado no convite.
- Tokens rotativos (TikTok/YouTube refresh) são regravados automaticamente nos syncs.

**Backlog conhecido / pontos a evoluir:**
- **Câmbio da receita** (`src/lib/onerpm/config.ts`) está com placeholder (USD 5.0 / EUR 6.0) e `base='net'` hardcoded — aguarda decisão do cliente.
- **Catálogo oficial da OneRPM incompleto:** o arquivo de 2026-07-03 cobre 539 ISRCs (~56% dos streams da janela); faltam vários lançamentos recentes (ex.: singles 2026 do Netto Brito, `BKU8226*`) — pedir arquivo completo/atualizado à OneRPM. O fallback Deezer cobre a diferença na UI (99,9% dos streams com título), mas o casamento futuro **receita×streaming por ISRC** merece o arquivo completo.
- **Cobertura de streaming:** alguns slugs do feed ainda sem cadastro no roster (usar `streaming-sem-cadastro.mjs` para decidir entre "cadastrar novo" e "corrigir grafia").
- **Janelas de tendência** ainda curtas — vão se preenchendo com os syncs diários (conferir execução dos Vercel Crons).

**Validação rápida pós-handoff:** rodar os `check-*` (read-only) para conferir roster, streaming, receita e importações; e `check-meta.mjs` / `check-acesso.mjs` para validar tokens e acessos.

**Referências de arquivos-chave:**
- `firestore.rules` — regras de segurança.
- `vercel.json` — crons.
- `src/lib/firebase.ts` / `src/lib/firebase-admin.ts` — SDKs.
- `src/lib/permissions.ts` / `src/lib/users.ts` / `src/lib/server-auth.ts` — RBAC.
- `docs/metodologia-health-score.md` — metodologia do Health Score (cliente).
- `docs/meta-instagram-setup.md`, `docs/tiktok-setup.md`, `docs/youtube-setup.md` — guias de setup das integrações.
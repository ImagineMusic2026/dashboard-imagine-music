# Contexto do Projeto — Painel de Artistas (Imagine Group)

> **Para que serve este arquivo:** dar contexto completo do projeto a uma IA (ou a um novo dev)
> em uma única leitura. Cole o conteúdo no início de uma conversa, ou suba na base de
> conhecimento de um Project, e a IA já entende o que existe, o que é real e o que falta —
> sem precisar reenviar código.

---

## 1. O que é

Dashboard **interno** para a **Imagine Group** (gravadora/gestão de música) acompanhar o
portfólio de artistas em um só lugar: **health score, alertas, receita, audiência, agenda e
conteúdo**. Não é um produto público — o acesso é só para a equipe, por convite.

- **Repositório:** `ImagineMusic2026/dashboard-imagine-music`
- **Projeto Firebase:** `painel-imagine-music`
- **Idioma do produto e do código:** português (pt-BR)

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 14** (App Router) + **TypeScript** |
| UI | **Tailwind CSS** + componentes **shadcn/ui** (sobre Base UI), ícones **lucide-react** |
| Gráficos | **Recharts** |
| Auth + Banco | **Firebase** (Authentication + Firestore) |
| E-mail | **EmailJS** (envio dos convites) |
| Scripts admin | **Firebase Admin SDK** (`serviceAccountKey.json`, fora do git) |

## 3. Estado atual — o que é REAL vs. o que é MOCK

Esta é a seção mais importante para planejar etapas. **Hoje o projeto é uma casca de UI
completa e bonita, com a camada de acesso já real, mas os dados de negócio ainda são fictícios.**

### ✅ Já funciona de verdade (Firebase)
- **Login** com e-mail/senha, **sessão** persistente e **route guard** (rotas protegidas).
- **Papéis (RBAC):** `admin` e `marketing`.
- **Gestão de time:** listar membros, trocar papel, remover e **ativar/desativar acesso**.
  Desativar é real: desabilita a credencial no Firebase Auth (login bloqueado), derruba a
  sessão e as regras do Firestore barram o acesso aos dados (via `/api/membros/ativo` + Admin SDK).
- **Convites por e-mail** (EmailJS): admin convida → e-mail com link → tela "aceitar convite".
- **Regras do Firestore** (`firestore.rules`) e scripts admin (`bootstrap-firebase.mjs`, `set-role.mjs`).

### 🟡 Existe na tela, mas ainda NÃO é funcional / é dado fictício
- **Todas as métricas** (health score, receita, audiência, gráficos, ranking, zona de risco)
  vêm de **arquivos mock** em `src/lib/mock-data/`.
- O mock tem **~9 artistas**, mas a UI exibe números "de produção" **fixos no código**
  (ex.: "127 artistas", "7 alertas") — são placeholders visuais, não refletem o mock.
- **Botões de ação** (Novo artista, upload de DDEX/planilha, conectar integração) são **visuais**:
  ainda não têm backend.
- O **gate de receita** (esconder receita do papel `marketing`) hoje é **só na interface**
  (`src/lib/permissions.ts` → `podeVerReceita`). **Ainda não há proteção real no banco** — isso
  só vira seguro quando a receita estiver no Firestore com security rules.

## 4. Estrutura de pastas

```
src/
  app/
    (auth)/              login e aceitar-convite
    (dashboard)/         home, artistas, artistas/[id], alertas, conteudo,
                         agenda, importar, integracoes, configuracoes
  components/
    auth/                auth-provider, auth-guard, receita-gate
    layout/              dashboard-shell, sidebar, topbar
    artistas/ alertas/ home/ configuracoes/ integracoes/ shared/ ui/
  lib/
    firebase.ts          init do SDK web
    users.ts             usuários + papéis (Role)
    invites.ts           lógica de convites
    email.ts             envio via EmailJS
    permissions.ts       regras de "quem vê o quê" (UI)
    mock-data/           ⚠️ dados fictícios (artistas, alertas, agenda, conteudo, ...)
    types em src/types/index.ts
scripts/                 bootstrap-firebase.mjs, set-role.mjs (Admin SDK)
firestore.rules          regras de segurança do Firestore
```

## 5. Modelo de dados (de `src/types/index.ts`)

- **`Gestor`** — id, nome, email, `papel` (`diretor` | `gestor` | `analista`), cor do avatar.
- **`Artista`** — nome, handle, gênero, `gestorId`, `status` (`ativo`|`inativo`|`onboarding`),
  IDs externos opcionais (`spotifyId`, `instagramHandle`, `tiktokHandle`), e as métricas:
  `healthScore` (+ anterior + histórico de 30d), `healthScoreBreakdown`
  (`audiencia`, `engajamento`, `conteudo`, `negocio` — 0 a 100 cada),
  `audiencia` (soma de seguidores), `receita30d` (BRL) + variação %, `contratoAte`.
- **`Alerta`** — `artistaId`, `severidade` (`critico`|`atencao`|`oportunidade`|`operacional`),
  categoria, título, descrição, ação sugerida, `lido`, `resolvido`.
- **`Integracao`** — `tipo` (`onerpm`|`meta`|`instagram`|`tiktok`|`spotify`|`youtube`|`manual`),
  status, contas autorizadas/total, lista do que recupera (`streams`, `receita`, `demografia`).
- **`ReceitaPlataforma`** — plataforma, streams, receita, variação, % do total.

## 6. Papéis e permissões (RBAC)

| Papel | Pode |
|---|---|
| **admin** | Tudo: gerencia o time, envia convites e **vê a receita** dos artistas. |
| **marketing** | Acesso parcial: **NÃO vê a receita** dos artistas. |

Não há cadastro público — todo mundo entra por **convite** (Configurações → Membros do time).

## 7. Telas (rotas do dashboard)

`/home` (visão geral + KPIs + alertas + ranking) · `/artistas` (lista) · `/artistas/[id]`
(perfil detalhado) · `/alertas` · `/conteudo` · `/agenda` · `/importar` (DDEX/CSV/manual) ·
`/integracoes` (Spotify, Meta, TikTok, OneRPM...) · `/configuracoes` (time e convites).

## 8. Frentes em aberto (candidatas a "próximas etapas")

> Estas são as direções naturais a partir do estado atual. **Não estão priorizadas** — servem
> para a IA propor um plano e para você escolher por onde ir.

- **A. Sair do mock:** modelar artistas/métricas no **Firestore** e ler de lá (em vez de
  `src/lib/mock-data/`).
- **B. Cadastro de artistas:** o botão "Novo artista" virar um fluxo real (form + escrita no banco).
- **C. Importação real:** a tela **Importar** processar de verdade **DDEX (OneRPM)** e **CSV/XLSX**
  (parsing → normalização → gravação).
- **D. Integrações reais:** OAuth e sincronização com **Spotify / Meta / TikTok / OneRPM**.
- **E. Health score de verdade:** definir a fórmula e calcular a partir dos dados reais
  (hoje o número já vem pronto no mock).
- **F. Engine de alertas:** gerar alertas a partir de regras sobre os dados (quedas, contratos
  a vencer, etc.) em vez de lista fixa.
- **G. Segurança da receita:** mover a regra de "marketing não vê receita" para as
  **security rules do Firestore** (hoje é só gate de UI).

## 9. Como usar este contexto com a IA

1. **Conversa avulsa:** cole as seções 1–8 no início do chat e descreva a etapa que quer planejar.
2. **Project (recomendado p/ uso recorrente):** suba este `.md` na base de conhecimento do Project —
   toda conversa nasce já com o contexto.
3. **Claude Code (dentro da pasta):** aqui a IA lê o código direto; basta apontar a frente
   (ex.: "vamos detalhar a etapa C, importação DDEX") que ela abre os arquivos relevantes.

### Prompt inicial sugerido

> "Você é meu parceiro técnico no **Painel de Artistas da Imagine Group** (contexto no doc anexo:
> Next.js 14 + TypeScript + Firebase, hoje com UI pronta mas dados em mock). Quero planejar a
> etapa **[escolha: A/B/C/...]**. Antes de propor código, faça as perguntas que faltam, liste as
> decisões em aberto e me devolva um plano em passos pequenos e verificáveis."

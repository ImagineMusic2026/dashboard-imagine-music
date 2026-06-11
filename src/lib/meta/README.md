# Integração Meta — métricas do Instagram

Coleta métricas do Instagram (seguidores, alcance, visualizações, engajamento,
visitas ao perfil) via **Graph API do Meta** e exibe no perfil do artista e na
página de Integrações. Tudo roda **no servidor** (rotas em
`/api/integracoes/meta/*`); o App Secret e o token nunca vão para o navegador.

## Como funciona (visão de código)

```
src/lib/meta/                      # camada da Graph API (SERVER-ONLY)
  config.ts        env vars + versão + origem do token
  client.ts        fetch com appsecret_proof, retry de rate-limit, paginação
  accounts.ts      descobre contas IG e casa com artistas pelo @handle
  insights.ts      coleta as métricas de uma conta
src/lib/metricas-sociais/          # persistência (client lê, servidor escreve)
  types.ts · client.ts · firestore.ts
src/app/api/integracoes/meta/
  descobrir/       POST  (admin)            -> mapeia @handle -> IG User ID
  sincronizar/     GET (cron) | POST (admin)-> coleta métricas e grava
```

Dados no Firestore:
- `artistas/{slug}.redes.instagram.id` — IG User ID vinculado (gravado na descoberta).
- `metricas-sociais/{slug}` — snapshot atual + subcoleção `historico/{YYYY-MM-DD}`.
- `integracoes/meta` — status (contas vinculadas/coletadas, última sincronização).

Leitura liberada a qualquer membro ativo (métricas sociais **não** são sensíveis,
diferente de `receitas`). Escrita só pelo servidor (regras do Firestore).

---

## Pré-requisitos no Meta (fazer uma vez)

> **Runbook passo a passo (com rótulos do painel, checklist e troubleshooting):**
> [`docs/meta-instagram-setup.md`](../../../docs/meta-instagram-setup.md). O resumo
> abaixo é a versão curta.
>
> Estes passos são feitos no painel do Meta, **fora do código**. Sem eles a API
> não retorna métricas.

1. **Conta profissional.** Cada Instagram dos artistas precisa ser **Business ou
   Creator** e estar **vinculado a uma Página do Facebook**. Conta pessoal não
   retorna insights.

2. **App no Meta for Developers.** Em <https://developers.facebook.com> crie um
   app do tipo **Business**. Anote o **App ID** e o **App Secret**
   (Configurações → Básico).

3. **Acesso às contas (caminho recomendado: Business Manager + System User).**
   - Confirme com a cliente que as Páginas/contas IG dos artistas estão (ou podem
     ser adicionadas) a **um Meta Business Manager** que ela administra
     (business.facebook.com → Configurações do negócio).
   - Em **Usuários → Usuários do sistema**, crie um *System User* e **atribua os
     ativos** (as Páginas e contas IG dos artistas) a ele.
   - **Gere um token** para esse System User com as permissões abaixo. Tokens de
     System User podem ser configurados para **não expirar** — é o que permite um
     único token acessar todas as contas, sem login por artista.

4. **Permissões necessárias:**
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
   `pages_read_engagement`, `business_management`.

5. **App Review (Acesso Avançado).** Para ler contas que **não** têm papel no app
   em produção, submeta o app à revisão dessas permissões. Em
   **desenvolvimento**, dá para validar tudo antes da revisão usando contas que
   tenham um papel (admin/dev/testador) no app.

### Caminho alternativo (sem Business Manager)
Se a cliente **não** centralizar as contas num Business Manager, troca-se apenas
a origem do token em `config.ts` por um fluxo de **Facebook Login por conta**
(tokens de página, renovados a cada ~60 dias). O resto da integração não muda.

---

## Variáveis de ambiente

Copie de `.env.example`. Em produção (Vercel), defina em
**Settings → Environment Variables**:

```
META_APP_ID=...
META_APP_SECRET=...
META_SYSTEM_USER_TOKEN=...      # token do System User
META_GRAPH_VERSION=v23.0        # opcional (default v23.0)
CRON_SECRET=...                 # valor aleatório p/ proteger o cron
```

---

## Vincular e sincronizar

1. **Vincular contas:** página **Integrações** → card *Instagram* →
   **"Descobrir contas"** (admin). Lista as contas IG acessíveis pelo token, casa
   cada uma com um artista pelo `@handle` cadastrado e grava o IG User ID. O
   relatório mostra quem casou e o que ficou pendente.
2. **Coletar métricas:** **"Sincronizar agora"** (admin) ou, automaticamente, o
   **cron diário** (`vercel.json`, 06:00 UTC) que chama a rota com o `CRON_SECRET`.
   Manualmente, via terminal: `node scripts/sync-meta.mjs --url <URL_DO_APP>`
   (requer `CRON_SECRET` no ambiente).

> **Nota Vercel Cron:** o plano *Hobby* permite ~1 execução/dia; *Pro* permite
> agendamentos mais frequentes. Ajuste o `schedule` em `vercel.json` conforme o plano.

---

## Notas técnicas

- **Métricas mudam por versão.** Na v22 o `impressions` de conta foi descontinuado
  (use `views`) e várias métricas passaram a exigir `metric_type=total_value`. O
  código (`insights.ts`) assume v22+/v23 e é tolerante a falha: uma métrica
  indisponível vira `null` e entra em `avisos`, sem derrubar as demais. Ao plugar
  credenciais reais, confira os nomes na referência da versão configurada.
- **Escopo atual:** apenas Instagram. Facebook Pages, demografia de audiência e as
  demais redes (Spotify/YouTube/TikTok, que usam APIs próprias) ficam para depois.

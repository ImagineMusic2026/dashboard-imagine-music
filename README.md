# Painel de Artistas — Imagine Group

Dashboard para acompanhamento do portfólio de artistas da **Imagine Group**: métricas, health score, alertas, agenda, conteúdo e receita — tudo em um único lugar.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + componentes shadcn/ui (Base UI)
- **Firebase** — Authentication + Firestore
- **EmailJS** — envio dos e-mails de convite
- **Recharts** — gráficos

## Pré-requisitos

- **Node.js 18+** (recomendado 20+)
- Acesso ao projeto Firebase `painel-imagine-music` (peça ao responsável)

## Como rodar

```bash
# 1. Clonar
git clone https://github.com/ImagineMusic2026/dashboard-imagine-music.git
cd dashboard-imagine-music

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# (no Windows, se 'cp' não funcionar: copy .env.example .env.local)
# depois preencha o .env.local — veja a seção abaixo

# 4. Rodar
npm run dev
# abre em http://localhost:3000
```

## Variáveis de ambiente (`.env.local`)

Copie o `.env.example` para `.env.local` e preencha:

- **`NEXT_PUBLIC_FIREBASE_*`** — config web do Firebase.
  Pegue em: **Firebase Console → ⚙️ Configurações do projeto → Geral → "Seus apps" → SDK**.
- **`NEXT_PUBLIC_EMAILJS_*`** — chaves do EmailJS (Service ID, Template ID, Public Key).
  Pegue no painel do EmailJS ou peça ao responsável.

> ⚠️ O `.env.local` **não** vai para o git (cada dev cria o seu). Essas chaves `NEXT_PUBLIC_*` são públicas (vão para o client), então podem ser compartilhadas com a equipe — só não publique em lugar aberto.

## Acesso e papéis (RBAC)

Não há cadastro público — novos usuários entram por **convite** (Configurações → Membros do time → Convidar membro). Papéis:

- **admin** — acesso total; gerencia o time e envia convites.
- **marketing** — acesso parcial; **não** vê a receita dos artistas.

## Scripts de administração (opcional)

Usam o **Firebase Admin SDK** e exigem um `serviceAccountKey.json` na raiz do projeto.
Gere a **sua própria** chave em: **Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada**.

> 🔒 O `serviceAccountKey.json` dá acesso **total** ao projeto. Ele está no `.gitignore` — **nunca** faça commit dele e **não** compartilhe a sua chave; cada dev gera a própria.

```bash
# Publica as regras do Firestore + cria/garante o documento do admin
node scripts/bootstrap-firebase.mjs

# Troca o papel de um usuário (útil para testes)
node scripts/set-role.mjs admin|marketing [uid]
```

As regras de segurança do Firestore ficam em [`firestore.rules`](firestore.rules) (também aplicáveis pelo Console em Firestore → Regras).

## Estrutura

```
src/
  app/                 rotas (App Router)
    (auth)/            login e aceitar convite
    (dashboard)/       páginas do painel (home, artistas, alertas, etc.)
  components/          UI, layout, auth, configurações
  lib/                 firebase, users/roles, convites, e dados mock
scripts/               scripts admin (bootstrap, set-role)
firestore.rules        regras de segurança do Firestore
```

## Observações

- As **métricas** (health score, receita, audiência, gráficos) ainda são **dados mock** em `src/lib/mock-data/`. A integração com as APIs reais (Spotify, OneRPM/DDEX, etc.) é um próximo passo planejado.
- O cadastro de artistas e a entrada de dados reais virão depois do alinhamento de produto.

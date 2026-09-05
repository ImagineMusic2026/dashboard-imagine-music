---
tipo: seguranca
---

# Segurança e dados sensíveis

## Nunca registrar no Obsidian

- Valores de `.env.local`.
- Service account do Firebase.
- Tokens de Meta, TikTok, YouTube, OneRPM, EmailJS ou cron.
- Planilhas, receitas ou dados pessoais de artistas/equipe.

## Controles existentes

- Dados de receita ficam em coleção separada e exigem `verReceita`.
- Tokens OAuth de TikTok e YouTube são server-only e bloqueados nas regras do Firestore.
- Escritas de serviço usam Firebase Admin SDK.
- O link público de questionário tem escopo estreito: valida token, aceita somente campos conhecidos e fixa a origem como artista.
- A regra catch-all do Firestore bloqueia coleções que não tenham regra explícita.

## Operações críticas

Desativar usuário revoga tokens de atualização e bloqueia credencial. Remover usuário apaga a conta do Firebase Auth e o perfil correspondente. Ambas protegem o admin contra auto-remoção.

Veja [[06 - Tecnologia/Rotas e fronteiras de acesso]] e [[02 - Acesso e equipe/Configurações e equipe]].

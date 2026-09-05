---
tipo: arquitetura
---

# Arquitetura técnica

## Stack

- Next.js 14 com App Router e TypeScript.
- React e Tailwind CSS.
- Componentes de interface baseados em shadcn/ui.
- Firebase Authentication e Firestore.
- Recharts para visualização de dados.
- EmailJS para e-mails de convite.

## Organização funcional

| Área | Responsabilidade |
| --- | --- |
| Autenticação | Login, aceite de convite e proteção de acesso. |
| Dashboard | Home, artistas, alertas, agenda, conteúdo, importação, integrações e configurações. |
| Portal | Experiência direcionada ao artista: perfil e diagnósticos. |
| APIs internas | Operações sensíveis de artista, importação, membros e integrações. |
| Firestore | Dados do produto, regras de segurança e persistência. |

## Princípios

- Nenhuma credencial deve entrar neste cofre.
- Permissões são verificadas na interface, nas rotas internas e nas regras do Firestore.
- Métricas e listas usam cache de leitura; escritas/importações devem invalidá-lo.

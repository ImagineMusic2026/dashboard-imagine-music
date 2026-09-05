---
tipo: tela
rota: /agenda
---

# Agenda

Guarda eventos da equipe relacionados ou não a um artista.

## Evento

| Campo | Uso |
| --- | --- |
| Tipo | `release`, `show`, `contrato` ou `reuniao`. |
| Título | Nome do compromisso. |
| Data | Quando ele acontece. |
| Descrição | Opcional. |
| Artista | Opcional; conecta o evento ao roster. |

## Regra de acesso

Quem possui a capacidade **agenda** pode criar, editar e excluir eventos. Por padrão, admin e marketing a possuem; artista não.

O CRUD é feito diretamente no Firestore, respeitando as regras de segurança. Veja [[02 - Acesso e equipe/Perfis e permissões]] e [[06 - Tecnologia/Modelo de dados Firestore]].

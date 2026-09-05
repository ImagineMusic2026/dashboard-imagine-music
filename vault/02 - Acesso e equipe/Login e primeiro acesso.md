---
tipo: fluxo
---

# Login e primeiro acesso

## Entrada da equipe

1. A pessoa recebe convite com link único.
2. Abre `/aceitar-convite?token=...`.
3. Define senha; a conta é criada no Firebase Auth com o papel e o vínculo previstos no convite.
4. O convite é marcado como aceito e a pessoa entra na área compatível com seu perfil.

Se o e-mail não for entregue, o convite continua válido: a equipe pode copiar e enviar o link por outro canal.

## Regras

- Não existe cadastro aberto.
- Papel, e-mail e vínculo de artista são conferidos contra o convite para impedir autoelevação de privilégios.
- Conta desativada é desconectada e volta ao login com o acesso bloqueado.
- `admin` e `marketing` vão ao dashboard; `artista` vai ao [[02 - Acesso e equipe/Portal do artista|portal do artista]].

## Navegação da equipe

A busca global abre com `Ctrl+K` no Windows ou `⌘K` no Mac e encontra artistas, alertas e conteúdos. Setas navegam, Enter abre e Esc fecha.

Veja [[05 - Fluxos/Convites e acesso]] e [[02 - Acesso e equipe/Perfis e permissões]].

---
tipo: fluxo
---

# Login e primeiro acesso

## Entrada da equipe

1. A pessoa recebe convite com link único.
2. Abre `/aceitar-convite?token=...`.
3. Define senha; a conta é criada no Firebase Auth com o papel e o vínculo previstos no convite.
4. O perfil e o convite marcado como aceito são gravados **numa única operação**, e a pessoa entra na área compatível com seu perfil.

O passo 4 era feito em duas gravações. Se a segunda falhasse, o convite ficava pendente para sempre e o mesmo link recriava o acesso de quem o admin removesse depois. As regras agora só aceitam as duas juntas.

Se o e-mail não for entregue, o convite continua válido: a equipe pode copiar e enviar o link por outro canal.

## Regras

- Não existe cadastro aberto.
- Papel, e-mail, vínculo de artista e áreas do colaborador são conferidos contra o convite para impedir autoelevação de privilégios. O convidado não consegue alterar o próprio convite (só marcá-lo como aceito) nem gravar no perfil nada além do que o convite traz.
- Conta desativada é desconectada e volta ao login com o acesso bloqueado.
- `admin` e `marketing` vão ao dashboard; `colaborador` vai à primeira área liberada para ele; `artista` vai ao [[02 - Acesso e equipe/Portal do artista|portal do artista]].
- Colaborador sem nenhuma área liberada vê um aviso para falar com um admin, em vez de uma tela vazia.

## Navegação da equipe

A busca global abre com `Ctrl+K` no Windows ou `⌘K` no Mac e encontra artistas, alertas e conteúdos. Setas navegam, Enter abre e Esc fecha. O colaborador não tem busca global nem o sino de alertas.

Veja [[05 - Fluxos/Convites e acesso]] e [[02 - Acesso e equipe/Perfis e permissões]].

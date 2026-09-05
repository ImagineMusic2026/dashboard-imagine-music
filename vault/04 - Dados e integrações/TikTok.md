---
tipo: integracao
plataforma: TikTok
---

# TikTok

## Modelo de acesso

Cada artista autoriza sua própria conta via OAuth (Login Kit + Display API). Os tokens ficam apenas no servidor.

## Fluxo

1. Artista ou equipe habilitada abre o link de conexão.
2. O artista autoriza no TikTok.
3. O callback troca o código pelo token e faz a coleta inicial.
4. As sincronizações seguintes renovam o token quando necessário e registram seguidores, curtidas, vídeos e visualizações recentes.

Desconectar remove o token, mas mantém o histórico já coletado. O state do OAuth é assinado e expira em 15 minutos, protegendo contra CSRF.

## Vídeos de terceiros (UGC)

A conexão OAuth cobre a conta do artista. O que **outras pessoas** publicam usando as músicas dele vem por outro caminho: o relatório de TikTok da OneRPM (feed próprio, sync às 5h05), que separa `UGC` (vídeo do público) de `PGC` (conteúdo oficial) por faixa, por dia e por país.

É medição, não conteúdo: o painel sabe **quantos** vídeos existem e o que renderam, nunca quais são. Nenhuma API pública lista os vídeos de um som — a Display API só devolve os da conta autorizada, e a busca por som é exclusiva da Research API, restrita a instituições acadêmicas dos EUA e da Europa. A tela [[01 - Produto/Viralização]] mostra os números e leva pra busca do TikTok quem quiser ver os vídeos.

Veja [[03 - Artistas/Perfil do artista]], [[04 - Dados e integrações/Integrações]] e [[06 - Tecnologia/Modelo de dados Firestore]].

---
tipo: tela
rota: /viralizacao
---

# Viralização

Mostra o que o **público** faz com as músicas do selo no TikTok: quantos vídeos outras pessoas publicaram usando cada faixa, quanto esses vídeos renderam, de que países vêm e se o movimento está acelerando.

Nasceu do pedido de ver, dentro do painel, os conteúdos de terceiros que o TikTok for Artists exibe.

## O que a tela não faz (e por quê)

Nenhuma API entrega a **lista dos vídeos**. A Display API que o painel usa devolve só os vídeos da conta que autorizou; a busca por som existe apenas na Research API, restrita a instituições acadêmicas dos EUA e da Europa; e raspar o site quebraria os Termos do TikTok e o app já aprovado do painel.

Por isso a tela mostra a **medição** desses vídeos e leva pro TikTok quem quiser ver os vídeos em si: cada faixa tem um botão que abre a busca por título + artista.

## Estrutura

- **Todos:** ranking do roster por vídeos criados pelo público, com variação dos últimos 7 dias e busca por artista.
- **Artista** (`/viralizacao?artista=slug`): vídeos do público, views, fatia do público nas views, watchtime médio, curva diária (vídeos ou views), países de origem e a lista de faixas usadas — cada uma com tendência, curva e link pro TikTok.

O card de Fonogramas no perfil leva direto pro artista selecionado.

## Leituras

O ranking do selo sai de **um** documento (`integracoes/onerpm-tiktok`, escrito pelo sync), não dos ~85 documentos por artista. O detalhe lê só o documento do artista, pelo mesmo cache curto que o card de Fonogramas usa.

## Limites do dado

- O relatório da OneRPM existe desde 07/08/2026: ausência aqui é falta de medição, não prova de falta de uso.
- O feed pula dias, então "últimos 7 dias" significa os 7 dias **com dado**.
- O watchtime médio vem misturado (vídeo do público e conteúdo oficial no mesmo número); é o que a OneRPM publica.

Veja [[04 - Dados e integrações/TikTok]], [[04 - Dados e integrações/OneRPM]] e [[03 - Artistas/Perfil do artista]].

---
tipo: tela
rota: /artistas/[id]
---

# Perfil do artista

É a ficha consolidada do artista. O slug interno permanece estável mesmo que nome ou descrição mudem, preservando os dados relacionados.

## Cinco abas, e só a aberta carrega

Desde 09/09/2026 o perfil é dividido em abas. A razão principal não é organização visual: **só a aba aberta é montada**, e cada card lê os próprios dados. Abrir o perfil do maior artista custava 431 leituras do Firestore com tudo junto e passa a custar 82. Ver [[06 - Tecnologia/Custo de leitura do Firestore]].

| Aba | O que traz |
| --- | --- |
| **Visão geral** | Faixa executiva, o que merece atenção, [[03 - Artistas/Health Score]] e [[03 - Artistas/Estágio (IGE)]] |
| **Canais** | Comparativo lado a lado e os cards de Instagram, TikTok e YouTube |
| **Streaming** | Consumo pela OneRPM, análise de faixas e skip, e os fonogramas |
| **Receita** | Resumo financeiro e contratos |
| **Cadastro** | Projeto comercial, [[03 - Artistas/Dossiê do artista]], [[03 - Artistas/Diagnósticos e questionários]] e acessos |

A ordem segue o uso: a primeira aba responde "como esse artista está e o que merece atenção", que é o que se quer ao abrir. As outras servem para investigar depois que a primeira apontou onde olhar.

**"O que merece atenção" fica na primeira de propósito.** É o único bloco que avisa de problema antes de alguém procurar; atrás de uma aba, ninguém veria.

A aba de Receita não aparece para quem não tem permissão de receita nem de contratos — melhor que uma aba que abre vazia.

## Um alerta pode apontar para outra aba

Os alertas e o comparativo de canais levam direto ao card certo. Como o alerta de streaming mora na Visão geral e o card dele mora em outra aba, clicar troca a aba, expande o card e rola até ele — nessa ordem.

Isso tem uma sutileza que custou trabalho: trocar de aba **monta** o card, e a montagem acontece depois do pedido de expandir. O pedido fica guardado por dois segundos e o card o consome ao surgir. Sem isso, o "Ver streaming" de um alerta abriria a aba certa com o card ainda fechado.

## Fonogramas carregam sob demanda

O card mostra quantas faixas o artista tem assim que o perfil abre — o número vem de um contador guardado no próprio cadastro, que não custa leitura nova. A lista em si só é buscada quando alguém clica em "Ver as N faixas": para o maior artista são mais de 300 documentos, e pagá-los em toda abertura era 42% do custo da tela.

Não há prévia das primeiras faixas porque a ordenação por lançamento acontece depois da busca; pedir "as 8 primeiras" ao banco devolveria 8 faixas quaisquer. Entre uma prévia inconsistente e um botão honesto, ficou o botão.

## Ações

- **Exportar**: reúne os dados do artista para colar numa IA ou abrir no Excel. Ver [[03 - Artistas/Exportar dados do artista]].
- **Favoritar**: estrela pessoal de quem está logado, para reencontrar o artista pela lista de favoritos.
- **Criar ou editar**: capacidade `editarArtistas`.
- **Excluir**: somente admin.
- **Conectar TikTok ou YouTube**: capacidade `conexoesArtista`.
- **Consultar a Soundcharts**: dentro do card de Estágio, sob demanda. Ver [[04 - Dados e integrações/Soundcharts]].

Veja [[03 - Artistas/Gestão de artistas]], [[04 - Dados e integrações/Integrações]] e [[02 - Acesso e equipe/Perfis e permissões]].

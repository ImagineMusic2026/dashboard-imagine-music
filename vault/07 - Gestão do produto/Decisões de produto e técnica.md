---
tipo: registro-de-decisoes
---

# Decisões de produto e técnica

Registre aqui decisões que evitam rediscussão no futuro. Cada nova entrada deve ter data, contexto, decisão, motivo e consequência.

## 2026-08-13 — Cofre separado por projeto

**Decisão:** manter o Painel Imagine em seu próprio cofre, dentro de `Desktop/Obsidian`.

**Motivo:** separar o conhecimento de cada produto e preservar um grafo focado.

**Consequência:** código e documentação operacional continuam separados; o cofre recebe conceitos, fluxos e decisões, não credenciais.

## Decisão existente — Receita em coleção separada

**Decisão:** dados financeiros ficam em `receitas/{slug}`, separados de `artistas/{slug}`.

**Motivo:** o marketing pode acompanhar o roster sem receber acesso automático ao financeiro.

**Consequência:** a regra `verReceita` protege uma fronteira de dados independente.

## Decisão existente — Score honesto com pesos reequilibrados

**Decisão:** artista sem sinal-base não recebe Health Score; pilares ausentes redistribuem pesos.

**Motivo:** evitar nota inventada e não penalizar artista por uma fonte ainda não conectada.

**Consequência:** a comparação precisa considerar quais artistas já possuem dados. Veja [[03 - Artistas/Health Score]].

## Decisão existente — Questionário externo com escopo mínimo

**Decisão:** link público responde somente a um questionário de um artista e não abre o painel.

**Motivo:** coletar informações antes do portal sem liberar dados internos.

**Consequência:** revogação remove o token e um novo compartilhamento gera outro endereço. Veja [[05 - Fluxos/Questionários públicos]].

## Decisão — Viralização mostra medição, não os vídeos

**Decisão:** a tela de Viralização mostra quantos vídeos o público fez com cada música e leva pra busca do TikTok, em vez de exibir os vídeos.

**Motivo:** nenhuma API pública lista os vídeos de um som — a Display API devolve só os da conta autorizada, e a busca por som é exclusiva da Research API, restrita a instituições acadêmicas dos EUA e da Europa. Raspar o site quebraria os Termos e o app aprovado do painel.

**Consequência:** a equipe vê tração, tendência e países por faixa; os vídeos em si continuam sendo vistos no TikTok. Veja [[01 - Produto/Viralização]].

## Decisão — Ranking do roster junto do status do sync

**Decisão:** o ranking de viralização do selo é gravado dentro de `integracoes/onerpm-tiktok`, pelo próprio sync.

**Motivo:** montar o ranking na tela custaria uma leitura por artista (~85) a cada visita, e a cota gratuita do Firestore já derrubou o painel uma vez.

**Consequência:** a lista do selo custa uma leitura e envelhece com o sync diário; o detalhe de um artista continua lendo o documento dele.

## Decisão — IGE separado do Health Score, com cobertura à vista

**Decisão:** o Estágio (IGE da metodologia IAOS v1.2) entrou como card próprio no perfil, sem alterar o Health Score.

**Motivo:** 60% do índice depende do Soundcharts, que ainda não está integrado. Trocar os pesos do Health Score agora faria a nota de 96 artistas variar em função de um estágio apurado com 40% de cobertura.

**Consequência:** o índice é calculado sobre a cobertura disponível e sempre exibe percentual coberto, marca "provisório" e ND por dimensão. Veja [[03 - Artistas/Estágio (IGE)]].

## Decisão — Fator de equilíbrio exige duas redes medidas

**Decisão:** o corte por concentração de audiência só é aplicado quando o painel mede pelo menos duas redes do artista.

**Motivo:** a regra literal jogaria 74 de 86 artistas no fator 0,40, e 71 deles têm uma rede medida — o corte puniria falha de coleta, não concentração real, contra o §8 da própria metodologia.

**Consequência:** desvio declarado na tela ("fator não aplicado") e pendente de confirmação com a Imagine.

## Decisão — Régua v1.2 entra como prévia, não como substituição

**Decisão:** o Health Score adaptativo da v1.2 foi implementado e exibido ao lado do score oficial, que permanece inalterado.

**Motivo:** a nota oficial alimenta home, lista de artistas, insights e o carimbo diário do histórico. Trocá-la agora penduraria 96 artistas num estágio apurado com 40% de cobertura e criaria um degrau no gráfico de evolução.

**Consequência:** a Imagine compara as duas réguas na tela antes de decidir; virar a chave é trocar quem chama o cálculo. Veja [[03 - Artistas/Health Score]].


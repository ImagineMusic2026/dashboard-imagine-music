---
tipo: modulo
area: artistas
---

# Gestão de artistas

É o núcleo do Painel Imagine: reúne o roster e a página individual de cada artista.

## O que a área cobre

- Listagem, busca e ordenação do roster.
- Criação e edição de artistas.
- Perfil detalhado do artista.
- Saúde do artista (health score).
- Indicadores de streaming, receita e canais.
- Diagnósticos e respostas de questionários.
- Vínculo de plataformas e integrações.

## Quem entra no roster

Em 09/09/2026 o roster passou de 98 para 110 artistas. Os doze que entraram vieram do catálogo das contas irmãs da Imagine na OneRPM — Irmão Lázaro, Anderson Silva, DD Pires e companhia —, com 288 faixas que até então apareciam sem dono.

O critério de quem entra foi a **conta de origem**, e não quantas faixas a pessoa tem. Isso importa: entre os performers que assinam álbum na conta principal e não estavam no roster há nomes como Maiara & Maraisa, Zé Neto & Cristiano, Tierry e Felipe Araújo. Eles assinam porque a faixa é dividida, não porque pertencem ao casting. Criar esses seria encher o roster de artista de fora.

Quatro nomes que pareciam novos também não eram — só grafia diferente entre o feed de distribuição e o cadastro. O painel resolve isso por uma lista de apelidos.

Os que entram pelo catálogo nascem **sem redes sociais**, marcados como pendentes de configuração. Aparecem no roster sem métrica, que é a leitura correta: ninguém mediu ainda. Enquanto as credenciais de acesso às contas irmãs não chegarem, eles também ficam com nome e sem streaming.

## Data de nascimento

Campo opcional em criar e editar artista, desde 11/2026. Alimenta o alerta de aniversário e o selo do perfil. Chega por dois caminhos: a equipe digita no cadastro, ou o artista responde no questionário Artista.

O cadastro guarda **de onde veio** a data, e é isso que decide a disputa: o questionário só atualiza a data que ele mesmo gravou; a que a equipe digitou fica. Ao editar, a data só é enviada se alguém mexeu no campo — o diálogo nasce de uma cópia do cadastro que pode ter até cinco minutos, e reenviar a data antiga desfaria a que o questionário acabou de copiar. Limpar o campo apaga a data e registra que foi a equipe: a partir daí o questionário não preenche de novo (o diálogo avisa). Sem esse registro, o próximo envio do questionário desfaria em silêncio uma data tirada por estar errada ou a pedido do artista.

Data impossível (31/02), anterior a 1900 ou de menos de um ano atrás é recusada, no formulário e no servidor, pela mesma regra. O "um ano atrás" não é idade mínima de artista: o calendário do celular abre no dia de hoje, e um toque em "Definir" gravava o artista com 0 anos. A idade aparece ao lado do campo, para o ano esquecido saltar aos olhos.

## Relações

- [[04 - Dados e integrações/Integrações]] fornece os dados exibidos no perfil.
- [[04 - Dados e integrações/OneRPM]] concentra receita, catálogo e relatórios de distribuição.
- [[05 - Fluxos/Questionários públicos]] registra diagnósticos ligados ao artista.
- [[02 - Acesso e equipe/Perfis e permissões]] define quem pode criar, editar ou excluir.

## Para documentar depois

- [ ] Campos obrigatórios no cadastro.
- [ ] Fórmula e faixas do health score.
- [ ] Critérios dos alertas gerados para um artista.

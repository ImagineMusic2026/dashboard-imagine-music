---
tipo: tela
rota: /configuracoes
---

# Configurações e equipe

É a área administrativa do painel. Tem seis abas: **Time**, **Artistas**, **Permissões**, **Quadro de atividades**, **Notificações** e **Perfil**. O colaborador vê só a aba **Perfil**.

## Time — somente admin

- Convida admin, marketing, colaborador ou artista por e-mail.
- Convite de artista exige selecionar o artista ao qual aquele login será vinculado.
- Convite de colaborador traz as caixas das áreas que ele vai acessar, com Atividades já marcada. Sem nenhuma área marcada, o convite não sai.
- Permite trocar o papel de staff (admin ↔ marketing), desativar, reativar ou remover membro. A troca de papel não aparece para colaborador nem para login de artista.
- Desativar bloqueia login, encerra sessões e atualiza o estado do usuário.
- Um admin não pode remover nem desativar a si mesmo.

## Artistas

Pessoas com `convidarArtistas` podem convidar somente artistas para o portal, copiar ou cancelar seus convites pendentes. Convites para admin ou marketing seguem exclusivos do admin.

## Permissões

O admin cria um override por pessoa, ou restaura o padrão do papel. As capacidades são [[02 - Acesso e equipe/Perfis e permissões#Regras importantes|ver receita, agenda, integrações, importar, editar artistas, conexões de artista e convidar artistas]].

Na linha de um colaborador só há chave nas áreas que o papel pode receber; nas outras aparece um cadeado, e não existe "padrão". Uma chave ligada fora dessas áreas seria ignorada de qualquer forma: a interface, as rotas e as regras conferem a lista de áreas concedíveis antes do override.

## Notificações

Permite silenciar categorias de alerta no navegador atual. Veja [[01 - Produto/Alertas]].

## Perfil

Cada pessoa pode consultar dados da própria conta e trocar sua senha. O admin geral também configura o WhatsApp de contato usado no portal para solicitações de vínculo de redes.

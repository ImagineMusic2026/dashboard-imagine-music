import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/logo'

// ── Dados oficiais que aparecem na política ──────────────────────────────────
const EMPRESA = 'Imagine Music' // nome fantasia / marca
const RAZAO_SOCIAL = 'IMAGINE MUSIC LTDA'
const CNPJ = '36.435.325/0001-44'
const ENDERECO = 'Rua Barão de Cotegipe, nº 927, Sala 102, 1º andar, Centro, Feira de Santana/BA, Brasil'
const EMAIL = 'music@imaginegroup.com.br' // e-mail oficial de contato/privacidade
const RETENCAO = '30 dias' // EDITAR se quiser outro prazo de exclusão
const ATUALIZADO = '19 de junho de 2026'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Política de Privacidade — Imagine Music',
  description: 'Como o Painel de Artistas da Imagine trata os dados pessoais, conforme a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-bg-950 text-ink-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/login" className="inline-block">
          <BrandLogo className="h-7" />
        </Link>

        <h1 className="mt-10 text-3xl font-bold text-ink-100">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-ink-500">Última atualização: {ATUALIZADO}</p>

        <p className="mt-6 leading-relaxed">
          O Painel de Artistas (&quot;Painel&quot;) é operado por {RAZAO_SOCIAL} ({EMPRESA},
          &quot;nós&quot;), inscrita no CNPJ {CNPJ}, com sede em {ENDERECO}. Esta Política explica,
          nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a &quot;LGPD&quot;), quais
          dados pessoais tratamos, com qual finalidade e base legal, com quem os compartilhamos e
          quais são os seus direitos.
        </p>

        <Secao titulo="1. Dados que tratamos">
          <p>
            Tratamos dados de duas categorias de titulares: (a){' '}
            <strong className="text-ink-200">membros da equipe</strong> da Imagine, que acessam o
            Painel; e (b) <strong className="text-ink-200">artistas</strong> do selo, cujas métricas
            e receita são consolidadas mediante autorização.
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong className="text-ink-200">Conta de acesso:</strong> nome e e-mail, via Firebase
              Authentication, para autenticar membros da equipe e artistas.
            </li>
            <li>
              <strong className="text-ink-200">Métricas das plataformas que você conecta:</strong>
              <ul className="list-[circle] pl-5 mt-2 space-y-1">
                <li>
                  YouTube: dados públicos do canal (YouTube Data API) e relatórios de Analytics
                  (visualizações, tempo de exibição, inscritos) via YouTube Analytics API.
                </li>
                <li>Instagram: métricas via Meta (Graph API).</li>
                <li>TikTok: perfil e estatísticas públicas (seguidores, curtidas, vídeos).</li>
              </ul>
            </li>
            <li>
              <strong className="text-ink-200">Receita:</strong> dados de royalties importados da
              OneRPM/DDEX.
            </li>
          </ul>
          <p className="mt-3">
            Não coletamos conteúdo privado, mensagens ou quaisquer dados além das métricas
            necessárias para o funcionamento do Painel.
          </p>
        </Secao>

        <Secao titulo="2. Para que usamos os dados (finalidade)">
          <p>
            Usamos os dados <strong className="text-ink-200">exclusivamente</strong> para exibir o
            Painel (saúde do artista, alertas, receita e evolução das métricas). Não usamos os dados
            para publicidade, não os vendemos e não os compartilhamos com terceiros para fins de
            marketing.
          </p>
        </Secao>

        <Secao titulo="3. Base legal do tratamento">
          <p>Cada tratamento se apoia em uma base legal da LGPD (Art. 7º e 11):</p>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong className="text-ink-200">Conta de acesso e funcionamento do Painel:</strong>{' '}
              execução de contrato e legítimo interesse na gestão do portfólio do selo (Art. 7º, V e
              IX).
            </li>
            <li>
              <strong className="text-ink-200">Métricas e receita dos artistas:</strong>{' '}
              consentimento do titular, manifestado ao autorizar a conexão de cada conta (Art. 7º,
              I), e/ou legítimo interesse na gestão da carreira, quando aplicável.
            </li>
            <li>
              <strong className="text-ink-200">Obrigações legais ou regulatórias:</strong> quando
              exigido por lei (Art. 7º, II).
            </li>
          </ul>
          <p className="mt-3">
            Quando o tratamento se basear em consentimento, você pode revogá-lo a qualquer momento
            (ver &quot;Seus direitos&quot;).
          </p>
        </Secao>

        <Secao titulo="4. Uso de dados do Google e do YouTube">
          <p>
            O Painel utiliza os <strong className="text-ink-200">YouTube API Services</strong>. Ao
            conectar sua conta, você concorda com os{' '}
            <A href="https://www.youtube.com/t/terms">Termos de Serviço do YouTube</A>.
          </p>
          <p className="mt-3">
            O uso e a transferência, pelo Painel, das informações recebidas das APIs do Google
            obedecem à{' '}
            <A href="https://developers.google.com/terms/api-services-user-data-policy">
              Política de Dados de Usuário dos Serviços de API do Google
            </A>
            , incluindo os requisitos de Uso Limitado (Limited Use). Consulte também a{' '}
            <A href="https://policies.google.com/privacy">Política de Privacidade do Google</A>.
          </p>
          <p className="mt-3">
            Você pode revogar o acesso a qualquer momento em{' '}
            <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>{' '}
            ou pelo próprio Painel, no botão &quot;Desconectar&quot;.
          </p>
        </Secao>

        <Secao titulo="5. Compartilhamento e operadores">
          <p>
            Para operar o Painel, utilizamos provedores que atuam como{' '}
            <strong className="text-ink-200">operadores</strong> (tratam dados em nosso nome):
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong className="text-ink-200">Google Firebase / Firestore:</strong> autenticação e
              armazenamento.
            </li>
            <li>
              <strong className="text-ink-200">Google/YouTube, Meta/Instagram, TikTok e OneRPM:</strong>{' '}
              fontes das métricas e da receita que você conecta.
            </li>
          </ul>
          <p className="mt-3">
            Não vendemos seus dados nem os compartilhamos para fins de marketing. Só compartilhamos
            com terceiros quando exigido por lei ou por ordem de autoridade competente.
          </p>
        </Secao>

        <Secao titulo="6. Transferência internacional de dados">
          <p>
            Alguns desses provedores (Google/Firebase, Meta, TikTok) armazenam e processam dados em{' '}
            <strong className="text-ink-200">servidores fora do Brasil</strong> (por exemplo, nos
            Estados Unidos). Essas transferências internacionais ocorrem com base nas hipóteses do
            Art. 33 da LGPD e nas cláusulas e padrões de proteção adotados por cada provedor. Ao usar
            o Painel, você está ciente dessa transferência.
          </p>
        </Secao>

        <Secao titulo="7. Armazenamento, segurança e incidentes">
          <p>
            Os dados são armazenados no Google Firebase, com{' '}
            <strong className="text-ink-200">controle de acesso por papel</strong> (admin, marketing
            e artista): cada pessoa acessa apenas o que lhe é permitido. Adotamos medidas técnicas e
            administrativas para proteger os dados.
          </p>
          <p className="mt-3">
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante,
            comunicaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD),
            nos termos do Art. 48 da LGPD.
          </p>
        </Secao>

        <Secao titulo="8. Retenção e exclusão">
          <p>
            Mantemos os dados enquanto a conexão estiver ativa e enquanto necessários às finalidades
            acima. Ao desconectar uma plataforma, interrompemos a coleta; os dados históricos são
            eliminados em até {RETENCAO} após a solicitação de exclusão ou o encerramento do uso,
            salvo quando a guarda for exigida por lei.
          </p>
        </Secao>

        <Secao titulo="9. Cookies e armazenamento local">
          <p>
            O Painel usa <strong className="text-ink-200">cookies e armazenamento local</strong>{' '}
            (localStorage) estritamente necessários para autenticar você e manter a sessão (por
            exemplo, lembrar o e-mail e manter o login). Não utilizamos cookies de publicidade nem
            rastreadores de terceiros.
          </p>
        </Secao>

        <Secao titulo="10. Dados de menores de idade">
          <p>
            O Painel não é destinado a menores de 18 anos como usuários. Caso métricas de um artista{' '}
            <strong className="text-ink-200">menor de idade</strong> sejam tratadas, isso se dá no
            melhor interesse do titular e mediante consentimento e acompanhamento de pelo menos um
            dos pais ou do responsável legal, nos termos do Art. 14 da LGPD.
          </p>
        </Secao>

        <Secao titulo="11. Seus direitos (LGPD)">
          <p>Nos termos do Art. 18 da LGPD, você pode, a qualquer momento:</p>
          <ul className="mt-3 list-disc pl-5 space-y-1.5">
            <li>confirmar a existência de tratamento e acessar seus dados;</li>
            <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>
              solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em
              desconformidade;
            </li>
            <li>solicitar a portabilidade dos dados;</li>
            <li>eliminar dados tratados com base no consentimento;</li>
            <li>obter informação sobre as entidades com quem compartilhamos dados;</li>
            <li>revogar o consentimento e desconectar suas contas;</li>
            <li>ser informado sobre a possibilidade de não consentir e as consequências disso.</li>
          </ul>
          <p className="mt-3">
            Para exercer esses direitos, escreva para <A href={`mailto:${EMAIL}`}>{EMAIL}</A> (nosso
            canal de atendimento; ver Seção 12); responderemos nos prazos da LGPD. Você também pode
            apresentar reclamação à{' '}
            <A href="https://www.gov.br/anpd">
              Autoridade Nacional de Proteção de Dados (ANPD)
            </A>
            .
          </p>
        </Secao>

        <Secao titulo="12. Encarregado e canal de atendimento">
          <p>
            Para tratar de qualquer assunto relativo a dados pessoais e à LGPD (inclusive o
            exercício dos direitos acima), entre em contato com a {EMPRESA} pelo e-mail{' '}
            <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. Esse é o canal oficial de atendimento aos
            titulares e à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Secao>

        <Secao titulo="13. Alterações">
          <p>
            Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas no
            próprio Painel.
          </p>
        </Secao>

        <Secao titulo="14. Contato">
          <p>
            <strong className="text-ink-200">{RAZAO_SOCIAL}</strong> ({EMPRESA})
          </p>
          <p>CNPJ: {CNPJ}</p>
          <p>
            E-mail: <A href={`mailto:${EMAIL}`}>{EMAIL}</A>
          </p>
          <p>{ENDERECO}</p>
        </Secao>

        <div className="mt-12 pt-6 border-t border-bg-700/40 text-sm text-ink-500 flex gap-4">
          <Link href="/login" className="hover:text-ink-300">
            ← Voltar ao login
          </Link>
          <Link href="/termos" className="hover:text-ink-300">
            Termos de Uso
          </Link>
        </div>
      </div>
    </main>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-ink-100">{titulo}</h2>
      <div className="mt-3 leading-relaxed space-y-1">{children}</div>
    </section>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  const externo = href.startsWith('http')
  return (
    <a
      href={href}
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/logo'

// ── EDITAR: dados oficiais que aparecem na política ──────────────────────────
const EMPRESA = 'Imagine Group' // razão social / nome da empresa responsável
const EMAIL = 'imaginemusicdashborad@gmail.com' // e-mail oficial de contato/privacidade
const LOCAL = 'Feira de Santana, BA, Brasil'
const ATUALIZADO = '16 de junho de 2026'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Política de Privacidade — Imagine Music',
  description: 'Como o Painel de Artistas da Imagine trata os dados das plataformas conectadas.',
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
          O {EMPRESA} (&quot;nós&quot;) opera o Painel de Artistas (&quot;Painel&quot;), uma
          ferramenta de acompanhamento de métricas e receita de artistas. Esta política explica
          quais dados tratamos, como os usamos e quais são os seus direitos.
        </p>

        <Secao titulo="1. Dados que tratamos">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-ink-200">Conta de acesso:</strong> nome e e-mail, via Firebase
              Authentication, para autenticar membros da equipe e artistas.
            </li>
            <li>
              <strong className="text-ink-200">Métricas das plataformas que você conecta:</strong>
              <ul className="list-[circle] pl-5 mt-2 space-y-1">
                <li>
                  YouTube: dados públicos do canal (YouTube Data API) e relatórios de Analytics —
                  visualizações, tempo de exibição, inscritos — via YouTube Analytics API.
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

        <Secao titulo="2. Como usamos os dados">
          <p>
            Usamos os dados <strong className="text-ink-200">exclusivamente</strong> para exibir o
            Painel (saúde do artista, alertas, receita e evolução das métricas). Não usamos os dados
            para publicidade, não os vendemos e não os compartilhamos com terceiros para fins de
            marketing.
          </p>
        </Secao>

        <Secao titulo="3. Uso de dados do Google e do YouTube">
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
            <A href="https://myaccount.google.com/permissions">
              myaccount.google.com/permissions
            </A>{' '}
            ou pelo próprio Painel, no botão &quot;Desconectar&quot;.
          </p>
        </Secao>

        <Secao titulo="4. Compartilhamento">
          <p>
            Utilizamos provedores de infraestrutura (Google Firebase/Firestore) para autenticação e
            armazenamento. Não compartilhamos seus dados com outros terceiros, exceto quando exigido
            por lei.
          </p>
        </Secao>

        <Secao titulo="5. Armazenamento e segurança">
          <p>
            Os dados são armazenados no Google Firebase. Aplicamos controle de acesso por papel
            (admin, marketing e artista), de modo que cada pessoa só acessa o que lhe é permitido.
          </p>
        </Secao>

        <Secao titulo="6. Seus direitos (LGPD)">
          <p>
            Nos termos da Lei Geral de Proteção de Dados, você pode solicitar acesso, correção ou
            exclusão dos seus dados e desconectar suas contas a qualquer momento. Para exercer esses
            direitos, escreva para <A href={`mailto:${EMAIL}`}>{EMAIL}</A>.
          </p>
        </Secao>

        <Secao titulo="7. Retenção e exclusão">
          <p>
            Mantemos os dados enquanto a conexão estiver ativa. Ao desconectar uma plataforma,
            interrompemos a coleta; o histórico pode ser removido mediante solicitação.
          </p>
        </Secao>

        <Secao titulo="8. Alterações">
          <p>
            Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas no
            próprio Painel.
          </p>
        </Secao>

        <Secao titulo="9. Contato">
          <p>
            {EMPRESA} — <A href={`mailto:${EMAIL}`}>{EMAIL}</A> — {LOCAL}.
          </p>
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

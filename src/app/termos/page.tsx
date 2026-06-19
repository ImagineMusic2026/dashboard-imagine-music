import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo } from '@/components/shared/logo'

// ── Dados oficiais que aparecem nos termos ───────────────────────────────────
const EMPRESA = 'Imagine Music' // nome fantasia / marca
const RAZAO_SOCIAL = 'IMAGINE MUSIC LTDA'
const CNPJ = '36.435.325/0001-44'
const EMAIL = 'music@imaginegroup.com.br' // e-mail oficial de contato
const FORO = 'Feira de Santana, BA'
const ATUALIZADO = '19 de junho de 2026'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Termos de Uso — Imagine Music',
  description: 'Termos de uso do Painel de Artistas da Imagine.',
}

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-bg-950 text-ink-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/login" className="inline-block">
          <BrandLogo className="h-7" />
        </Link>

        <h1 className="mt-10 text-3xl font-bold text-ink-100">Termos de Uso</h1>
        <p className="mt-2 text-sm text-ink-500">Última atualização: {ATUALIZADO}</p>

        <p className="mt-6 leading-relaxed">
          Estes Termos regem o uso do Painel de Artistas (&quot;Painel&quot;), operado por{' '}
          {RAZAO_SOCIAL} ({EMPRESA}), inscrita no CNPJ {CNPJ}. Ao acessar o Painel, você concorda
          com estes Termos.
        </p>

        <Secao titulo="1. O serviço">
          <p>
            O Painel é uma ferramenta de acompanhamento de métricas e receita de artistas, que
            consolida dados de plataformas como YouTube, Instagram, TikTok e OneRPM mediante
            autorização do titular de cada conta.
          </p>
        </Secao>

        <Secao titulo="2. Acesso e contas">
          <p>
            O acesso é concedido <strong className="text-ink-200">por convite</strong>, para uso
            profissional pela equipe do selo e pelos artistas. Não se trata de serviço de consumo
            direcionado ao público geral. Você declara ter capacidade civil para aceitar estes
            Termos (ou contar com a autorização e assistência do responsável legal, se menor de
            idade) e é responsável por manter a confidencialidade da sua senha e por toda atividade
            realizada na sua conta.
          </p>
        </Secao>

        <Secao titulo="3. Integrações de terceiros">
          <p>
            O Painel se conecta a serviços de terceiros (Google/YouTube, Meta/Instagram, TikTok e
            OneRPM). O uso desses serviços está sujeito aos termos e políticas de cada um. A conexão
            é opcional e pode ser desfeita a qualquer momento.
          </p>
        </Secao>

        <Secao titulo="4. Proteção de dados (LGPD)">
          <p>
            O tratamento de dados pessoais no âmbito do Painel observa a nossa{' '}
            <Link
              href="/privacidade"
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Política de Privacidade
            </Link>{' '}
            e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD). A Imagine atua como{' '}
            <strong className="text-ink-200">controladora</strong> dos dados tratados no Painel, e os
            provedores de infraestrutura, como <strong className="text-ink-200">operadores</strong>.
            Ao conectar contas e inserir dados, você declara possuir as autorizações necessárias dos
            respectivos titulares.
          </p>
        </Secao>

        <Secao titulo="5. Uso aceitável">
          <p>
            Você concorda em não usar o Painel para fins ilícitos, em não tentar acessar dados de
            terceiros sem autorização e em não comprometer a segurança do serviço.
          </p>
        </Secao>

        <Secao titulo="6. Propriedade intelectual">
          <p>
            A marca, o layout e o software do Painel pertencem à Imagine. Os dados das plataformas
            permanecem de titularidade de seus respectivos donos.
          </p>
        </Secao>

        <Secao titulo="7. Isenção de garantias">
          <p>
            O Painel é fornecido &quot;no estado em que se encontra&quot;, sem garantias de
            disponibilidade ininterrupta ou de exatidão das métricas, que dependem das APIs de
            terceiros.
          </p>
        </Secao>

        <Secao titulo="8. Limitação de responsabilidade">
          <p>
            Na máxima extensão permitida em lei, a Imagine não se responsabiliza por danos indiretos
            decorrentes do uso ou da indisponibilidade do Painel.
          </p>
        </Secao>

        <Secao titulo="9. Alterações">
          <p>
            Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas no Painel. O uso
            continuado após as alterações representa concordância.
          </p>
        </Secao>

        <Secao titulo="10. Lei aplicável e foro">
          <p>
            Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro de {FORO} para dirimir
            quaisquer controvérsias.
          </p>
        </Secao>

        <Secao titulo="11. Contato">
          <p>
            <strong className="text-ink-200">{RAZAO_SOCIAL}</strong> ({EMPRESA})
          </p>
          <p>CNPJ: {CNPJ}</p>
          <p>
            E-mail:{' '}
            <a
              href={`mailto:${EMAIL}`}
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              {EMAIL}
            </a>
          </p>
        </Secao>

        <div className="mt-12 pt-6 border-t border-bg-700/40 text-sm text-ink-500 flex gap-4">
          <Link href="/login" className="hover:text-ink-300">
            ← Voltar ao login
          </Link>
          <Link href="/privacidade" className="hover:text-ink-300">
            Política de Privacidade
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

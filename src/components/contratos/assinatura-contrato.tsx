'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Download, Loader2 } from 'lucide-react'
import { AssinaturaCanvas } from '@/components/contratos/assinatura-canvas'
import { ContratoTexto } from '@/components/contratos/contrato-texto'
import { imprimirContrato } from '@/lib/contratos/imprimir'
import { renderizar } from '@/lib/contratos/modelo'
import { assinarViaLink, type ContratoViaLink } from '@/lib/contratos/publico'
import { dataPorExtenso } from '@/lib/contratos/tipos'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/**
 * O que o artista vê no link: o contrato inteiro, os dados que faltam e o
 * quadro de assinatura.
 *
 * O texto é montado com `renderizar` sobre os `valoresBase` que o SERVIDOR
 * mandou — a página não calcula data, vigência nem percentual. É isso que faz o
 * texto lido aqui ser idêntico ao texto que o servidor vai hashear ao gravar a
 * assinatura; se cada lado montasse o seu, o código de verificação do documento
 * não significaria nada.
 *
 * O contrato aparece ANTES do formulário de propósito: assinar é o último ato
 * da página, não o primeiro.
 */
export function AssinaturaContrato({
  dados,
  token,
}: {
  dados: ContratoViaLink
  token: string
}) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [imagem, setImagem] = useState<string | null>(null)
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [assinado, setAssinado] = useState(dados.assinado)
  const [assinaturaFeita, setAssinaturaFeita] = useState(dados.assinaturas.artista)

  const texto = useMemo(
    () => renderizar(dados.texto, { ...dados.valoresBase, ...valores }),
    [dados.texto, dados.valoresBase, valores],
  )

  function baixar() {
    imprimirContrato({
      modeloNome: dados.modeloNome,
      artistaNome: dados.artistaNome,
      tipoLabel: dados.tipoLabel,
      texto,
      emitidoEm: dados.emitidoEm,
      vigencia: dados.vigencia,
      assinaturaArtista: assinaturaFeita,
      assinaturaImagine: dados.assinaturas.imagine,
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!imagem) {
      setErro('Desenhe a sua assinatura no quadro.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const r = await assinarViaLink(token, { valores, nome, documento, imagem })
      if (!r.ok) {
        // Recusa do servidor é definitiva (falta campo, já assinado): repetir o
        // envio não resolve, e esconder o motivo deixaria a tela mentindo.
        setErro(r.erro)
        setEnviando(false)
        return
      }
      // A assinatura mostrada no recibo é a que ACABOU de ir — o carimbo oficial
      // (data do servidor, IP, hash) está gravado no painel; aqui basta o que a
      // pessoa precisa ver pra saber que deu certo.
      setAssinaturaFeita({
        nome,
        documento: documento || null,
        imagem,
        em: new Date().toISOString(),
        hash: '',
      })
      setAssinado(true)
    } catch {
      setErro('Não consegui enviar agora. Confira a conexão e tente de novo.')
      setEnviando(false)
    }
  }

  if (assinado) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-ink-100">Contrato assinado</h1>
            <p className="text-sm text-ink-300 mt-1 leading-relaxed">
              Sua assinatura foi registrada
              {assinaturaFeita?.em
                ? ` em ${new Date(assinaturaFeita.em).toLocaleDateString('pt-BR')}`
                : ''}
              . A equipe da Imagine assina em seguida e você recebe a via final.
            </p>
            <button
              type="button"
              onClick={baixar}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-900 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-[12px] font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden />
              Baixar a minha via
            </button>
          </div>
        </div>

        <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
          <ContratoTexto texto={texto} />
        </section>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h1 className="text-xl font-bold text-ink-100">{dados.modeloNome}</h1>
        <p className="text-sm text-ink-400 mt-1">
          Leia o contrato, preencha os seus dados e assine no fim da página. Vigência:{' '}
          {dataPorExtenso(dados.vigencia.inicio)}
          {dados.vigencia.fim ? ` a ${dataPorExtenso(dados.vigencia.fim)}` : ', por prazo indeterminado'}.
        </p>
      </div>

      <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 max-h-[32rem] overflow-y-auto">
        <ContratoTexto texto={texto} />
      </section>

      {dados.campos.length > 0 && (
        <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-ink-100">Os seus dados</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">
              Vão para o texto acima conforme você digita.
            </p>
          </div>
          {dados.campos.map((c) => (
            <div key={c.chave}>
              <label htmlFor={`ac-${c.chave}`} className={rotulo}>
                {c.rotulo}
                {!c.obrigatorio && <span className="text-ink-600"> (opcional)</span>}
              </label>
              {c.formato === 'texto-longo' ? (
                <textarea
                  id={`ac-${c.chave}`}
                  value={valores[c.chave] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                  rows={3}
                  className={cn(campo, 'resize-y')}
                />
              ) : (
                <input
                  id={`ac-${c.chave}`}
                  type={c.formato === 'data' ? 'date' : c.formato === 'email' ? 'email' : 'text'}
                  inputMode={
                    c.formato === 'cpf' || c.formato === 'cnpj' || c.formato === 'telefone'
                      ? 'numeric'
                      : undefined
                  }
                  value={valores[c.chave] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                  className={campo}
                />
              )}
              {c.ajuda && <p className="text-[11px] text-ink-600 mt-1">{c.ajuda}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-ink-100">Assinatura</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ac-nome" className={rotulo}>
              Nome de quem assina
            </label>
            <input
              id="ac-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="ac-doc" className={rotulo}>
              CPF de quem assina
            </label>
            <input
              id="ac-doc"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className={campo}
            />
          </div>
        </div>

        <AssinaturaCanvas onChange={setImagem} />

        <label className="flex items-start gap-2.5 text-[12px] text-ink-300 leading-relaxed">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="accent-violet-500 mt-0.5 shrink-0"
          />
          <span>
            Li o contrato acima, concordo com os seus termos e assino eletronicamente, nos termos da
            MP nº 2.200-2/2001 e da Lei nº 14.063/2020. Entendo que a data, o endereço IP e um
            código de verificação do documento ficam registrados como prova desta assinatura.
          </span>
        </label>

        {erro && (
          <p className="text-[12px] text-red-400" role="alert">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !aceite || !imagem || !nome.trim()}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
          {enviando ? 'Registrando…' : 'Assinar o contrato'}
        </button>
      </section>
    </form>
  )
}

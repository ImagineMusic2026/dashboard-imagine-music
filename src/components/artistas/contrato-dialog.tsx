'use client'

import { useState, type FormEvent } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import {
  atualizarContrato,
  criarContrato,
  linkValido,
  tipoContratoMeta,
  TIPOS_CONTRATO,
  type Contrato,
  type TipoContrato,
} from '@/lib/contratos/client'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/** Formulário de criar/editar contrato do artista. */
export function ContratoDialog({
  slug,
  contrato,
  uid,
  onClose,
  onSalvo,
}: {
  slug: string
  contrato: Contrato | null
  uid: string
  onClose: () => void
  onSalvo: () => void | Promise<void>
}) {
  const editando = !!contrato
  const [tipo, setTipo] = useState<TipoContrato>(contrato?.tipo ?? 'agenciamento')
  const [titulo, setTitulo] = useState(contrato?.titulo ?? '')
  const [inicio, setInicio] = useState(contrato?.inicio ?? '')
  const [fim, setFim] = useState(contrato?.fim ?? '')
  // Doc já salvo sem `fim` é prazo indeterminado; doc novo começa com prazo.
  const [indeterminado, setIndeterminado] = useState(editando ? !contrato?.fim : false)
  const [encerrado, setEncerrado] = useState(!!contrato?.encerrado)
  const [percentual, setPercentual] = useState(
    contrato?.percentual != null ? String(contrato.percentual) : '',
  )
  const [arquivoUrl, setArquivoUrl] = useState(contrato?.arquivoUrl ?? '')
  const [observacoes, setObservacoes] = useState(contrato?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)

    if (!inicio) {
      setErro('Informe a data de início da vigência.')
      return
    }
    if (!indeterminado && fim && fim < inicio) {
      setErro('O fim da vigência não pode ser antes do início.')
      return
    }
    const url = arquivoUrl.trim()
    if (url && !linkValido(url)) {
      setErro('O link do documento precisa começar com http:// ou https://.')
      return
    }
    const pct = percentual.trim() ? Number(percentual.replace(',', '.')) : null
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      setErro('O percentual precisa ser um número entre 0 e 100.')
      return
    }

    setSalvando(true)
    try {
      const dados = {
        tipo,
        titulo,
        inicio,
        fim: indeterminado ? null : fim || null,
        encerrado,
        arquivoUrl: url || null,
        percentual: pct,
        observacoes,
      }
      if (editando && contrato) await atualizarContrato(slug, contrato.id, dados)
      else await criarContrato(slug, dados, uid)
      await onSalvo()
    } catch (err) {
      setErro(
        err instanceof FirebaseError && err.code === 'permission-denied'
          ? 'Sem permissão para contratos. Um admin libera em Configurações → Permissões.'
          : 'Não foi possível salvar o contrato.',
      )
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl">
          <div className="font-bold text-ink-100">{editando ? 'Editar contrato' : 'Novo contrato'}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form className="p-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ct-tipo" className={rotulo}>
                Tipo
              </label>
              <select
                id="ct-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoContrato)}
                className={campo}
              >
                {TIPOS_CONTRATO.map((t) => (
                  <option key={t} value={t}>
                    {tipoContratoMeta[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ct-pct" className={rotulo}>
                Percentual (%)
              </label>
              <input
                id="ct-pct"
                type="text"
                inputMode="decimal"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                placeholder="Ex.: 20"
                className={cn(campo, 'num')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ct-titulo" className={rotulo}>
              Identificação (opcional)
            </label>
            <input
              id="ct-titulo"
              type="text"
              value={titulo ?? ''}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Aditivo — turnê 2026"
              className={campo}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ct-inicio" className={rotulo}>
                Início
              </label>
              <input
                id="ct-inicio"
                type="date"
                required
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className={cn(campo, '[color-scheme:dark]')}
              />
            </div>
            <div>
              <label htmlFor="ct-fim" className={rotulo}>
                Fim
              </label>
              <input
                id="ct-fim"
                type="date"
                value={fim ?? ''}
                disabled={indeterminado}
                onChange={(e) => setFim(e.target.value)}
                className={cn(campo, '[color-scheme:dark]', indeterminado && 'opacity-40')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[13px] text-ink-300 cursor-pointer">
              <input
                type="checkbox"
                checked={indeterminado}
                onChange={(e) => setIndeterminado(e.target.checked)}
                className="accent-violet-500 w-4 h-4"
              />
              Prazo indeterminado
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-300 cursor-pointer">
              <input
                type="checkbox"
                checked={encerrado}
                onChange={(e) => setEncerrado(e.target.checked)}
                className="accent-violet-500 w-4 h-4"
              />
              Encerrado / rescindido
            </label>
          </div>

          <div>
            <label htmlFor="ct-url" className={rotulo}>
              Link do documento
            </label>
            <input
              id="ct-url"
              type="url"
              value={arquivoUrl ?? ''}
              onChange={(e) => setArquivoUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className={campo}
            />
            <p className="text-[11px] text-ink-500 mt-1.5 leading-relaxed">
              O painel guarda o link, não o arquivo. Suba o PDF digitalizado no Drive da
              Imagine e cole aqui o link de compartilhamento — confira que a equipe tem
              acesso à pasta, senão o link abre negado.
            </p>
          </div>

          <div>
            <label htmlFor="ct-obs" className={rotulo}>
              Observações (opcional)
            </label>
            <textarea
              id="ct-obs"
              rows={2}
              value={observacoes ?? ''}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Cláusulas que a equipe precisa lembrar, renovação automática…"
              className={cn(campo, 'resize-none')}
            />
          </div>

          {erro && (
            <div
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            aria-busy={salvando}
            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 disabled:cursor-wait text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando && <RefreshCw className="w-4 h-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar contrato'}
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { carregarConfigContratos } from '@/lib/contratos/config'
import { criarContratoGerado } from '@/lib/contratos/client'
import { criarLinkContrato, urlDoLinkContrato } from '@/lib/contratos/links'
import { blocosDe, camposDe, faltando, renderizar, valoresAutomaticos } from '@/lib/contratos/modelo'
import { tipoContratoMeta, type ModeloContrato } from '@/lib/contratos/tipos'
import { copiarTexto } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/**
 * Emitir um contrato a partir de um modelo e gerar o link pro artista assinar.
 *
 * O que a equipe preenche aqui é a ficha (vigência, percentual) mais os campos
 * marcados como `equipe` no modelo. O resto é do artista e nem aparece — se o
 * painel deixasse a equipe responder pelo artista, a assinatura dele deixaria
 * de significar o que diz que significa.
 *
 * A prévia existe pelo mesmo motivo: o texto que vai ser assinado é montado uma
 * vez só, em `renderizar`, e é este mesmo que o artista lê e que sai no PDF.
 */
export function GerarContratoDialog({
  slug,
  artistaNome,
  uid,
  onClose,
  onGerado,
}: {
  slug: string
  artistaNome: string
  uid: string
  onClose: () => void
  onGerado: (url: string) => void | Promise<void>
}) {
  const [modelos, setModelos] = useState<ModeloContrato[] | null>(null)
  const [modeloKey, setModeloKey] = useState('')
  const [titulo, setTitulo] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [semFim, setSemFim] = useState(false)
  const [percentual, setPercentual] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [previa, setPrevia] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    carregarConfigContratos()
      .then((c) => {
        if (!vivo) return
        setModelos(c.modelos)
        if (c.modelos[0]) setModeloKey(c.modelos[0].key)
      })
      .catch(() => vivo && setModelos([]))
    return () => {
      vivo = false
    }
  }, [])

  const modelo = modelos?.find((m) => m.key === modeloKey) ?? null
  const daEquipe = modelo ? camposDe(modelo.campos, 'equipe') : []

  const texto = useMemo(() => {
    if (!modelo) return ''
    const pct = Number(percentual.replace(',', '.'))
    return renderizar(modelo.texto, {
      ...valoresAutomaticos({
        artistaNome,
        inicio: inicio || null,
        fim: semFim ? null : fim || null,
        percentual: Number.isFinite(pct) && percentual.trim() ? pct : null,
      }),
      ...valores,
    })
  }, [modelo, artistaNome, inicio, fim, semFim, percentual, valores])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!modelo) return
    if (!inicio) {
      setErro('A vigência precisa de uma data de início.')
      return
    }
    if (!semFim && fim && fim < inicio) {
      setErro('O fim da vigência não pode ser antes do início.')
      return
    }
    const faltam = faltando(modelo.campos, valores, 'equipe')
    if (faltam.length) {
      setErro(`Falta preencher: ${faltam.map((c) => c.rotulo).join(', ')}.`)
      return
    }

    setSalvando(true)
    setErro(null)

    // Duas escritas, duas mensagens. São passos separados de propósito: se a
    // segunda falhar, o contrato JÁ EXISTE, e dizer "não consegui emitir"
    // mandaria a pessoa emitir de novo e duplicar o documento. O link é
    // recuperável — o card oferece "Gerar o link de assinatura".
    let id: string
    try {
      const pct = Number(percentual.replace(',', '.'))
      id = await criarContratoGerado(
        slug,
        modelo,
        {
          tipo: modelo.tipo,
          titulo: titulo.trim() || null,
          inicio,
          fim: semFim ? null : fim || null,
          percentual: percentual.trim() && Number.isFinite(pct) ? pct : null,
        },
        valores,
        uid,
      )
    } catch (e) {
      const negado = e instanceof FirebaseError && e.code === 'permission-denied'
      setErro(
        negado
          ? 'As regras recusaram a escrita. Um admin libera em Configurações → Permissões.'
          : 'Não consegui emitir o contrato. Tente de novo.',
      )
      setSalvando(false)
      return
    }

    try {
      const link = await criarLinkContrato(slug, id, uid)
      const url = urlDoLinkContrato(link.token)
      await copiarTexto(url)
      await onGerado(url)
    } catch {
      await onGerado('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl z-10">
          <div className="font-bold text-ink-100">Gerar contrato</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {modelos === null ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-ink-400">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            Carregando os modelos…
          </div>
        ) : !modelos.length ? (
          <div className="p-6">
            <p className="text-sm text-ink-300">
              Nenhum modelo de contrato cadastrado. Um admin cria em{' '}
              <strong className="text-ink-100">Configurações → Modelos de contrato</strong>.
            </p>
          </div>
        ) : (
          <form className="p-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="gc-modelo" className={rotulo}>
                Modelo
              </label>
              <select
                id="gc-modelo"
                value={modeloKey}
                onChange={(e) => {
                  setModeloKey(e.target.value)
                  // Os valores são por modelo: manter o que foi digitado pro
                  // modelo anterior gravaria resposta numa chave que o novo nem
                  // tem — e `limparValores` descartaria calado.
                  setValores({})
                }}
                className={campo}
              >
                {modelos.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.nome}
                  </option>
                ))}
              </select>
              {modelo && (
                <p className="text-[11px] text-ink-600 mt-1">
                  {tipoContratoMeta[modelo.tipo].label} ·{' '}
                  {camposDe(modelo.campos, 'artista').length} campo
                  {camposDe(modelo.campos, 'artista').length === 1 ? '' : 's'} pro artista
                  preencher.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gc-inicio" className={rotulo}>
                  Início da vigência
                </label>
                <input
                  id="gc-inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className={campo}
                />
              </div>
              <div>
                <label htmlFor="gc-fim" className={rotulo}>
                  Fim da vigência
                </label>
                <input
                  id="gc-fim"
                  type="date"
                  value={fim}
                  disabled={semFim}
                  onChange={(e) => setFim(e.target.value)}
                  className={cn(campo, semFim && 'opacity-40')}
                />
                <label className="flex items-center gap-2 text-[12px] text-ink-400 mt-1.5">
                  <input
                    type="checkbox"
                    checked={semFim}
                    onChange={(e) => setSemFim(e.target.checked)}
                    className="accent-violet-500"
                  />
                  Prazo indeterminado
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gc-pct" className={rotulo}>
                  Percentual (%)
                </label>
                <input
                  id="gc-pct"
                  type="text"
                  inputMode="decimal"
                  value={percentual}
                  onChange={(e) => setPercentual(e.target.value)}
                  placeholder="Ex.: 20"
                  className={cn(campo, 'num')}
                />
              </div>
              <div>
                <label htmlFor="gc-titulo" className={rotulo}>
                  Identificação (opcional)
                </label>
                <input
                  id="gc-titulo"
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Aditivo — turnê 2026"
                  className={campo}
                />
              </div>
            </div>

            {daEquipe.length > 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  O que a equipe preenche
                </p>
                {daEquipe.map((c) => (
                  <div key={c.chave}>
                    <label htmlFor={`gc-${c.chave}`} className={rotulo}>
                      {c.rotulo}
                      {!c.obrigatorio && <span className="text-ink-600"> (opcional)</span>}
                    </label>
                    {c.formato === 'texto-longo' ? (
                      <textarea
                        id={`gc-${c.chave}`}
                        value={valores[c.chave] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                        rows={3}
                        className={cn(campo, 'resize-y')}
                      />
                    ) : (
                      <input
                        id={`gc-${c.chave}`}
                        type={c.formato === 'data' ? 'date' : 'text'}
                        value={valores[c.chave] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                        className={campo}
                      />
                    )}
                    {c.ajuda && <p className="text-[11px] text-ink-600 mt-1">{c.ajuda}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-bg-700/40 pt-3">
              <button
                type="button"
                onClick={() => setPrevia((p) => !p)}
                aria-expanded={previa}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                {previa ? (
                  <EyeOff className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <Eye className="w-3.5 h-3.5" aria-hidden />
                )}
                {previa ? 'Esconder a prévia' : 'Ver como vai ficar'}
              </button>
              {previa && (
                <div className="mt-3 max-h-64 overflow-y-auto bg-bg-950 border border-bg-700/40 rounded-lg p-4 space-y-3">
                  {blocosDe(texto).map((b, i) =>
                    b.tipo === 'titulo' ? (
                      <p key={i} className="text-[11px] font-bold tracking-wide text-violet-300">
                        {b.texto}
                      </p>
                    ) : (
                      <p key={i} className="text-[12px] leading-relaxed text-ink-300 whitespace-pre-wrap">
                        {b.texto}
                      </p>
                    ),
                  )}
                  <p className="text-[11px] text-ink-600 pt-1">
                    Os <code>__________</code> são o que o artista ainda vai preencher.
                  </p>
                </div>
              )}
            </div>

            {erro && (
              <p className="text-[12px] text-red-400" role="alert">
                {erro}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-ink-300 hover:bg-bg-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || !modelo}
                className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
              >
                {salvando ? 'Emitindo…' : 'Emitir e copiar o link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  lerStatusContrato,
  salvarStatusContrato,
  statusContratoValido,
  STATUS_CONTRATO_OPCOES,
  type StatusContrato,
} from '@/lib/contratos/client'

export function StatusContratoForm({ slug }: { slug: string }) {
  const id = useId()
  const [salvo, setSalvo] = useState<StatusContrato | '' | null>(null)
  const [selecao, setSelecao] = useState<StatusContrato | ''>('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const podeSalvar = salvo !== null && selecao !== '' && selecao !== salvo && !salvando

  useEffect(() => {
    let ativo = true
    lerStatusContrato(slug)
      .then((status) => {
        if (!ativo) return
        setSalvo(status)
        setSelecao(status)
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar o status do contrato.')
      })
    return () => {
      ativo = false
    }
  }, [slug])

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!podeSalvar) return
    setSalvando(true)
    setErro('')
    try {
      await salvarStatusContrato(slug, selecao)
      setSalvo(selecao)
      setConfirmado(true)
    } catch {
      setErro('Não foi possível salvar o status. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="border-b border-bg-700/30 px-5 py-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-200">
        Status do contrato
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          id={id}
          value={selecao}
          disabled={salvo === null || salvando}
          aria-describedby={`${id}-ajuda`}
          onChange={({ target }) => {
            if (!statusContratoValido(target.value)) return
            setSelecao(target.value)
            setConfirmado(false)
            setErro('')
          }}
          className="min-w-0 w-full sm:w-60 rounded-lg border border-bg-700/50 bg-bg-950 px-3 py-2 text-sm text-ink-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
        >
          <option value="" disabled>
            {salvo === null && !erro ? 'Carregando…' : 'Selecionar status'}
          </option>
          {STATUS_CONTRATO_OPCOES.map(({ valor, rotulo }) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!podeSalvar}
          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar status'}
        </button>
        {confirmado && <span role="status" className="text-xs text-emerald-400">Status salvo.</span>}
      </div>
      <p id={`${id}-ajuda`} className="mt-2 text-xs text-ink-400">
        Acompanhamento interno, inclusive para contratos tratados fora do painel.
      </p>
      {erro && <p role="alert" className="mt-2 text-xs text-red-400">{erro}</p>}
    </form>
  )
}

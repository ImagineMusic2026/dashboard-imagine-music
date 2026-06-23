'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { cn } from '@/lib/utils'

/**
 * Campos de formulário compartilhados entre criar e editar artista — pra os dois
 * terem o mesmo visual e comportamento (estilo do input, label de rede e o
 * combobox de gênero com teclado).
 */

export const INPUT =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

const GENEROS = ['Sertanejo', 'Piseiro', 'Forró', 'Pagode', 'Funk', 'Gospel', 'MPB', 'Pop', 'Rock', 'Rap', 'Arrocha', 'Brega', 'Axé', 'Eletrônica']

export function RedeLabel({ tipo, cor, htmlFor }: { tipo: PlataformaTipo; cor: string; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-1.5 capitalize">
      <span className={cn('w-4 h-4 block', cor)}>
        <PlataformaIcon tipo={tipo} />
      </span>
      {tipo}
      <span className="text-ink-500 font-normal text-xs lowercase">· opcional</span>
    </label>
  )
}

/** Normaliza pra busca: sem acentos, minúsculo, sem espaços nas pontas. */
function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Combobox de gênero: input com sugestões filtráveis (tema do painel), com
 * teclado (↑/↓/Enter/Esc) e aceitando texto livre fora da lista.
 */
export function GeneroCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [destaque, setDestaque] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  // Gêneros que casam com o texto + a opção "Adicionar" quando o texto digitado
  // não é um gênero conhecido — permite cadastrar um gênero fora da lista.
  const itens = useMemo<{ tipo: 'genero' | 'novo'; valor: string }[]>(() => {
    const q = norm(value)
    const gen = q ? GENEROS.filter((g) => norm(g).includes(q)) : GENEROS
    const lista: { tipo: 'genero' | 'novo'; valor: string }[] = gen.map((g) => ({ tipo: 'genero', valor: g }))
    const texto = value.trim()
    if (texto && !GENEROS.some((g) => norm(g) === q)) lista.push({ tipo: 'novo', valor: texto })
    return lista
  }, [value])

  useEffect(() => {
    if (!aberto) return
    const aoClicarFora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function escolher(g: string) {
    onChange(g)
    setAberto(false)
    setDestaque(-1)
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!aberto) setAberto(true)
      setDestaque((d) => Math.min(d + 1, itens.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaque((d) => Math.max(d - 1, 0))
    } else if (e.key === 'Enter' && aberto && destaque >= 0 && itens[destaque]) {
      e.preventDefault()
      escolher(itens[destaque].valor)
    } else if (e.key === 'Escape') {
      setAberto(false)
      setDestaque(-1)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <input
        id="art-genero"
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setAberto(true)
          setDestaque(-1)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        placeholder="Ex.: Sertanejo, Piseiro, Forró…"
        className={cn(INPUT, 'pr-9')}
        role="combobox"
        aria-expanded={aberto}
        aria-controls="genero-listbox"
        aria-autocomplete="list"
        autoComplete="off"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setAberto((a) => !a)}
        aria-label="Mostrar gêneros"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-500 hover:text-ink-300 transition-colors"
      >
        <ChevronDown className={cn('w-4 h-4 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && itens.length > 0 && (
        <ul
          id="genero-listbox"
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-bg-800 border border-bg-700/60 rounded-lg shadow-xl py-1"
        >
          {itens.map((item, i) =>
            item.tipo === 'novo' ? (
              <li
                key="__novo__"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault()
                  escolher(item.valor)
                }}
                onMouseEnter={() => setDestaque(i)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 border-t border-bg-700/50 transition-colors',
                  i === destaque ? 'bg-violet-500/15 text-violet-200' : 'text-violet-300'
                )}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Adicionar “{item.valor}”
              </li>
            ) : (
              <li
                key={item.valor}
                role="option"
                aria-selected={value === item.valor}
                onMouseDown={(e) => {
                  e.preventDefault()
                  escolher(item.valor)
                }}
                onMouseEnter={() => setDestaque(i)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors',
                  i === destaque ? 'bg-violet-500/15 text-violet-200' : 'text-ink-200'
                )}
              >
                {item.valor}
                {value === item.valor && <Check className="w-3.5 h-3.5 text-violet-300 shrink-0" />}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

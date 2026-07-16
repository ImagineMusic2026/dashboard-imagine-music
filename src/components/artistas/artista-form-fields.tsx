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

export const TEXTAREA = cn(INPUT, 'resize-y min-h-[72px] leading-relaxed')

const GENEROS = ['Sertanejo', 'Piseiro', 'Forró', 'Pagode', 'Funk', 'Gospel', 'MPB', 'Pop', 'Rock', 'Rap', 'Arrocha', 'Brega', 'Axé', 'Eletrônica']

/** Serviços que o selo presta — espelha o card de estruturação do Pipefy. */
export const SERVICOS_PREVISTOS = [
  'Estruturação estratégica',
  'Assessoria de Marketing',
  'Tráfego Pago',
  'Selo digital',
  'Produção de Vídeo',
]

/** Lado COMERCIAL do cadastro: a relação do selo com o artista, não a presença dele nas plataformas. */
export interface DadosProjeto {
  contaArtistaSelo: string
  emailProjeto: string
  servicosPrevistos: string[]
  anotacoesGerais: string
}

export const PROJETO_VAZIO: DadosProjeto = {
  contaArtistaSelo: '',
  emailProjeto: '',
  servicosPrevistos: [],
  anotacoesGerais: '',
}

/** Aceita o que vier do Firestore (campo ausente, tipo errado) sem quebrar o form. */
export function projetoDeDoc(x: Partial<Record<keyof DadosProjeto, unknown>> | null | undefined): DadosProjeto {
  return {
    contaArtistaSelo: typeof x?.contaArtistaSelo === 'string' ? x.contaArtistaSelo : '',
    emailProjeto: typeof x?.emailProjeto === 'string' ? x.emailProjeto : '',
    servicosPrevistos: Array.isArray(x?.servicosPrevistos) ? x.servicosPrevistos.filter((s): s is string => typeof s === 'string') : [],
    anotacoesGerais: typeof x?.anotacoesGerais === 'string' ? x.anotacoesGerais : '',
  }
}

function Checkbox({ marcado, onChange, rotulo }: { marcado: boolean; onChange: () => void; rotulo: string }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink-200 cursor-pointer select-none group">
      <input type="checkbox" checked={marcado} onChange={onChange} className="sr-only peer" />
      <span
        aria-hidden
        className={cn(
          'w-4 h-4 rounded border grid place-items-center shrink-0 transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500/40',
          marcado ? 'bg-violet-500 border-violet-500' : 'border-bg-700 group-hover:border-bg-600'
        )}
      >
        {marcado && <Check className="w-3 h-3 text-white" />}
      </span>
      {rotulo}
    </label>
  )
}

/**
 * Bloco "Projeto" do cadastro, compartilhado entre criar e editar pra os dois não
 * divergirem. `idPrefixo` evita colisão de id quando os dois dialogs coexistem.
 */
export function CamposProjeto({
  valor,
  onChange,
  idPrefixo,
}: {
  valor: DadosProjeto
  onChange: (v: DadosProjeto) => void
  idPrefixo: string
}) {
  const set = <K extends keyof DadosProjeto>(k: K, v: DadosProjeto[K]) => onChange({ ...valor, [k]: v })

  return (
    <div className="space-y-4 pt-4 border-t border-bg-700/40">
      <div className="text-[11px] tracking-wider font-bold text-ink-500 uppercase">Projeto</div>

      <div>
        <label htmlFor={`${idPrefixo}-conta-selo`} className="block text-sm font-medium text-ink-300 mb-1.5">
          Conta do artista (selo) <span className="text-ink-500 font-normal text-xs">· opcional</span>
        </label>
        <input
          id={`${idPrefixo}-conta-selo`}
          type="email"
          value={valor.contaArtistaSelo}
          onChange={(e) => set('contaArtistaSelo', e.target.value)}
          placeholder="artista@gmail.com"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefixo}-email-projeto`} className="block text-sm font-medium text-ink-300 mb-1.5">
          E-mail do projeto <span className="text-ink-500 font-normal text-xs">· opcional</span>
        </label>
        <input
          id={`${idPrefixo}-email-projeto`}
          type="email"
          value={valor.emailProjeto}
          onChange={(e) => set('emailProjeto', e.target.value)}
          placeholder="projeto@exemplo.com"
          className={INPUT}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink-300 mb-1.5">
          Serviços previstos <span className="text-ink-500 font-normal text-xs">· opcional</span>
        </legend>
        <div className="space-y-1.5">
          {SERVICOS_PREVISTOS.map((s) => (
            <Checkbox
              key={s}
              rotulo={s}
              marcado={valor.servicosPrevistos.includes(s)}
              onChange={() =>
                set(
                  'servicosPrevistos',
                  valor.servicosPrevistos.includes(s)
                    ? valor.servicosPrevistos.filter((x) => x !== s)
                    : [...valor.servicosPrevistos, s]
                )
              }
            />
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefixo}-anotacoes`} className="block text-sm font-medium text-ink-300 mb-1.5">
          Anotações gerais <span className="text-ink-500 font-normal text-xs">· opcional</span>
        </label>
        <textarea
          id={`${idPrefixo}-anotacoes`}
          value={valor.anotacoesGerais}
          onChange={(e) => set('anotacoesGerais', e.target.value)}
          placeholder="Informações adicionais sobre o projeto…"
          rows={3}
          className={TEXTAREA}
        />
      </div>
    </div>
  )
}

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

'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { PlataformaIcon, type PlataformaTipo } from '@/components/artistas/plataforma-icon'
import { idadeEm, isoLocal, lerDataNascimento, NASCIMENTO_MIN } from '@/lib/artistas/aniversario'
import { catalogoServicosOuPadrao } from '@/lib/artistas/config'
import {
  normalizarServicosPrevistos,
  SERVICOS_PADRAO,
  separarServicos,
  servicoChave,
  type ServicoPrevisto,
} from '@/lib/artistas/servicos'
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

/**
 * Lado COMERCIAL do cadastro: a relação do selo com o artista, não a presença
 * dele nas plataformas.
 *
 * `servicosPrevistos` guarda os NOMES dos serviços, que é o que está gravado em
 * `projetos/{slug}`. Desde 11/2026 não existe mais uma lista "adicional" por
 * artista: quem marca é o catálogo de **Configurações › Artistas** (ver
 * `@/lib/artistas/config`). O que sobrou de serviço fora do catálogo em
 * cadastros antigos continua aqui dentro, e o formulário mostra como tal.
 */
export interface DadosProjeto {
  contaArtistaSelo: string
  emailProjeto: string
  servicosPrevistos: string[]
  anotacoesGerais: string
}

export function dadosProjetoParaEnvio(projeto: DadosProjeto): DadosProjeto {
  return { ...projeto, servicosPrevistos: normalizarServicosPrevistos(projeto.servicosPrevistos) }
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
    servicosPrevistos: normalizarServicosPrevistos(x?.servicosPrevistos),
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
          'peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-950',
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
  const { role } = useAuth()
  const set = <K extends keyof DadosProjeto>(k: K, v: DadosProjeto[K]) => onChange({ ...valor, [k]: v })

  // O catálogo de serviços do painel. `null` enquanto carrega: cair no padrão de
  // fábrica nesse intervalo faria os rótulos piscarem e, pior, mostraria como
  // "fora do catálogo" um serviço que está dentro.
  const [catalogo, setCatalogo] = useState<ServicoPrevisto[] | null>(null)
  useEffect(() => {
    let vivo = true
    // Nunca rejeita: na falha vem o catálogo de fábrica, que é melhor do que um
    // cadastro sem serviço nenhum pra marcar.
    catalogoServicosOuPadrao()
      .then((c) => vivo && setCatalogo(c))
      .catch(() => vivo && setCatalogo(SERVICOS_PADRAO))
    return () => {
      vivo = false
    }
  }, [])

  const { chaves, foraDoCatalogo } = useMemo(
    () => separarServicos(valor.servicosPrevistos, catalogo ?? []),
    [valor.servicosPrevistos, catalogo],
  )
  const marcadas = useMemo(() => new Set(chaves), [chaves])

  /**
   * Marca/desmarca um serviço. O que se grava é a CHAVE dele.
   *
   * Gravar o nome parecia mais legível e estava errado: a chave do catálogo não
   * é recalculada no rename, então depois de um "Selo digital" virar "Selo
   * Digital Plus" o nome gravado deixava de casar com a entrada, a caixinha
   * voltava desmarcada e o serviço caía em "fora do catálogo". Gravando a
   * chave, o casamento é exato para sempre, e o cadastro antigo (que tem o
   * nome) continua casando porque `servicoChave` leva os dois à mesma chave.
   */
  function alternarServico(servico: ServicoPrevisto) {
    const sem = valor.servicosPrevistos.filter((v) => servicoChave(v) !== servico.chave)
    set('servicosPrevistos', marcadas.has(servico.chave) ? sem : [...sem, servico.chave])
  }

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

        {catalogo === null ? (
          <p className="text-sm text-ink-500">Carregando os serviços…</p>
        ) : catalogo.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nenhum serviço cadastrado ainda. A lista é montada em Configurações › Artistas.
          </p>
        ) : (
          <div className="space-y-1.5">
            {catalogo.map((s) => (
              <Checkbox
                key={s.chave}
                rotulo={s.nome}
                marcado={marcadas.has(s.chave)}
                onChange={() => alternarServico(s)}
              />
            ))}
          </div>
        )}

        {/*
          Serviço que este artista tem e que não está (mais) no catálogo —
          cadastro feito antes de 11/2026, quando cada ficha podia inventar o
          seu, ou serviço retirado da lista depois. Fica marcado e some no X;
          apagá-lo sozinho seria jogar fora o que alguém digitou.

          O `catalogo !== null` não é detalhe: sem ele, no intervalo entre abrir
          o formulário e o catálogo chegar, TODO serviço do artista aparecia
          aqui como "cadastrado só neste artista", cada um com um X que remove
          de verdade.
        */}
        {catalogo !== null && foraDoCatalogo.length > 0 && (
          <div className="mt-3 rounded-lg border border-bg-700/50 bg-bg-950/60 p-3">
            <p className="text-[11px] font-semibold text-ink-400">
              Fora do catálogo
              <span className="font-normal text-ink-500">
                {' '}
                · cadastrado só neste artista
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {foraDoCatalogo.map((nome) => (
                <span
                  key={nome}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 py-1 pl-2.5 pr-1 text-[12px] text-amber-200"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{nome}</span>
                  <button
                    type="button"
                    aria-label={`Remover o serviço ${nome} deste artista`}
                    onClick={() =>
                      set(
                        'servicosPrevistos',
                        valor.servicosPrevistos.filter((s) => servicoChave(s) !== servicoChave(nome)),
                      )
                    }
                    className="grid size-5 shrink-0 place-items-center rounded-full text-amber-300/80 hover:bg-amber-500/20 hover:text-amber-100 focus-visible:outline focus-visible:outline-violet-500"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2 text-[11px] text-ink-500">
          A lista vale para todos os artistas e só o admin a edita
          {role === 'admin' ? (
            <>
              {' '}
              em{' '}
              <Link
                href="/configuracoes?aba=artistas"
                className="text-violet-300 hover:text-violet-200 underline underline-offset-2"
              >
                Configurações › Artistas
              </Link>
              .
            </>
          ) : (
            <> em Configurações › Artistas.</>
          )}
        </p>
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

/**
 * Data de nascimento do artista, que alimenta o alerta de aniversário. Mesmo
 * campo em criar e editar; `idPrefixo` evita colisão de id, como em `CamposProjeto`.
 *
 * O `max` é HOJE, e não o limite da regra (um ano atrás), de propósito: o seletor do
 * celular abre no `max`, e um "Definir" sem mexer precisa cair numa data que a
 * regra recusa — se abrisse no limite, gravaria o artista com 1 ano. Quem valida é
 * `lerDataNascimento`, no envio e no servidor. A idade aparece na dica assim que a
 * data é válida: é o que denuncia o ano esquecido antes de salvar.
 */
export function CampoDataNascimento({
  valor,
  onChange,
  idPrefixo,
  nota,
  questionarioPreenche = true,
}: {
  /** 'YYYY-MM-DD' ou '' — o formato que o <input type="date"> devolve e o que se grava. */
  valor: string
  onChange: (v: string) => void
  idPrefixo: string
  /** Linha sobre o valor ATUAL (ex.: de onde ele veio). Entra também no aria-describedby. */
  nota?: string | null
  /**
   * Se o questionário do artista ainda pode preencher este campo. Falso quando a
   * equipe já digitou ou apagou a data — o questionário não mexe mais nela, e a
   * dica não pode prometer o contrário.
   */
  questionarioPreenche?: boolean
}) {
  const id = `${idPrefixo}-nascimento`
  const idDica = `${id}-dica`
  const idNota = `${id}-nota`
  const n = lerDataNascimento(valor)
  const idade = n ? idadeEm(n) : null

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-300 mb-1.5">
        Data de nascimento <span className="text-ink-500 font-normal text-xs">· opcional</span>
      </label>
      <input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        min={NASCIMENTO_MIN}
        max={isoLocal(new Date())}
        aria-describedby={nota ? `${idNota} ${idDica}` : idDica}
        className={cn(INPUT, '[color-scheme:dark]')}
      />
      {nota && (
        <p id={idNota} className="text-[11px] text-violet-300/90 mt-1">
          {nota}
        </p>
      )}
      <p id={idDica} className="text-[11px] text-ink-500 mt-1">
        {idade !== null && (
          <span className="text-ink-300">
            {idade} {idade === 1 ? 'ano' : 'anos'}.{' '}
          </span>
        )}
        Usada no alerta de aniversário.{questionarioPreenche && ' Se ficar vazia, o questionário do artista pode preencher.'}
      </p>
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

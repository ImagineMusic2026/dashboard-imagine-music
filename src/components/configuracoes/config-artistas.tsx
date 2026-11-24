'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { invalidarProjetosServicos, listarProjetosServicos } from '@/lib/artistas/client'
import { carregarCatalogoServicos, salvarCatalogoServicos } from '@/lib/artistas/config'
import {
  normalizarCatalogoServicos,
  servicoChave,
  type ServicoPrevisto,
} from '@/lib/artistas/servicos'
import { cn } from '@/lib/utils'

const campo =
  'flex-1 min-w-0 bg-bg-950 border border-bg-700/50 rounded-lg px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

/**
 * O catálogo de **serviços previstos** — a lista que o cadastro de TODO artista
 * oferece para marcar.
 *
 * Pedido da cliente em 11/2026: até então um serviço novo era digitado dentro
 * da ficha de um artista e só existia lá, então o serviço criado para o Fulano
 * não aparecia para marcar no Beltrano. Agora a lista é do painel e mora em
 * `configuracoes/artistas` (ver `@/lib/artistas/config`).
 *
 * Só o ADMIN edita — era a outra metade do pedido. Marketing continua cuidando
 * do cadastro do artista e marcando os serviços dele; o que mudou é que a LISTA
 * deixou de ser escrita no meio do cadastro de uma pessoa só.
 *
 * Duas regras herdadas da configuração do quadro, e pelos mesmos motivos:
 *
 * - **Renomear é seguro a qualquer momento.** A chave gravada no artista não
 *   muda, só o rótulo na tela — todo artista que já tinha o serviço continua
 *   com ele, com o nome novo, sem migração nenhuma.
 * - **Serviço em uso não é removido.** A tela mostra quantos artistas dependem
 *   dele e bloqueia; remover deixaria o serviço marcado em gente que ninguém
 *   mais consegue ver na lista.
 */
export function ConfigArtistasServicos() {
  const { role } = useAuth()
  // O corte de papel vem ANTES do componente que lê — mesmo motivo do quadro e
  // dos contratos: quem não é admin não deve pagar a leitura pra receber um aviso.
  if (role !== 'admin') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6">
        <h2 className="text-lg font-bold text-ink-100 mb-1">Serviços previstos</h2>
        <p className="text-sm text-ink-400">
          A lista de serviços que o cadastro de artista oferece vale para todo o painel, e só o
          admin a edita. Marcar os serviços de um artista continua em{' '}
          <span className="text-ink-200">Perfil do artista › Editar</span>.
        </p>
      </div>
    )
  }
  return <ServicosAdmin />
}

/**
 * Uma linha da tela. O `id` é só do React: ele nasce com a linha e não muda no
 * rename, que é o que mantém o foco no lugar ao reordenar e ao remover — com
 * `key` por índice, o foco ficava na POSIÇÃO e passava a comandar o vizinho.
 */
interface Linha {
  id: string
  chave: string
  nome: string
}

let sequencia = 0

function linhaNova(nome = ''): Linha {
  sequencia += 1
  return { id: `nova-${sequencia}`, chave: '', nome }
}

function linhaDe(s: ServicoPrevisto): Linha {
  return { id: `cat-${s.chave}`, chave: s.chave, nome: s.nome }
}

/** A chave que vale agora: a gravada ou, numa linha recém-criada, a do nome. */
function chaveDe(l: Linha): string {
  return l.chave || servicoChave(l.nome)
}

type EstadoUso =
  | { situacao: 'carregando' }
  | { situacao: 'falhou' }
  | { situacao: 'pronto'; por: Map<string, { total: number; nome: string }> }

function ServicosAdmin() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  /**
   * Quantos artistas têm cada serviço, por chave, com o nome como foi gravado.
   *
   * "Ainda carregando" e "não consegui ler" são estados DIFERENTES: os dois
   * bloqueiam a remoção (o lado seguro), mas só um deles é motivo para avisar a
   * pessoa. Quando eram o mesmo `null`, a dica dizia "não consegui conferir"
   * durante o carregamento normal.
   */
  const [uso, setUso] = useState<EstadoUso>({ situacao: 'carregando' })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  /** O que o leitor de tela ouve depois de mover, remover ou adicionar. */
  const [recado, setRecado] = useState('')

  // Foco depois de mexer na lista: guardo o alvo e devolvo o foco no commit
  // seguinte. Sem isto, mover/remover/adicionar jogava o foco no `body`.
  const refs = useRef(new Map<string, HTMLElement | null>())
  const [foco, setFoco] = useState<string | null>(null)
  useEffect(() => {
    if (!foco) return
    refs.current.get(foco)?.focus()
    setFoco(null)
  }, [foco])

  const registrar = (ref: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(ref, el)
    else refs.current.delete(ref)
  }

  async function lerUso() {
    try {
      const porSlug = await listarProjetosServicos()
      const contagem = new Map<string, { total: number; nome: string }>()
      Object.values(porSlug).forEach((lista) => {
        const vistas = new Set<string>()
        for (const valor of lista) {
          const chave = servicoChave(valor)
          if (!chave || vistas.has(chave)) continue
          vistas.add(chave)
          const atual = contagem.get(chave)
          contagem.set(chave, { total: (atual?.total ?? 0) + 1, nome: atual?.nome ?? valor })
        }
      })
      return contagem
    } catch {
      return null
    }
  }

  useEffect(() => {
    let vivo = true
    // Esta leitura REJEITA quando falha, de propósito: a tela que grava o array
    // inteiro não pode mostrar o padrão de fábrica como se fosse o catálogo real
    // — salvar em cima apagaria os serviços customizados em silêncio.
    carregarCatalogoServicos()
      .then((c) => vivo && setLinhas(c.map(linhaDe)))
      .catch(
        () =>
          vivo &&
          setErroCarregar(
            'Não consegui carregar os serviços. Recarregue a página antes de editar — salvar agora apagaria a lista.',
          ),
      )
    // Uma varredura de `projetos`, a mesma que a lista de artistas já faz e
    // cacheia — é o que permite dizer "3 artistas têm este serviço" em vez de
    // deixar apagar e descobrir depois.
    lerUso().then((c) => {
      if (!vivo) return
      setUso(c ? { situacao: 'pronto', por: c } : { situacao: 'falhou' })
    })
    return () => {
      vivo = false
    }
  }, [])

  function alterar(proximas: Linha[]) {
    setLinhas(proximas)
    setSalvo(false)
  }

  function renomear(id: string, nome: string) {
    if (!linhas) return
    alterar(linhas.map((l) => (l.id === id ? { ...l, nome } : l)))
  }

  function mover(indice: number, passo: number) {
    if (!linhas) return
    const destino = indice + passo
    if (destino < 0 || destino >= linhas.length) return
    const proximas = [...linhas]
    const [item] = proximas.splice(indice, 1)
    proximas.splice(destino, 0, item)
    alterar(proximas)
    setRecado(
      `${item.nome.trim() || 'Serviço sem nome'} movido para a posição ${destino + 1} de ${proximas.length}.`,
    )
    // Nas pontas o botão da direção vira `disabled` e não aceita foco: devolvo
    // para o botão oposto, que é o único que ainda faz sentido ali.
    const direcao = destino === 0 ? 'descer' : destino === proximas.length - 1 ? 'subir' : passo < 0 ? 'subir' : 'descer'
    setFoco(`${item.id}:${direcao}`)
  }

  function remover(indice: number) {
    if (!linhas) return
    const saindo = linhas[indice]
    const proximas = linhas.filter((_, i) => i !== indice)
    alterar(proximas)
    setRecado(`${saindo.nome.trim() || 'Serviço sem nome'} removido da lista.`)
    const vizinha = proximas[indice] ?? proximas[indice - 1]
    setFoco(vizinha ? `${vizinha.id}:input` : 'adicionar')
  }

  function adicionar(nome = '') {
    if (!linhas) return
    // Chave vazia: ela nasce do nome na hora de salvar, e enquanto a linha é
    // nova ela acompanha o que a pessoa está digitando.
    const nova = linhaNova(nome)
    alterar([...linhas, nova])
    setRecado(
      nome
        ? `${nome} adicionado à lista, na posição ${linhas.length + 1}.`
        : `Serviço adicionado na posição ${linhas.length + 1}. Dê um nome a ele.`,
    )
    setFoco(`${nova.id}:input`)
  }

  /**
   * Serviço que ALGUM artista tem e que não está no catálogo: as fichas
   * cadastradas antes de 11/2026, quando cada uma inventava a sua. Aparecem aqui
   * com um botão de adotar — é o caminho de "esse serviço eu criei num artista e
   * agora quero em todos" sem digitar o nome de novo e sem errar o acento.
   */
  const foraDoCatalogo = useMemo(() => {
    if (uso.situacao !== 'pronto' || !linhas) return []
    const noCatalogo = new Set(linhas.map(chaveDe))
    const fora: { chave: string; nome: string }[] = []
    uso.por.forEach(({ nome }, chave) => {
      if (!noCatalogo.has(chave)) fora.push({ chave, nome })
    })
    return fora.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [uso, linhas])

  /**
   * O que impede de salvar.
   *
   * Confere a chave E o nome. Só a chave não bastava: ela não é recalculada no
   * rename, então renomear uma linha para o nome de outra passava na validação
   * e criava duas caixinhas com o mesmo texto no cadastro do artista — marcar
   * uma acendia a outra.
   */
  const problema = useMemo(() => {
    if (!linhas) return null
    if (linhas.some((l) => !l.nome.trim())) return 'Dê um nome a todos os serviços.'
    const chaves = new Set<string>()
    const nomes = new Set<string>()
    for (const l of linhas) {
      const chave = chaveDe(l)
      const nome = servicoChave(l.nome)
      if (chaves.has(chave) || nomes.has(nome) || chaves.has(nome) || nomes.has(chave)) {
        return `"${l.nome.trim()}" está repetido na lista.`
      }
      chaves.add(chave)
      nomes.add(nome)
    }
    return null
  }, [linhas])

  async function salvar() {
    if (!linhas || problema || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      // Removeu alguém? A contagem em tela pode ter até 5 minutos (é o cache que
      // a lista de artistas povoa). Antes de gravar uma remoção, releio de
      // verdade — o bloqueio existe justamente para este caso.
      const removidas = (await carregarCatalogoServicos())
        .map((s) => s.chave)
        .filter((chave) => !linhas.some((l) => chaveDe(l) === chave))
      if (removidas.length) {
        invalidarProjetosServicos()
        const fresco = await lerUso()
        if (!fresco) {
          setErro('Não consegui conferir quais artistas usam os serviços removidos. Tente de novo.')
          return
        }
        setUso({ situacao: 'pronto', por: fresco })
        const emUso = removidas.filter((chave) => (fresco.get(chave)?.total ?? 0) > 0)
        if (emUso.length) {
          setErro(
            `Alguém marcou esses serviços enquanto esta tela estava aberta. A lista foi atualizada; desmarque nos artistas antes de remover.`,
          )
          return
        }
      }

      const catalogo = normalizarCatalogoServicos(
        linhas.map((l) => ({ chave: chaveDe(l), nome: l.nome.trim() })),
      )
      await salvarCatalogoServicos(catalogo)
      // Sem reler: `salvarCatalogoServicos` grava exatamente este valor, já
      // normalizado pela mesma função dos dois lados.
      setLinhas(catalogo.map(linhaDe))
      setSalvo(true)
    } catch (e) {
      // Distinguir a recusa da regra de uma falha qualquer: culpar as regras em
      // toda falha já mandou gente pedir permissão que ela tinha.
      const codigo = (e as { code?: string })?.code
      setErro(
        codigo === 'permission-denied'
          ? 'As regras recusaram a escrita. Só o admin salva os serviços.'
          : 'Não consegui salvar os serviços. Tente de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  if (erroCarregar) {
    return (
      <div className="bg-bg-900 border border-red-500/30 rounded-xl p-6" role="alert">
        <h3 className="text-sm font-bold text-ink-100">Serviços previstos</h3>
        <p className="text-sm text-red-300 mt-1">{erroCarregar}</p>
      </div>
    )
  }

  if (!linhas) {
    return (
      <div
        className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex items-center gap-2 text-sm text-ink-400"
        role="status"
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Carregando os serviços…
      </div>
    )
  }

  return (
    <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
      <h3 className="text-sm font-bold text-ink-100">Serviços previstos</h3>
      <p className="text-[12px] text-ink-400 mt-0.5">
        A lista que o cadastro de artista oferece para marcar, em{' '}
        <span className="text-ink-300">Novo artista</span> e{' '}
        <span className="text-ink-300">Perfil do artista › Editar</span>. Vale para todos os
        artistas e só o admin a edita. Renomear é seguro: quem já tinha o serviço continua com ele,
        com o nome novo. A ordem daqui é a ordem dos marcadores na coluna Serviços da lista.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {recado}
      </p>

      <ul className="mt-4 space-y-2">
        {linhas.map((l, i) => {
          const chave = chaveDe(l)
          const emUso = uso.situacao === 'pronto' ? (uso.por.get(chave)?.total ?? 0) : 0
          const bloqueado = uso.situacao !== 'pronto' || emUso > 0
          const idMotivo = `servico-${l.id}-motivo`
          const vazio = !l.nome.trim()
          return (
            <li key={l.id} className="flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button
                  ref={registrar(`${l.id}:subir`)}
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label={`Subir ${l.nome.trim() || 'serviço sem nome'}`}
                  className="grid size-6 place-items-center rounded text-ink-500 hover:text-ink-100 hover:bg-bg-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronUp aria-hidden className="size-3.5" />
                </button>
                <button
                  ref={registrar(`${l.id}:descer`)}
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === linhas.length - 1}
                  aria-label={`Descer ${l.nome.trim() || 'serviço sem nome'}`}
                  className="grid size-6 place-items-center rounded text-ink-500 hover:text-ink-100 hover:bg-bg-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronDown aria-hidden className="size-3.5" />
                </button>
              </div>

              <input
                ref={registrar(`${l.id}:input`)}
                type="text"
                value={l.nome}
                onChange={(e) => renomear(l.id, e.target.value)}
                aria-label={`Nome do serviço ${i + 1}`}
                aria-invalid={vazio || undefined}
                placeholder="Nome do serviço"
                className={cn(campo, vazio && 'border-red-500/60')}
              />

              {/*
                O motivo do bloqueio precisa estar no DOM, e não só no `title`:
                botão `disabled` não recebe foco e leitor de tela nenhum lê o
                `title` dele. Por isso o botão usa `aria-disabled` (continua
                focável, com o motivo em `aria-describedby`) e o clique é barrado
                no handler.
              */}
              <span id={idMotivo} className="num shrink-0 w-28 text-right text-[11px] text-ink-400">
                {uso.situacao === 'carregando'
                  ? 'conferindo…'
                  : uso.situacao === 'falhou'
                    ? 'uso desconhecido'
                    : emUso
                      ? `${emUso} artista${emUso === 1 ? '' : 's'}`
                      : 'ninguém'}
              </span>

              <button
                type="button"
                onClick={() => !bloqueado && remover(i)}
                aria-disabled={bloqueado}
                aria-describedby={idMotivo}
                aria-label={`Remover ${l.nome.trim() || 'serviço sem nome'}`}
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
                  bloqueado
                    ? 'text-ink-600 cursor-not-allowed'
                    : 'text-ink-400 hover:bg-red-500/10 hover:text-red-300',
                )}
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>

      {!linhas.length && (
        <p className="text-sm text-ink-500 py-4 text-center">
          Nenhum serviço na lista. Sem serviço, a seção some do cadastro do artista.
        </p>
      )}

      <button
        ref={registrar('adicionar')}
        type="button"
        onClick={() => adicionar()}
        className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
        Adicionar serviço
      </button>

      {uso.situacao === 'falhou' && (
        <p className="mt-3 text-[12px] text-amber-300" role="alert">
          Não consegui conferir quantos artistas usam cada serviço. Dá para renomear e reordenar;
          remover fica bloqueado até a conferência voltar.
        </p>
      )}

      {foraDoCatalogo.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-200">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            Marcados em algum artista, fora da lista
          </p>
          <p className="mt-1 text-[11px] text-ink-400">
            Vieram de cadastros feitos antes de a lista existir. Trazer para cá faz o serviço
            aparecer para marcar em todos os artistas, sem desmarcar ninguém.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {foraDoCatalogo.map(({ chave, nome }) => (
              <button
                key={chave}
                type="button"
                onClick={() => adicionar(nome)}
                aria-label={`Trazer ${nome} para a lista`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-100 hover:bg-amber-500/20 transition-colors"
              >
                <Plus aria-hidden className="size-3" />
                {nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !!problema}
          aria-busy={salvando}
          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
        >
          {salvando ? 'Salvando…' : 'Salvar serviços'}
        </button>
        <span className="text-[12px] text-emerald-400" role="status" aria-live="polite">
          {salvo ? 'Salvo.' : ''}
        </span>
        {problema && (
          <span className="text-[12px] text-amber-300" role="alert">
            {problema}
          </span>
        )}
        {erro && (
          <span className="text-[12px] text-red-400" role="alert">
            {erro}
          </span>
        )}
      </div>
    </section>
  )
}

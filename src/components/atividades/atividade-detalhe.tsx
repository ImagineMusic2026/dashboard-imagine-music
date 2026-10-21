'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  Check,
  ExternalLink,
  GitBranch,
  Link2,
  ListTree,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  History as HistoryIcon,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import {
  criarAtividade,
  filhosDe,
  idLocal,
  ordemNoFim,
  salvarChecklist,
  salvarDependencias,
  salvarLinks,
  urlSegura,
  type Atividade,
  type ItemChecklist,
  type LinkDemanda,
} from '@/lib/atividades/client'
import {
  comentar,
  excluirComentario,
  listarComentarios,
  type Comentario,
} from '@/lib/atividades/comentarios'
import { conflitosDe, dataLonga, duracaoEmDias, situacaoDaBarra } from '@/lib/atividades/cronograma'
import {
  areaDe,
  campoLigado,
  cor,
  esforcoMeta,
  etapaDe,
  prioridadeMeta,
  tipoDe,
} from '@/lib/atividades/tipos'
import { ehStaff } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

/**
 * O painel de detalhe da demanda.
 *
 * É onde a demanda deixa de ser um card e vira o lugar da conversa: checklist,
 * subtarefas, dependências, links, comentários e histórico. Abre por cima do
 * quadro, à direita, e não substitui a tela — quem abre uma demanda quase sempre
 * quer voltar pro quadro logo em seguida.
 *
 * Os comentários são a ÚNICA coisa aqui que custa leitura, e por isso só são
 * buscados quando o painel abre (ver `comentarios.ts`). Tudo o mais já veio
 * junto com o quadro.
 *
 * As edições rápidas (marcar um item, colar um link, ligar uma dependência)
 * gravam na hora, sem botão de salvar: são operações de um clique, e um
 * formulário em volta delas só atrapalharia. Mudar título, datas e
 * classificação continua no formulário, atrás do botão "Editar".
 */
export function AtividadeDetalhe({
  atividade,
  onFechar,
  onEditar,
  bloqueado,
}: {
  atividade: Atividade
  onFechar: () => void
  onEditar: () => void
  /** Há um diálogo por cima — o Esc pertence a ele, não a este painel. */
  bloqueado: boolean
}) {
  const { appUser } = useAuth()
  // Só a equipe abre o perfil do artista; para o colaborador o nome é texto.
  const equipe = ehStaff(appUser?.role ?? null)
  const {
    config,
    todas,
    visiveis,
    mover,
    remover,
    progresso,
    atrasada,
    concluida,
    alternarItem,
    aplicarLocal,
    recarregar,
    setErro,
  } = useQuadro()

  // A demanda vem do estado do quadro: assim marcar um item aqui reflete no
  // card por trás sem uma segunda fonte de verdade.
  const a = todas.find((x) => x.id === atividade.id) ?? atividade

  const [comentarios, setComentarios] = useState<Comentario[] | null>(null)
  const [novoComentario, setNovoComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [novoItem, setNovoItem] = useState('')
  const [novaSub, setNovaSub] = useState('')
  const [novoLink, setNovoLink] = useState({ titulo: '', url: '' })
  // Aviso do campo de link fica junto dele: o erro do quadro aparece atrás
  // deste painel, e a pessoa clicaria em adicionar sem ver por que nada houve.
  const [erroLink, setErroLink] = useState<string | null>(null)
  const [salvandoAlgo, setSalvandoAlgo] = useState(false)
  const painel = useRef<HTMLElement>(null)

  const etapa = etapaDe(config, a.etapa)
  const tipo = tipoDe(config, a.tipo)
  const area = areaDe(config, a.area)
  const filhos = filhosDe(todas, a.id)
  const feito = progresso(a)
  const situacao = situacaoDaBarra(a, todas, config)
  // Para o colaborador `todas` são só as demandas dele: antecessora que não
  // está ali é da equipe, não excluída.
  const problemas = useMemo(
    () => conflitosDe(todas, config, todas, { universoParcial: !equipe }).get(a.id) ?? [],
    [todas, config, a.id, equipe],
  )
  const mae = a.paiId ? todas.find((x) => x.id === a.paiId) : null

  // Booleano, não o objeto `config`: a configuração é recriada a cada leitura do
  // contexto, então depender dela relia a subcoleção de comentários a cada
  // atualização do quadro — uma leitura por comentário, toda vez.
  const comentariosLigados = campoLigado(config, 'comentarios')

  useEffect(() => {
    let vivo = true
    setComentarios(null)
    if (!comentariosLigados) {
      setComentarios([])
      return
    }
    listarComentarios(a.id)
      .then((c) => vivo && setComentarios(c))
      .catch(() => vivo && setComentarios([]))
    return () => {
      vivo = false
    }
  }, [a.id, comentariosLigados])

  // Esc fecha — é um painel sobreposto, e a pessoa espera sair dele sem mirar
  // no X com o mouse. Mas SÓ quando ele é a camada de cima: com o formulário de
  // edição aberto por cima, o Esc fechava o painel de trás e deixava o
  // formulário órfão na tela.
  useEffect(() => {
    if (bloqueado) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar, bloqueado])

  /**
   * Foco: leva para dentro do painel ao abrir e devolve ao elemento de origem ao
   * fechar. Sem isso o `aria-modal` mente — o leitor de tela anuncia um diálogo
   * enquanto o foco continua no card lá atrás, e o Tab passeia pela página
   * inteira por baixo do painel.
   */
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null
    painel.current?.focus()
    return () => origem?.focus?.()
  }, [])

  function aoTabular(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !painel.current) return
    const focaveis = painel.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focaveis.length) return
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  async function comGuarda(acao: () => Promise<void>, mensagemDeErro: string) {
    setSalvandoAlgo(true)
    try {
      await acao()
      setErro(null)
    } catch {
      setErro(mensagemDeErro)
      await recarregar()
    } finally {
      setSalvandoAlgo(false)
    }
  }

  async function adicionarItem(e: FormEvent) {
    e.preventDefault()
    const texto = novoItem.trim()
    if (!texto) return
    const lista: ItemChecklist[] = [...(a.checklist ?? []), { id: idLocal(), texto, feito: false }]
    setNovoItem('')
    // O documento resultante é conhecido: aplica no estado local e grava. Antes
    // isto chamava `recarregar()`, uma varredura da coleção inteira — por item
    // de checklist digitado.
    aplicarLocal({ ...a, checklist: lista })
    await comGuarda(() => salvarChecklist(a.id, lista), 'Não consegui salvar o checklist.')
  }

  async function removerItem(itemId: string) {
    const lista = (a.checklist ?? []).filter((i) => i.id !== itemId)
    aplicarLocal({ ...a, checklist: lista })
    await comGuarda(() => salvarChecklist(a.id, lista), 'Não consegui salvar o checklist.')
  }

  async function adicionarSubtarefa(e: FormEvent) {
    e.preventDefault()
    const titulo = novaSub.trim()
    if (!titulo || !appUser) return
    setNovaSub('')
    await comGuarda(async () => {
      const dados = {
          titulo,
          etapa: config.etapas[0]?.key ?? a.etapa,
          prioridade: a.prioridade,
          // A subtarefa herda o contexto da mãe — artista, área e responsável
          // quase sempre são os mesmos, e repetir isso à mão é o tipo de atrito
          // que faz a equipe parar de usar subtarefa.
          tipo: a.tipo ?? null,
          area: a.area ?? null,
          artistaSlug: a.artistaSlug ?? null,
          artistaNome: a.artistaNome ?? null,
          responsavelUid: a.responsavelUid ?? null,
          responsavelNome: a.responsavelNome ?? null,
          paiId: a.id,
          inicio: a.inicio ?? null,
          prazo: a.prazo ?? null,
      }
      const id = await criarAtividade(dados, appUser.uid, todas, config)
      // Espelha o que `criarAtividade` gravou, em vez de reler a coleção. Os
      // campos derivados abaixo são os mesmos que ela carimba no documento novo.
      aplicarLocal({
        id,
        ...dados,
        etiquetas: [],
        marco: false,
        progresso: null,
        dependeDe: [],
        checklist: [],
        links: [],
        ordem: ordemNoFim(todas, dados.etapa),
        etapaDesde: new Date().toISOString(),
        temposPorEtapa: {},
        qtdComentarios: 0,
        historico: [],
        concluidoEm: null,
        criadoPor: appUser.uid,
      })
    }, 'Não consegui criar a subtarefa.')
  }

  async function adicionarLink(e: FormEvent) {
    e.preventDefault()
    if (!novoLink.url.trim()) return
    const url = urlSegura(novoLink.url)
    if (!url) {
      setErroLink('Use um endereço da web, um e-mail (mailto:) ou um telefone (tel:).')
      return
    }
    setErroLink(null)
    const links: LinkDemanda[] = [
      ...(a.links ?? []),
      { id: idLocal(), titulo: novoLink.titulo.trim() || url, url },
    ]
    setNovoLink({ titulo: '', url: '' })
    aplicarLocal({ ...a, links })
    await comGuarda(() => salvarLinks(a.id, links), 'Não consegui salvar o link.')
  }

  async function removerLink(linkId: string) {
    const links = (a.links ?? []).filter((x) => x.id !== linkId)
    aplicarLocal({ ...a, links })
    await comGuarda(() => salvarLinks(a.id, links), 'Não consegui remover o link.')
  }

  async function alternarDependencia(outroId: string) {
    const atuais = a.dependeDe ?? []
    const proximas = atuais.includes(outroId)
      ? atuais.filter((d) => d !== outroId)
      : [...atuais, outroId]
    aplicarLocal({ ...a, dependeDe: proximas })
    await comGuarda(() => salvarDependencias(a.id, proximas), 'Não consegui salvar a dependência.')
  }

  async function enviarComentario(e: FormEvent) {
    e.preventDefault()
    const texto = novoComentario.trim()
    if (!texto || !appUser) return
    setEnviando(true)
    try {
      const novo = await comentar(a.id, texto, {
        uid: appUser.uid,
        nome: appUser.nome || appUser.email,
      })
      setComentarios((c) => [...(c ?? []), novo])
      // O selo do card lê `qtdComentarios` do documento; o contador é
      // denormalizado, então acompanhá-lo aqui evita reler o quadro só pra ver
      // um número subir.
      aplicarLocal({ ...a, qtdComentarios: (a.qtdComentarios ?? 0) + 1 })
      setNovoComentario('')
      setErro(null)
    } catch {
      setErro('Não consegui publicar o comentário.')
    } finally {
      setEnviando(false)
    }
  }

  async function apagarComentario(id: string) {
    try {
      await excluirComentario(a.id, id)
      setComentarios((c) => (c ?? []).filter((x) => x.id !== id))
      aplicarLocal({ ...a, qtdComentarios: Math.max(0, (a.qtdComentarios ?? 1) - 1) })
    } catch {
      setErro('Não consegui excluir o comentário.')
    }
  }

  const itens = a.checklist ?? []
  const candidatasDependencia = visiveis.filter((x) => x.id !== a.id && x.paiId !== a.id)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onFechar} aria-hidden />

      <aside
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={a.titulo}
        tabIndex={-1}
        onKeyDown={aoTabular}
        className="relative w-full max-w-lg bg-bg-900 border-l border-bg-700/50 shadow-2xl overflow-y-auto animate-fade-in focus:outline-none"
      >
        <header className="sticky top-0 z-10 bg-bg-900 border-b border-bg-700/40 px-5 py-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {mae && (
                <p className="text-[11px] text-ink-500 mb-1 truncate">
                  Subtarefa de <span className="text-ink-300">{mae.titulo}</span>
                </p>
              )}
              {!mae && a.paiId && !equipe && (
                <p className="text-[11px] text-ink-500 mb-1 truncate">Subtarefa de um projeto da equipe</p>
              )}
              <h2 className="text-lg font-bold text-ink-100 leading-snug">{a.titulo}</h2>
            </div>
            <button
              type="button"
              onClick={onEditar}
              aria-label="Editar demanda"
              className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 hover:text-ink-100 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                remover(a)
                onFechar()
              }}
              aria-label="Excluir demanda"
              className="p-1.5 rounded-md hover:bg-red-500/10 text-ink-400 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              value={a.etapa}
              onChange={(e) => mover(a.id, e.target.value, null)}
              aria-label="Etapa"
              className={cn(
                'bg-bg-950 border border-bg-700/50 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20',
                cor(etapa?.cor).text,
              )}
            >
              {config.etapas.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
              {!etapa && <option value={a.etapa}>{a.etapa}</option>}
            </select>

            {a.prioridade !== 'baixa' && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-1 rounded border',
                  prioridadeMeta[a.prioridade].chip,
                )}
              >
                {prioridadeMeta[a.prioridade].label}
              </span>
            )}
            {tipo && (
              <span className={cn('text-[10px] font-semibold px-2 py-1 rounded border', cor(tipo.cor).chip)}>
                {tipo.label}
              </span>
            )}
            {area && (
              <span className={cn('text-[10px] font-semibold px-2 py-1 rounded border', cor(area.cor).chip)}>
                {area.label}
              </span>
            )}
            {salvandoAlgo && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-500" aria-label="Salvando" />}
          </div>
        </header>

        <div className="p-5 space-y-6">
          {!!problemas.length && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1">
              {problemas.map((p) => (
                <p key={p.outraId + p.tipo} className="flex items-start gap-2 text-[12px] text-amber-200/90">
                  <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                  {p.mensagem}
                </p>
              ))}
            </div>
          )}

          {a.descricao && (
            <p className="text-sm text-ink-300 whitespace-pre-wrap leading-relaxed">{a.descricao}</p>
          )}

          {/* Ficha ----------------------------------------------------------- */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
            {campoLigado(config, 'responsavel') && (
              <div>
                <dt className="text-ink-500 mb-0.5">Responsável</dt>
                <dd className="text-ink-200">
                  {a.responsavelNome ?? <span className="text-ink-600 italic">A definir</span>}
                </dd>
              </div>
            )}
            {campoLigado(config, 'artista') && (
              <div>
                <dt className="text-ink-500 mb-0.5">Artista</dt>
                <dd className="text-ink-200 truncate">
                  {equipe && a.artistaSlug && a.artistaNome ? (
                    <Link
                      href={`/artistas/${a.artistaSlug}`}
                      className="text-violet-400 hover:text-violet-300"
                    >
                      {a.artistaNome}
                    </Link>
                  ) : (
                    (a.artistaNome ?? <span className="text-ink-600 italic">Interna</span>)
                  )}
                </dd>
              </div>
            )}
            {(campoLigado(config, 'inicio') || campoLigado(config, 'prazo')) && (
              <div className="col-span-2">
                <dt className="text-ink-500 mb-0.5">Janela</dt>
                <dd
                  className={cn(
                    'flex items-center gap-1.5',
                    atrasada(a) ? 'text-red-400 font-semibold' : 'text-ink-200',
                  )}
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {a.inicio || a.prazo ? (
                    <span>
                      {a.inicio ? dataLonga(a.inicio) : 'sem início'}
                      {!a.marco && ` → ${a.prazo ? dataLonga(a.prazo) : 'sem prazo'}`}
                      <span className="text-ink-600">
                        {a.marco ? ' · marco' : ` · ${duracaoEmDias(a)} dias`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-600 italic">Sem datas</span>
                  )}
                </dd>
              </div>
            )}
            {campoLigado(config, 'esforco') && a.esforco && (
              <div>
                <dt className="text-ink-500 mb-0.5">Esforço</dt>
                <dd className="text-ink-200">{esforcoMeta[a.esforco].descricao}</dd>
              </div>
            )}
            <div>
              <dt className="text-ink-500 mb-0.5">Situação</dt>
              <dd
                className={cn(
                  situacao.tom === 'ruim'
                    ? 'text-red-400 font-semibold'
                    : situacao.tom === 'atencao'
                      ? 'text-amber-400'
                      : 'text-ink-200',
                )}
              >
                {situacao.texto}
              </dd>
            </div>
          </dl>

          {campoLigado(config, 'etiquetas') && !!a.etiquetas?.length && (
            <div className="flex flex-wrap gap-1.5">
              {a.etiquetas.map((e) => (
                <span
                  key={e}
                  className="text-[11px] px-2 py-0.5 rounded bg-bg-800 text-ink-300 border border-bg-700/50"
                >
                  {e}
                </span>
              ))}
            </div>
          )}

          {(itens.length > 0 || filhos.length > 0) && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-ink-500">Progresso</span>
                <span className="num font-semibold text-ink-300">{feito}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', feito === 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                  style={{ width: `${feito}%` }}
                />
              </div>
            </div>
          )}

          {/* Checklist ------------------------------------------------------- */}
          {campoLigado(config, 'checklist') && (
            <Secao icone={Check} titulo="Checklist" contagem={itens.length}>
              <ul className="space-y-1.5 mb-2">
                {itens.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 group">
                    <input
                      id={`chk-${i.id}`}
                      type="checkbox"
                      checked={i.feito}
                      onChange={() => alternarItem(a.id, i.id)}
                      className="mt-0.5 w-3.5 h-3.5 rounded accent-violet-500 shrink-0"
                    />
                    <label
                      htmlFor={`chk-${i.id}`}
                      className={cn(
                        'text-[13px] flex-1 cursor-pointer',
                        i.feito ? 'text-ink-500 line-through' : 'text-ink-200',
                      )}
                    >
                      {i.texto}
                    </label>
                    <button
                      type="button"
                      onClick={() => removerItem(i.id)}
                      aria-label={`Remover "${i.texto}" do checklist`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-ink-600 hover:text-red-400 transition-all shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={adicionarItem} className="flex gap-2">
                <input
                  type="text"
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  placeholder="Adicionar item…"
                  aria-label="Novo item do checklist"
                  className={cn(campo, 'py-1.5 text-[13px]')}
                />
                <button
                  type="submit"
                  aria-label="Adicionar item"
                  className="px-2.5 rounded-lg bg-bg-800 hover:bg-bg-700 text-ink-300 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </Secao>
          )}

          {/* Subtarefas ------------------------------------------------------ */}
          {campoLigado(config, 'subtarefas') && (
            <Secao icone={ListTree} titulo="Subtarefas" contagem={filhos.length}>
              <ul className="space-y-1.5 mb-2">
                {filhos.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span
                      className={cn('w-1.5 h-1.5 rounded-full shrink-0', cor(etapaDe(config, f.etapa)?.cor).bar)}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-[13px] flex-1 truncate',
                        concluida(f) ? 'text-ink-500 line-through' : 'text-ink-200',
                      )}
                    >
                      {f.titulo}
                    </span>
                    <span className="text-[10px] text-ink-600 num shrink-0">{progresso(f)}%</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={adicionarSubtarefa} className="flex gap-2">
                <input
                  type="text"
                  value={novaSub}
                  onChange={(e) => setNovaSub(e.target.value)}
                  placeholder="Nova subtarefa…"
                  aria-label="Nova subtarefa"
                  className={cn(campo, 'py-1.5 text-[13px]')}
                />
                <button
                  type="submit"
                  aria-label="Criar subtarefa"
                  className="px-2.5 rounded-lg bg-bg-800 hover:bg-bg-700 text-ink-300 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </Secao>
          )}

          {/* Dependências ---------------------------------------------------- */}
          {campoLigado(config, 'dependencias') && (
            <Secao icone={GitBranch} titulo="Depende de" contagem={(a.dependeDe ?? []).length}>
              <ul className="space-y-1.5 mb-2">
                {(a.dependeDe ?? []).map((depId) => {
                  const dep = todas.find((x) => x.id === depId)
                  // O colaborador só enxerga as demandas dele: a antecessora que
                  // não aparece é da equipe. Ele vê que ela existe, mas não a tira
                  // — quem montou a sequência foi a equipe.
                  const daEquipe = !dep && !equipe
                  return (
                    <li key={depId} className="flex items-center gap-2">
                      <span className="text-[13px] flex-1 truncate text-ink-200">
                        {dep?.titulo ??
                          (daEquipe ? (
                            <span className="text-ink-500 italic">demanda da equipe</span>
                          ) : (
                            <span className="text-ink-600 italic">demanda excluída</span>
                          ))}
                      </span>
                      {!daEquipe && (
                        <button
                          type="button"
                          onClick={() => alternarDependencia(depId)}
                          aria-label={`Remover dependência de "${dep?.titulo ?? depId}"`}
                          className="p-0.5 rounded text-ink-600 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <label htmlFor="dep-nova" className="sr-only">
                Adicionar dependência
              </label>
              <select
                id="dep-nova"
                value=""
                onChange={(e) => e.target.value && alternarDependencia(e.target.value)}
                className={cn(campo, 'py-1.5 text-[13px]')}
              >
                <option value="">Adicionar antecessora…</option>
                {candidatasDependencia
                  .filter((x) => !(a.dependeDe ?? []).includes(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.titulo}
                    </option>
                  ))}
              </select>
            </Secao>
          )}

          {/* Links ----------------------------------------------------------- */}
          {campoLigado(config, 'links') && (
            <Secao icone={Link2} titulo="Links" contagem={(a.links ?? []).length}>
              <ul className="space-y-1.5 mb-2">
                {(a.links ?? []).map((l) => {
                  // Link gravado antes da trava (ou por fora do painel) com
                  // esquema que não é web aparece como texto, nunca como href.
                  const href = urlSegura(l.url)
                  return (
                  <li key={l.id} className="flex items-center gap-2 group">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-violet-400 hover:text-violet-300 truncate flex items-center gap-1.5 flex-1"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                        {l.titulo}
                      </a>
                    ) : (
                      <span className="text-[13px] text-ink-400 truncate flex-1" title={l.url}>
                        {l.titulo}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removerLink(l.id)}
                      aria-label={`Remover link "${l.titulo}"`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-ink-600 hover:text-red-400 transition-all shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  )
                })}
              </ul>
              <form onSubmit={adicionarLink} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <input
                  type="text"
                  value={novoLink.titulo}
                  onChange={(e) => setNovoLink({ ...novoLink, titulo: e.target.value })}
                  placeholder="Nome"
                  aria-label="Nome do link"
                  className={cn(campo, 'py-1.5 text-[13px]')}
                />
                <input
                  type="url"
                  value={novoLink.url}
                  onChange={(e) => {
                    setNovoLink({ ...novoLink, url: e.target.value })
                    setErroLink(null)
                  }}
                  placeholder="https://…"
                  aria-label="Endereço do link"
                  aria-invalid={!!erroLink}
                  aria-describedby={erroLink ? 'erro-link' : undefined}
                  className={cn(campo, 'py-1.5 text-[13px]')}
                />
                <button
                  type="submit"
                  aria-label="Adicionar link"
                  className="px-2.5 rounded-lg bg-bg-800 hover:bg-bg-700 text-ink-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              {erroLink && (
                <p id="erro-link" role="alert" className="text-[12px] text-amber-300 mt-1.5">
                  {erroLink}
                </p>
              )}
            </Secao>
          )}

          {/* Comentários ----------------------------------------------------- */}
          {campoLigado(config, 'comentarios') && (
            <Secao
              icone={MessageSquare}
              titulo="Comentários"
              contagem={comentarios?.length ?? a.qtdComentarios ?? 0}
            >
              {comentarios === null ? (
                <p className="flex items-center gap-2 text-[12px] text-ink-500 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
                </p>
              ) : (
                <ul className="space-y-3 mb-3">
                  {comentarios.map((c) => (
                    <li key={c.id} className="group">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-ink-200">{c.autorNome}</span>
                        <span className="text-[10px] text-ink-600 num">{quandoFoi(c.em)}</span>
                        {c.autorUid === appUser?.uid && (
                          <button
                            type="button"
                            onClick={() => apagarComentario(c.id)}
                            aria-label="Excluir comentário"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 ml-auto p-0.5 rounded text-ink-600 hover:text-red-400 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-ink-300 whitespace-pre-wrap">{c.texto}</p>
                    </li>
                  ))}
                  {!comentarios.length && (
                    <li className="text-[12px] text-ink-600">Nenhum comentário ainda.</li>
                  )}
                </ul>
              )}
              <form onSubmit={enviarComentario} className="space-y-2">
                <textarea
                  rows={2}
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Escrever um comentário…"
                  aria-label="Novo comentário"
                  className={cn(campo, 'resize-none text-[13px]')}
                />
                <button
                  type="submit"
                  disabled={enviando || !novoComentario.trim()}
                  className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  {enviando ? 'Publicando…' : 'Comentar'}
                </button>
              </form>
            </Secao>
          )}

          {/* Histórico ------------------------------------------------------- */}
          {!!a.historico?.length && (
            <Secao icone={HistoryIcon} titulo="Histórico" contagem={a.historico.length}>
              <ul className="space-y-1.5">
                {a.historico
                  .slice()
                  .reverse()
                  .map((m, i) => (
                    <li key={`${m.em}-${i}`} className="text-[12px] text-ink-400">
                      <span className="text-ink-600 num">{quandoFoi(m.em)}</span> · {m.quem} moveu de{' '}
                      <span className="text-ink-300">
                        {etapaDe(config, m.de ?? '')?.label ?? m.de}
                      </span>{' '}
                      para{' '}
                      <span className="text-ink-300">{etapaDe(config, m.para)?.label ?? m.para}</span>
                    </li>
                  ))}
              </ul>
            </Secao>
          )}
        </div>
      </aside>
    </div>
  )
}

function Secao({
  icone: Icone,
  titulo,
  contagem,
  children,
}: {
  icone: typeof Check
  titulo: string
  contagem: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
        <Icone className="w-3.5 h-3.5" aria-hidden />
        {titulo}
        {contagem > 0 && <span className="num text-ink-600">({contagem})</span>}
      </h3>
      {children}
    </section>
  )
}

/** "há 3 dias" / "há 2 h" / "agora" — precisão do relógio não importa aqui. */
function quandoFoi(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} dia${d === 1 ? '' : 's'}`
  const m = Math.floor(d / 30)
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
}

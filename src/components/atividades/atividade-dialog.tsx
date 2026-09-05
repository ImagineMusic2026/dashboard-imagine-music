'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, CircleDot, LayoutTemplate, RefreshCw, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/components/auth/auth-provider'
import { useQuadro } from '@/components/atividades/quadro-contexto'
import {
  atualizarAtividade,
  criarAtividade,
  criarDeModelo,
  hojeISO,
  idLocal,
  ordemNoFim,
  somarDias,
  transicao,
  type Atividade,
} from '@/lib/atividades/client'
import {
  areaDe,
  campoLigado,
  chavesFinais,
  cor,
  esforcoMeta,
  ESFORCOS,
  etapaDe,
  prioridadeMeta,
  PRIORIDADES,
  tipoDe,
  type Esforco,
  type Prioridade,
  type TemplateDemanda,
} from '@/lib/atividades/tipos'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-sm font-medium text-ink-300 mb-1.5'

/**
 * Formulário de criar/editar demanda.
 *
 * Ao CRIAR, a primeira decisão é o modelo — e não é enfeite: um modelo com
 * etapas monta o projeto inteiro de uma vez (a demanda mãe mais as subtarefas
 * encadeadas e datadas), que é justamente o que ninguém faz à mão toda vez que
 * sai um single. "Em branco" continua ali para o pedido avulso.
 *
 * Os campos que aparecem saem da configuração do quadro: um time que desligou
 * "esforço" e "tipo" vê um formulário mais curto, não um campo desabilitado.
 */
export function AtividadeDialog({
  atividade,
  etapaInicial,
  onFechar,
  onSalvo,
}: {
  atividade: Atividade | null
  /** Coluna em que o "+" foi clicado — já vem selecionada ao criar. */
  etapaInicial: string
  onFechar: () => void
  onSalvo: (id: string) => void | Promise<void>
}) {
  const { appUser } = useAuth()
  const { config, todas, artistas, equipe, etiquetasConhecidas, aplicarLocal, recarregar } =
    useQuadro()
  const editando = !!atividade

  const [modelo, setModelo] = useState<TemplateDemanda | null>(null)
  /** Título cru do modelo, com `{artista}` ainda por resolver. */
  const [tituloDoModelo, setTituloDoModelo] = useState<string | null>(null)
  const tocouNoTitulo = useRef(false)
  const [modelosAbertos, setModelosAbertos] = useState(false)
  const painel = useRef<HTMLDivElement>(null)
  const primeiroCampo = useRef<HTMLInputElement>(null)
  const [titulo, setTitulo] = useState(atividade?.titulo ?? '')
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '')
  const [etapa, setEtapa] = useState(atividade?.etapa ?? etapaInicial)
  const [prioridade, setPrioridade] = useState<Prioridade>(atividade?.prioridade ?? 'media')
  const [tipo, setTipo] = useState(atividade?.tipo ?? '')
  const [area, setArea] = useState(atividade?.area ?? '')
  const [esforco, setEsforco] = useState<Esforco | ''>(atividade?.esforco ?? '')
  const [inicio, setInicio] = useState(atividade?.inicio ?? '')
  const [prazo, setPrazo] = useState(atividade?.prazo ?? '')
  const [marco, setMarco] = useState(!!atividade?.marco)
  const [etiquetas, setEtiquetas] = useState<string[]>(atividade?.etiquetas ?? [])
  const [novaEtiqueta, setNovaEtiqueta] = useState('')
  const [artistaSlug, setArtistaSlug] = useState(atividade?.artistaSlug ?? '')
  const [responsavelUid, setResponsavelUid] = useState(atividade?.responsavelUid ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const artistaEscolhido = useMemo(
    () => artistas.find((a) => a.slug === artistaSlug) ?? null,
    [artistas, artistaSlug],
  )

  /**
   * Aplica um modelo aos campos — o projeto em si só é montado ao salvar.
   *
   * Sempre parte do ZERO antes de aplicar. Antes só sobrescrevia o que o modelo
   * definia, então voltar para "Em branco" (ou trocar de modelo) deixava para
   * trás a área, a prioridade e as etiquetas do modelo anterior — a pessoa via
   * "Em branco" selecionado e um formulário cheio de um projeto que ela
   * descartou.
   */
  function escolherModelo(m: TemplateDemanda | null) {
    setModelo(m)
    setTituloDoModelo(m?.titulo ?? null)

    setTitulo('')
    setDescricao('')
    setTipo('')
    setArea('')
    setPrioridade('media')
    setEsforco('')
    setEtiquetas([])
    setMarco(false)
    setInicio('')
    setPrazo('')
    setEtapa(etapaInicial)
    if (!m) return

    if (m.descricao) setDescricao(m.descricao)
    if (m.tipo) setTipo(m.tipo)
    if (m.area) setArea(m.area)
    if (m.prioridade) setPrioridade(m.prioridade)
    if (m.esforco) setEsforco(m.esforco)
    if (m.etiquetas?.length) setEtiquetas(m.etiquetas)
    const hoje = hojeISO()
    setInicio(hoje)
    if (typeof m.prazoEmDias === 'number') setPrazo(somarDias(hoje, m.prazoEmDias))
  }

  /**
   * `{artista}` é resolvido enquanto a pessoa não digita um título próprio.
   *
   * Antes era resolvido no clique do modelo, então escolher o artista DEPOIS
   * deixava o título com o literal "o artista" — e quase todo mundo escolhe o
   * modelo primeiro.
   */
  useEffect(() => {
    if (!tituloDoModelo || tocouNoTitulo.current) return
    setTitulo(tituloDoModelo.replace('{artista}', artistaEscolhido?.nome ?? 'o artista'))
  }, [tituloDoModelo, artistaEscolhido])

  /**
   * Foco e teclado do diálogo.
   *
   * Sem isto o `fixed inset-0` era só um retângulo pintado por cima: o leitor de
   * tela não anunciava um diálogo, o Tab passeava pela página inteira por baixo
   * dele e o Esc não fechava. O foco entra no campo do título ao abrir e volta
   * ao elemento de origem ao fechar.
   */
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null
    primeiroCampo.current?.focus()
    return () => origem?.focus?.()
  }, [])

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      // `stopPropagation` porque o painel de detalhe pode estar atrás ouvindo o
      // mesmo Esc: sem isto os dois fechavam de uma vez.
      e.stopPropagation()
      onFechar()
      return
    }
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

  function alternarEtiqueta(e: string) {
    setEtiquetas((atual) => (atual.includes(e) ? atual.filter((x) => x !== e) : [...atual, e]))
  }

  function adicionarEtiqueta() {
    const nova = novaEtiqueta.trim().toLowerCase()
    if (!nova) return
    setEtiquetas((atual) => (atual.includes(nova) ? atual : [...atual, nova]))
    setNovaEtiqueta('')
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (salvando || !appUser) return
    setErro(null)
    if (!titulo.trim()) {
      setErro('Dê um título à demanda.')
      return
    }
    if (inicio && prazo && prazo < inicio) {
      setErro('O prazo não pode ser antes do início.')
      return
    }
    setSalvando(true)
    try {
      const resp = equipe.find((u) => u.uid === responsavelUid)
      const dados = {
        titulo: titulo.trim(),
        descricao,
        etapa,
        prioridade,
        tipo: tipo || null,
        area: area || null,
        etiquetas,
        // Marco é um acontecimento, não um trabalho com duração: as duas pontas
        // colapsam na mesma data pra barra não aparecer no cronograma.
        inicio: marco ? prazo || inicio || null : inicio || null,
        prazo: marco ? prazo || inicio || null : prazo || null,
        esforco: marco ? null : esforco || null,
        marco,
        artistaSlug: artistaSlug || null,
        artistaNome: artistaEscolhido?.nome ?? null,
        responsavelUid: responsavelUid || null,
        responsavelNome: resp ? resp.nome || resp.email : null,
        paiId: atividade?.paiId ?? null,
        dependeDe: atividade?.dependeDe ?? [],
        checklist: atividade?.checklist ?? [],
        links: atividade?.links ?? [],
        progresso: atividade?.progresso ?? null,
      }

      let id: string
      if (editando && atividade) {
        await atualizarAtividade(
          atividade.id,
          dados,
          atividade,
          config,
          appUser.nome || appUser.email,
        )
        id = atividade.id
        // Aplica no estado local em vez de reler a coleção inteira: o documento
        // resultante é exatamente o que acabou de ser gravado.
        aplicarLocal({
          ...atividade,
          ...dados,
          ...(atividade.etapa !== dados.etapa
            ? transicao(atividade, dados.etapa, config, appUser.nome || appUser.email)
            : {}),
        })
      } else if (modelo?.etapas?.length) {
        // Modelo com etapas monta o projeto inteiro num lote só — e é o único
        // caminho que ainda relê: são N documentos criados de uma vez, com ids
        // que o formulário não tem em mãos.
        id = await criarDeModelo(
          modelo,
          { ...dados, inicio: inicio || hojeISO() },
          appUser.uid,
          todas,
          config,
        )
        await recarregar()
      } else {
        const comChecklist = {
          ...dados,
          checklist: (modelo?.checklist ?? []).map((t) => ({
            id: idLocal(),
            texto: t,
            feito: false,
          })),
        }
        id = await criarAtividade(comChecklist, appUser.uid, todas, config)
        const agora = new Date().toISOString()
        aplicarLocal({
          id,
          ...comChecklist,
          ordem: ordemNoFim(todas, comChecklist.etapa),
          concluidoEm: chavesFinais(config).has(comChecklist.etapa) ? agora : null,
          etapaDesde: agora,
          temposPorEtapa: {},
          qtdComentarios: 0,
          historico: [],
          criadoPor: appUser.uid,
        })
      }
      await onSalvo(id)
    } catch (err) {
      setErro(
        err instanceof FirebaseError && err.code === 'permission-denied'
          ? 'Sem permissão. Confirme que você é da equipe e que as regras do Firestore estão publicadas.'
          : 'Não foi possível salvar a demanda.',
      )
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onFechar} aria-hidden />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="at-dialogo-titulo"
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className="relative w-full max-w-lg bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl z-10">
          <div id="at-dialogo-titulo" className="font-bold text-ink-100">
            {editando ? 'Editar demanda' : 'Nova demanda'}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="p-1.5 rounded-md hover:bg-bg-800 text-ink-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form className="p-5 space-y-4" onSubmit={aoEnviar}>
          {!editando && !!config.templates.length && (
            <div>
              {/* Recolhido por padrão: na maioria das vezes a escolha é "Em
                  branco", e a lista aberta empurrava o resto do formulário
                  para fora da tela. O resumo à direita mostra o que está
                  valendo, então recolher não esconde a decisão. */}
              <button
                type="button"
                onClick={() => setModelosAbertos((v) => !v)}
                aria-expanded={modelosAbertos}
                aria-controls="at-modelos"
                className={cn(
                  'w-full flex items-center gap-1.5 text-sm font-medium text-ink-300 hover:text-ink-100 transition-colors rounded',
                  modelosAbertos ? 'mb-1.5' : '',
                )}
              >
                <LayoutTemplate className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Começar de um modelo
                <span className="ml-auto flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-violet-300 truncate">
                    {modelo ? modelo.nome : 'Em branco'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 shrink-0 text-ink-500 transition-transform',
                      modelosAbertos && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </span>
              </button>

              {/* `grid` e `hidden` são exclusivas de propósito. Usar o atributo
                  `hidden` aqui não funcionava: a classe `grid` define
                  `display: grid` e vence o `display: none` que o atributo
                  aplica — o bloco continuava aberto com `aria-expanded=false`,
                  o pior dos dois mundos. */}
              <div
                id="at-modelos"
                className={cn('gap-1.5', modelosAbertos ? 'grid' : 'hidden')}
              >
                <button
                  type="button"
                  onClick={() => {
                    escolherModelo(null)
                    setModelosAbertos(false)
                  }}
                  aria-pressed={modelo === null}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg border text-xs transition-colors',
                    modelo === null
                      ? 'bg-violet-500/10 border-violet-500/40 text-violet-200'
                      : 'bg-bg-950 border-bg-700/50 text-ink-300 hover:bg-bg-800',
                  )}
                >
                  <span className="font-semibold">Em branco</span>
                  <span className="block text-ink-500 mt-0.5">Uma demanda avulsa, do zero.</span>
                </button>
                {config.templates.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      escolherModelo(m)
                      setModelosAbertos(false)
                    }}
                    aria-pressed={modelo?.key === m.key}
                    className={cn(
                      'text-left px-3 py-2 rounded-lg border text-xs transition-colors',
                      modelo?.key === m.key
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-200'
                        : 'bg-bg-950 border-bg-700/50 text-ink-300 hover:bg-bg-800',
                    )}
                  >
                    <span className="font-semibold">{m.nome}</span>
                    {m.etapas?.length ? (
                      <span className="ml-1.5 text-[10px] px-1.5 py-px rounded bg-bg-700 text-ink-300">
                        {m.etapas.length} subtarefas
                      </span>
                    ) : null}
                    {m.descricaoModelo && (
                      <span className="block text-ink-500 mt-0.5">{m.descricaoModelo}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="at-titulo" className={rotulo}>
              O que precisa ser feito
            </label>
            <input
              id="at-titulo"
              ref={primeiroCampo}
              type="text"
              required
              value={titulo}
              onChange={(e) => {
                tocouNoTitulo.current = true
                setTitulo(e.target.value)
              }}
              placeholder="Ex.: Roteiro do clipe de “Madrugada”"
              className={campo}
            />
          </div>

          {/* Com modelo de projeto, a etapa inicial é decidida pelo próprio
              modelo (tudo nasce na primeira coluna), então o seletor sai de cena
              em vez de prometer uma escolha que não seria respeitada. */}
          {!modelo?.etapas?.length && (
            <div>
              <div className={rotulo}>Etapa</div>
              <div className="flex flex-wrap gap-1.5">
                {config.etapas.map((et) => (
                  <button
                    key={et.key}
                    type="button"
                    onClick={() => setEtapa(et.key)}
                    aria-pressed={etapa === et.key}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                      etapa === et.key
                        ? cn(cor(et.cor).text, 'border-current bg-bg-800')
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                    )}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {campoLigado(config, 'responsavel') && (
              <div>
                <label htmlFor="at-resp" className={rotulo}>
                  Responsável
                </label>
                <select
                  id="at-resp"
                  value={responsavelUid}
                  onChange={(e) => setResponsavelUid(e.target.value)}
                  className={campo}
                >
                  <option value="">— A definir —</option>
                  {equipe.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.nome || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {campoLigado(config, 'artista') && (
              <div>
                <label htmlFor="at-artista" className={rotulo}>
                  Artista
                </label>
                <select
                  id="at-artista"
                  value={artistaSlug}
                  onChange={(e) => setArtistaSlug(e.target.value)}
                  className={campo}
                >
                  <option value="">— Interna —</option>
                  {artistas.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {campoLigado(config, 'tipo') && !!config.tipos.length && (
              <div>
                <label htmlFor="at-tipo" className={rotulo}>
                  Tipo
                </label>
                <select
                  id="at-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={campo}
                >
                  <option value="">— Nenhum —</option>
                  {config.tipos.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                  {tipo && !tipoDe(config, tipo) && <option value={tipo}>{tipo}</option>}
                </select>
              </div>
            )}
            {campoLigado(config, 'area') && !!config.areas.length && (
              <div>
                <label htmlFor="at-area" className={rotulo}>
                  Área
                </label>
                <select
                  id="at-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className={campo}
                >
                  <option value="">— Nenhuma —</option>
                  {config.areas.map((ar) => (
                    <option key={ar.key} value={ar.key}>
                      {ar.label}
                    </option>
                  ))}
                  {area && !areaDe(config, area) && <option value={area}>{area}</option>}
                </select>
              </div>
            )}
          </div>

          {(campoLigado(config, 'inicio') || campoLigado(config, 'prazo')) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-ink-300">Datas</span>
                <button
                  type="button"
                  onClick={() => setMarco((v) => !v)}
                  aria-pressed={marco}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                    marco
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                  )}
                  title="Marco: um acontecimento numa data, sem duração"
                >
                  <CircleDot className="w-3 h-3" aria-hidden />
                  Marco
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {campoLigado(config, 'inicio') && !marco && (
                  <div>
                    <label htmlFor="at-inicio" className="block text-[11px] text-ink-500 mb-1">
                      Início
                    </label>
                    <input
                      id="at-inicio"
                      type="date"
                      value={inicio}
                      onChange={(e) => setInicio(e.target.value)}
                      className={cn(campo, '[color-scheme:dark]')}
                    />
                  </div>
                )}
                <div className={cn(marco && 'col-span-2')}>
                  <label htmlFor="at-prazo" className="block text-[11px] text-ink-500 mb-1">
                    {marco ? 'Data do marco' : 'Prazo'}
                  </label>
                  <input
                    id="at-prazo"
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    className={cn(campo, '[color-scheme:dark]')}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={cn('grid gap-3', campoLigado(config, 'esforco') ? 'grid-cols-2' : 'grid-cols-1')}>
            <div>
              <div className={rotulo}>Prioridade</div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridade(p)}
                    aria-pressed={prioridade === p}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                      prioridade === p
                        ? prioridadeMeta[p].chip
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                    )}
                  >
                    {prioridadeMeta[p].label}
                  </button>
                ))}
              </div>
            </div>

            {campoLigado(config, 'esforco') && !marco && (
              <div>
                <div className={rotulo}>Esforço</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {ESFORCOS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setEsforco(esforco === x ? '' : x)}
                      aria-pressed={esforco === x}
                      title={esforcoMeta[x].descricao}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                        esforco === x
                          ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                          : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                      )}
                    >
                      {esforcoMeta[x].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {campoLigado(config, 'etiquetas') && (
            <div>
              <div className={rotulo}>Etiquetas</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {etiquetasConhecidas.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => alternarEtiqueta(e)}
                    aria-pressed={etiquetas.includes(e)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] border transition-colors',
                      etiquetas.includes(e)
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaEtiqueta}
                  onChange={(e) => setNovaEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Enter numa etiqueta nova não pode enviar o formulário
                      // inteiro — a pessoa ainda está preenchendo.
                      e.preventDefault()
                      adicionarEtiqueta()
                    }
                  }}
                  placeholder="Nova etiqueta…"
                  aria-label="Nova etiqueta"
                  className={cn(campo, 'py-1.5 text-[13px]')}
                />
                <button
                  type="button"
                  onClick={adicionarEtiqueta}
                  className="px-3 rounded-lg bg-bg-800 hover:bg-bg-700 text-ink-300 text-xs font-semibold transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="at-desc" className={rotulo}>
              Detalhes (opcional)
            </label>
            <textarea
              id="at-desc"
              rows={2}
              value={descricao ?? ''}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, links, o que foi combinado…"
              className={cn(campo, 'resize-none')}
            />
          </div>

          {modelo?.etapas?.length ? (
            <p className="text-[11px] text-violet-300/80 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
              Vai criar <strong>{modelo.etapas.length} subtarefas</strong> encadeadas a partir de{' '}
              {inicio ? new Date(`${inicio}T12:00:00`).toLocaleDateString('pt-BR') : 'hoje'}, já com
              datas e dependências. Dá pra ajustar tudo depois no cronograma.
            </p>
          ) : null}

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
            {salvando
              ? 'Salvando…'
              : editando
                ? 'Salvar alterações'
                : modelo?.etapas?.length
                  ? 'Criar projeto'
                  : 'Criar demanda'}
          </button>
          {/* Etapa atual é informação, não decisão, quando o modelo manda. */}
          {!editando && modelo?.etapas?.length ? (
            <p className="text-[10px] text-ink-600 text-center">
              Tudo nasce em {etapaDe(config, config.etapas[0]?.key)?.label ?? 'na primeira etapa'}.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

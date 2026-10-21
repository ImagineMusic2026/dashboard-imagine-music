'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/components/auth/auth-provider'
import { carregarConfig, chaveDe, salvarConfig } from '@/lib/atividades/config'
import { listarAtividades, listarResponsaveis, type Atividade } from '@/lib/atividades/client'
import {
  CAMPOS,
  CONFIG_PADRAO,
  CORES,
  cor,
  PALETA,
  PRIORIDADES,
  prioridadeMeta,
  VISOES,
  visaoMeta,
  type AreaConfig,
  type CampoOpcional,
  type ConfigQuadro,
  type CorChave,
  type EtapaConfig,
  type EtapaModelo,
  type TemplateDemanda,
  type TipoConfig,
  type Visao,
} from '@/lib/atividades/tipos'
import { ehColaborador } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const campo =
  'bg-bg-950 border border-bg-700/50 rounded-lg px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

/**
 * A tela onde o quadro é configurado — colunas, vocabulário, campos, visões e
 * modelos de projeto.
 *
 * Fica nas Configurações e só o ADMIN escreve (é a regra de `configuracoes/`
 * que já existia). O motivo é simples: renomear uma coluna é cosmético, mas
 * apagar uma muda o quadro de todo mundo ao mesmo tempo. Quem está tocando uma
 * demanda não deveria poder fazer isso sem querer.
 *
 * Duas travas que valem a pena estar escritas:
 *
 * 1. **Coluna em uso não é apagada.** A tela conta quantas demandas estão em
 *    cada etapa e bloqueia a remoção enquanto houver alguma. Apagar mesmo assim
 *    deixaria demandas numa coluna que não existe — invisíveis no quadro.
 * 2. **A chave nunca muda ao renomear.** A chave é o que está gravado em cada
 *    demanda; o rótulo é só o nome na tela. Trocar "Briefing" por "Roteiro"
 *    é seguro e instantâneo.
 * 3. **Responsável não desliga com colaborador no time.** O colaborador só
 *    enxerga as demandas em que é o responsável; sem o campo, não há como
 *    atribuir nada a ele e o quadro dele fica vazio sem explicação. Foi o que
 *    aconteceu no primeiro convite de colaborador da Imagine.
 *
 * Nada é salvo até apertar "Salvar" — a pessoa mexe à vontade e compara.
 */
export function ConfigQuadroTab() {
  const { role } = useAuth()
  // O corte de papel vem ANTES do componente que lê: montar o corpo para depois
  // devolver o aviso faria quem não é admin pagar uma varredura da coleção
  // `atividades` só para ler "só o admin configura".
  if (role !== 'admin') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6">
        <h2 className="text-lg font-bold text-ink-100 mb-1">Quadro de atividades</h2>
        <p className="text-sm text-ink-400">
          Só o admin configura as colunas, os campos e os modelos do quadro. Fale com quem administra
          o painel.
        </p>
      </div>
    )
  }
  return <ConfigQuadroAdmin />
}

function ConfigQuadroAdmin() {
  const [config, setConfig] = useState<ConfigQuadro | null>(null)
  // `null` = ainda não sei (carregando ou falhou). Diferente de "zero demandas":
  // ver `usoPorEtapa` abaixo.
  const [atividades, setAtividades] = useState<Atividade[] | null>(null)
  // Colaboradores ativos com acesso às Atividades. `null` = não sei, e aí o
  // campo Responsável fica travado do mesmo jeito (ver `usoDesconhecido`).
  const [colaboradores, setColaboradores] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregarConfig()
      .then(setConfig)
      .catch(() => setConfig(CONFIG_PADRAO))
    listarAtividades()
      .then(setAtividades)
      // Continua `null` no erro: melhor travar a remoção do que apagar uma
      // coluna cheia por não ter conseguido conferir.
      .catch(() => setAtividades(null))
    listarResponsaveis()
      .then((pessoas) => setColaboradores(pessoas.filter((u) => ehColaborador(u.role)).length))
      .catch(() => setColaboradores(null))
  }, [])

  // O campo Responsável só pode ser DESLIGADO quando não há colaborador para
  // ficar sem demanda. Ligar continua sempre permitido.
  const travaResponsavel = colaboradores === null || colaboradores > 0

  /**
   * Ainda não sabemos quantas demandas usam cada chave?
   *
   * Isso importa porque a trava "coluna em uso não é apagada" se apoia na
   * contagem: enquanto a leitura não chega — ou se ela FALHA — todo contador
   * seria zero e a trava abriria sozinha, deixando apagar uma coluna cheia. Aqui
   * "não sei" é tratado como "não deixa", que é o lado seguro.
   */
  const usoDesconhecido = atividades === null

  const usoPorEtapa = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of atividades ?? []) m.set(a.etapa, (m.get(a.etapa) ?? 0) + 1)
    return m
  }, [atividades])

  const usoPorTipo = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of atividades ?? []) if (a.tipo) m.set(a.tipo, (m.get(a.tipo) ?? 0) + 1)
    return m
  }, [atividades])

  const usoPorArea = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of atividades ?? []) if (a.area) m.set(a.area, (m.get(a.area) ?? 0) + 1)
    return m
  }, [atividades])

  /**
   * Tipos e áreas citados pelos MODELOS. Apagar uma área que um modelo usa não
   * quebra nada hoje, mas todo projeto criado por aquele modelo passaria a
   * gravar uma chave que não existe mais — e o chip some do card sem aviso.
   */
  const usadosPorModelos = useMemo(() => {
    const tipos = new Set<string>()
    const areas = new Set<string>()
    for (const m of config?.templates ?? []) {
      if (m.tipo) tipos.add(m.tipo)
      if (m.area) areas.add(m.area)
      for (const et of m.etapas ?? []) if (et.area) areas.add(et.area)
    }
    return { tipos, areas }
  }, [config])

  if (!config) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-10">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando configuração…
      </div>
    )
  }

  const alterar = (mudanca: Partial<ConfigQuadro>) => {
    setConfig({ ...config, ...mudanca })
    setSalvo(false)
  }

  async function salvar() {
    if (!config) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarConfig(config)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    } catch (e) {
      // A mensagem antiga culpava as regras do Firestore em QUALQUER falha, o
      // que mandava quem só queria salvar caçar um problema de permissão que
      // quase sempre não existe.
      const semPermissao = e instanceof FirebaseError && e.code === 'permission-denied'
      setErro(
        semPermissao
          ? 'Sem permissão para salvar. Só o admin configura o quadro — confirme seu papel no painel.'
          : 'Não consegui salvar a configuração. Tente de novo; se persistir, recarregue a página.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
        <h2 className="text-lg font-bold text-ink-100 mb-1">Quadro de atividades</h2>
        <p className="text-sm text-ink-400">
          Aqui você define como o quadro funciona para o time inteiro: as colunas do fluxo, o
          vocabulário da casa, quais campos cada demanda tem, quais visões ficam disponíveis e os
          modelos de projeto que já nascem prontos.
        </p>
      </div>

      {/* Etapas ------------------------------------------------------------ */}
      <Bloco
        titulo="Etapas do fluxo"
        descricao="As colunas do quadro, na ordem em que a demanda anda. A última marcada como “entrega” é a que carimba a conclusão e alimenta os indicadores."
      >
        <ul className="space-y-2">
          {config.etapas.map((etapa, i) => (
            <li
              key={etapa.key}
              className="flex flex-wrap items-center gap-2 bg-bg-950/60 border border-bg-700/40 rounded-lg p-2"
            >
              <SetasDeOrdem
                indice={i}
                total={config.etapas.length}
                rotulo={etapa.label}
                aoMover={(destino) => alterar({ etapas: reordenar(config.etapas, i, destino) })}
              />

              <input
                type="text"
                value={etapa.label}
                onChange={(e) =>
                  alterar({ etapas: trocar(config.etapas, i, { label: e.target.value }) })
                }
                aria-label={`Nome da etapa ${i + 1}`}
                className={cn(campo, 'w-36')}
              />

              <SeletorDeCor
                valor={etapa.cor}
                rotulo={`Cor da etapa ${etapa.label}`}
                aoEscolher={(c) => alterar({ etapas: trocar(config.etapas, i, { cor: c }) })}
              />

              <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
                Limite
                <input
                  type="number"
                  min={0}
                  value={etapa.wip ?? ''}
                  onChange={(e) =>
                    alterar({
                      etapas: trocar(config.etapas, i, {
                        wip: e.target.value ? Number(e.target.value) : null,
                      }),
                    })
                  }
                  placeholder="—"
                  aria-label={`Limite de demandas em ${etapa.label}`}
                  className={cn(campo, 'w-16 num')}
                />
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <input
                  type="checkbox"
                  checked={!!etapa.final}
                  onChange={(e) =>
                    alterar({ etapas: trocar(config.etapas, i, { final: e.target.checked }) })
                  }
                  className="w-3.5 h-3.5 rounded accent-violet-500"
                />
                É entrega
              </label>

              <span className="text-[11px] text-ink-600 num ml-auto">
                {usoDesconhecido ? '—' : contagem(usoPorEtapa.get(etapa.key) ?? 0, 'demanda')}
              </span>

              <BotaoRemover
                rotulo={`Remover a etapa ${etapa.label}`}
                bloqueio={
                  usoDesconhecido
                    ? 'Ainda conferindo quantas demandas estão nesta coluna.'
                    : (usoPorEtapa.get(etapa.key) ?? 0) > 0
                      ? 'Tem demanda nesta coluna — mova-as antes de remover.'
                      : config.etapas.length <= 2
                        ? 'Um quadro precisa de pelo menos duas colunas.'
                        : null
                }
                aoRemover={() => alterar({ etapas: config.etapas.filter((_, x) => x !== i) })}
              />
            </li>
          ))}
        </ul>

        <BotaoAdicionar
          rotulo="Adicionar etapa"
          aoAdicionar={(nome) =>
            alterar({
              etapas: [
                ...config.etapas,
                {
                  key: chaveUnica(nome, config.etapas),
                  label: nome,
                  cor: 'cinza',
                  wip: null,
                } as EtapaConfig,
              ],
            })
          }
        />
      </Bloco>

      {/* Tipos e áreas ----------------------------------------------------- */}
      <Bloco
        titulo="Tipos de demanda"
        descricao="A natureza do pedido — lançamento, conteúdo, show. É opcional em cada demanda."
      >
        <ListaRotulada
          itens={config.tipos}
          uso={usoPorTipo}
          usoDesconhecido={usoDesconhecido}
          usadosPorModelos={usadosPorModelos.tipos}
          aoAlterar={(tipos) => alterar({ tipos: tipos as TipoConfig[] })}
          nomeSingular="tipo"
        />
      </Bloco>

      <Bloco
        titulo="Áreas responsáveis"
        descricao="O time dono da demanda, ao lado da pessoa responsável. Sobrevive à troca de quem executa."
      >
        <ListaRotulada
          itens={config.areas}
          uso={usoPorArea}
          usoDesconhecido={usoDesconhecido}
          usadosPorModelos={usadosPorModelos.areas}
          aoAlterar={(areas) => alterar({ areas: areas as AreaConfig[] })}
          nomeSingular="área"
        />
      </Bloco>

      {/* Etiquetas --------------------------------------------------------- */}
      <Bloco
        titulo="Etiquetas sugeridas"
        descricao="Aparecem prontas no formulário. A equipe pode criar outras na hora — estas são só o atalho."
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {config.etiquetas.map((e) => (
            <span
              key={e}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-bg-800 text-ink-300 border border-bg-700/50"
            >
              {e}
              <button
                type="button"
                onClick={() => alterar({ etiquetas: config.etiquetas.filter((x) => x !== e) })}
                aria-label={`Remover etiqueta ${e}`}
                className="text-ink-600 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          {!config.etiquetas.length && (
            <span className="text-[11px] text-ink-600">Nenhuma etiqueta sugerida.</span>
          )}
        </div>
        <BotaoAdicionar
          rotulo="Adicionar etiqueta"
          aoAdicionar={(nome) => {
            const nova = nome.trim().toLowerCase()
            if (config.etiquetas.includes(nova)) return
            alterar({ etiquetas: [...config.etiquetas, nova] })
          }}
        />
      </Bloco>

      {/* Campos ------------------------------------------------------------ */}
      <Bloco
        titulo="Campos da demanda"
        descricao="Desligar um campo o esconde do formulário, do card e das visões — o dado já gravado não é apagado."
      >
        <ul className="grid sm:grid-cols-2 gap-2">
          {CAMPOS.map(({ campo: c, label, descricao }) => {
            const ligado = config.campos[c] !== false
            const travado = c === 'responsavel' && travaResponsavel
            // Travado e ligado: não desliga. Travado e desligado (como ficou na
            // Imagine): o aviso pede para ligar, e ligar é permitido.
            const bloqueado = travado && ligado
            const quantos =
              colaboradores === null
                ? null
                : `${colaboradores} ${colaboradores === 1 ? 'colaborador' : 'colaboradores'}`
            return (
              <li key={c}>
                <label
                  className={cn(
                    'flex items-start gap-2.5 bg-bg-950/60 border rounded-lg p-2.5 transition-colors',
                    bloqueado
                      ? 'border-bg-700/40 cursor-not-allowed'
                      : 'border-bg-700/40 cursor-pointer hover:border-bg-700',
                    travado && !ligado && 'border-amber-500/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={ligado}
                    disabled={bloqueado}
                    aria-describedby={travado ? `campo-${c}-aviso` : undefined}
                    onChange={(e) =>
                      alterar({ campos: { ...config.campos, [c]: e.target.checked } as Record<CampoOpcional, boolean> })
                    }
                    className="mt-0.5 w-3.5 h-3.5 rounded accent-violet-500 shrink-0 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink-200">{label}</span>
                    <span className="block text-[11px] text-ink-500">{descricao}</span>
                    {travado && ligado && (
                      <span id={`campo-${c}-aviso`} className="block text-[11px] text-ink-400 mt-1.5">
                        {quantos
                          ? `Fica ligado: há ${quantos} no time, e colaborador só enxerga as demandas em que é o responsável.`
                          : 'Fica ligado: não consegui conferir se há colaboradores no time, e colaborador só enxerga as demandas em que é o responsável.'}
                      </span>
                    )}
                    {travado && !ligado && (
                      <span
                        id={`campo-${c}-aviso`}
                        role="alert"
                        className="flex items-start gap-1.5 text-[11px] text-amber-300 mt-1.5"
                      >
                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden />
                        <span>
                          {quantos
                            ? `Há ${quantos} no time e, com este campo desligado, nenhum deles enxerga demanda alguma: colaborador só vê as demandas em que é o responsável. Ligue o campo e salve.`
                            : 'Não consegui conferir se há colaboradores no time. Com este campo desligado, nenhum colaborador enxerga demanda alguma. Ligue o campo e salve.'}
                        </span>
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </Bloco>

      {/* Visões ------------------------------------------------------------ */}
      <Bloco
        titulo="Visões disponíveis"
        descricao="Todas leem o mesmo dado — mostrar menos não deixa o painel mais rápido, só mais simples de usar."
      >
        <ul className="space-y-2 mb-4">
          {VISOES.map((v) => {
            const ligada = config.visoes.includes(v)
            const unica = ligada && config.visoes.length === 1
            return (
              <li key={v}>
                <label
                  className={cn(
                    'flex items-start gap-2.5 bg-bg-950/60 border border-bg-700/40 rounded-lg p-2.5 transition-colors',
                    unica ? 'opacity-60' : 'cursor-pointer hover:border-bg-700',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={ligada}
                    disabled={unica}
                    onChange={(e) =>
                      alterar({
                        visoes: e.target.checked
                          ? ([...config.visoes, v] as Visao[])
                          : config.visoes.filter((x) => x !== v),
                      })
                    }
                    className="mt-0.5 w-3.5 h-3.5 rounded accent-violet-500 shrink-0"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-ink-200">
                      {visaoMeta[v].label}
                      {unica && <span className="text-[11px] text-ink-500"> · a última não sai</span>}
                    </span>
                    <span className="block text-[11px] text-ink-500">{visaoMeta[v].descricao}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <label htmlFor="visao-padrao" className="block text-[13px] font-medium text-ink-300 mb-1.5">
          Visão que abre por padrão
        </label>
        <select
          id="visao-padrao"
          value={config.visaoPadrao}
          onChange={(e) => alterar({ visaoPadrao: e.target.value as Visao })}
          className={cn(campo, 'w-full max-w-xs')}
        >
          {config.visoes.map((v) => (
            <option key={v} value={v}>
              {visaoMeta[v].label}
            </option>
          ))}
        </select>
      </Bloco>

      {/* Modelos ----------------------------------------------------------- */}
      <Bloco
        titulo="Modelos de projeto"
        descricao="Um modelo com etapas cria a demanda mãe e todas as subtarefas de uma vez, já datadas e encadeadas. É o que evita remontar o mesmo lançamento do zero toda vez."
      >
        <ul className="space-y-3">
          {config.templates.map((modelo, i) => (
            <li key={modelo.key} className="bg-bg-950/60 border border-bg-700/40 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <input
                  type="text"
                  value={modelo.nome}
                  onChange={(e) =>
                    alterar({ templates: trocar(config.templates, i, { nome: e.target.value }) })
                  }
                  aria-label={`Nome do modelo ${i + 1}`}
                  className={cn(campo, 'w-48 font-semibold')}
                />
                <select
                  value={modelo.prioridade ?? ''}
                  onChange={(e) =>
                    alterar({
                      templates: trocar(config.templates, i, {
                        prioridade: (e.target.value || null) as TemplateDemanda['prioridade'],
                      }),
                    })
                  }
                  aria-label={`Prioridade do modelo ${modelo.nome}`}
                  className={cn(campo, 'w-28')}
                >
                  <option value="">Prioridade…</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {prioridadeMeta[p].label}
                    </option>
                  ))}
                </select>
                <select
                  value={modelo.area ?? ''}
                  onChange={(e) =>
                    alterar({
                      templates: trocar(config.templates, i, { area: e.target.value || null }),
                    })
                  }
                  aria-label={`Área do modelo ${modelo.nome}`}
                  className={cn(campo, 'w-32')}
                >
                  <option value="">Área…</option>
                  {config.areas.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-ink-600 ml-auto num">
                  {modelo.etapas?.length ?? 0} subtarefas
                </span>
                <BotaoRemover
                  rotulo={`Remover o modelo ${modelo.nome}`}
                  bloqueio={null}
                  aoRemover={() =>
                    alterar({ templates: config.templates.filter((_, x) => x !== i) })
                  }
                />
              </div>

              <input
                type="text"
                value={modelo.descricaoModelo ?? ''}
                onChange={(e) =>
                  alterar({
                    templates: trocar(config.templates, i, { descricaoModelo: e.target.value }),
                  })
                }
                placeholder="Explicação curta que aparece na escolha do modelo"
                aria-label={`Descrição do modelo ${modelo.nome}`}
                className={cn(campo, 'w-full mb-2 text-[12px]')}
              />

              {!!modelo.etapas?.length && (
                <ul className="space-y-1.5 mb-2">
                  {modelo.etapas.map((et, j) => (
                    <li key={j} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={et.titulo}
                        onChange={(e) =>
                          alterar({
                            templates: trocar(config.templates, i, {
                              etapas: trocar(modelo.etapas ?? [], j, { titulo: e.target.value }),
                            }),
                          })
                        }
                        aria-label={`Subtarefa ${j + 1} do modelo ${modelo.nome}`}
                        className={cn(campo, 'flex-1 min-w-[180px] text-[12px]')}
                      />
                      <label className="flex items-center gap-1 text-[10px] text-ink-500">
                        dia
                        <input
                          type="number"
                          min={0}
                          value={et.inicioEmDias}
                          onChange={(e) =>
                            alterar({
                              templates: trocar(config.templates, i, {
                                etapas: trocar(modelo.etapas ?? [], j, {
                                  inicioEmDias: Number(e.target.value) || 0,
                                }),
                              }),
                            })
                          }
                          aria-label={`Dia de início da subtarefa ${et.titulo}`}
                          className={cn(campo, 'w-14 num text-[12px]')}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-ink-500">
                        dura
                        <input
                          type="number"
                          min={0}
                          value={et.duracaoEmDias}
                          onChange={(e) =>
                            alterar({
                              templates: trocar(config.templates, i, {
                                etapas: trocar(modelo.etapas ?? [], j, {
                                  duracaoEmDias: Number(e.target.value) || 0,
                                }),
                              }),
                            })
                          }
                          aria-label={`Duração da subtarefa ${et.titulo} em dias`}
                          className={cn(campo, 'w-14 num text-[12px]')}
                        />
                      </label>
                      <BotaoRemover
                        rotulo={`Remover a subtarefa ${et.titulo}`}
                        bloqueio={null}
                        aoRemover={() =>
                          alterar({
                            templates: trocar(config.templates, i, {
                              etapas: semEtapa(modelo.etapas ?? [], j),
                            }),
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-ink-600 mb-2">
                “dia” é quantos dias após o começo do projeto a subtarefa entra; “dura”, quantos dias
                ela leva. Duração <span className="num">0</span> vira um marco.
              </p>

              <BotaoAdicionar
                rotulo="Adicionar subtarefa"
                aoAdicionar={(nome) =>
                  alterar({
                    templates: trocar(config.templates, i, {
                      etapas: [
                        ...(modelo.etapas ?? []),
                        {
                          titulo: nome,
                          inicioEmDias: ultimoFim(modelo),
                          duracaoEmDias: 3,
                          dependeDoIndice: (modelo.etapas?.length ?? 1) - 1,
                        },
                      ],
                    }),
                  })
                }
              />
            </li>
          ))}
        </ul>

        <BotaoAdicionar
          rotulo="Adicionar modelo"
          aoAdicionar={(nome) =>
            alterar({
              templates: [
                ...config.templates,
                {
                  key: chaveUnica(nome, config.templates),
                  nome,
                  prioridade: 'media',
                  prazoEmDias: 14,
                  etapas: [],
                },
              ],
            })
          }
        />
      </Bloco>

      {/* Ações ------------------------------------------------------------- */}
      {erro && (
        <div
          role="alert"
          className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
        >
          {erro}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-bg-950/90 backdrop-blur-sm py-3 -mx-1 px-1 border-t border-bg-700/30">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
        >
          {salvando ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : salvo ? (
            <Check className="w-4 h-4" aria-hidden />
          ) : null}
          {salvando ? 'Salvando…' : salvo ? 'Salvo' : 'Salvar configuração'}
        </button>

        <button
          type="button"
          onClick={() => {
            setConfig(CONFIG_PADRAO)
            setSalvo(false)
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-900 border border-bg-700/50 text-ink-300 hover:text-ink-100 text-xs font-semibold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          Voltar ao padrão
        </button>

        <p className="text-[11px] text-ink-600">
          Voltar ao padrão só recarrega os valores aqui — nada muda até você salvar, e nenhuma
          demanda é apagada.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Peças da tela                                                               */
/* -------------------------------------------------------------------------- */

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
      <h3 className="text-sm font-bold text-ink-100">{titulo}</h3>
      <p className="text-[12px] text-ink-500 mt-0.5 mb-4">{descricao}</p>
      {children}
    </section>
  )
}

function SetasDeOrdem({
  indice,
  total,
  rotulo,
  aoMover,
}: {
  indice: number
  total: number
  rotulo: string
  aoMover: (destino: number) => void
}) {
  return (
    <div className="flex flex-col shrink-0">
      <button
        type="button"
        disabled={indice === 0}
        onClick={() => aoMover(indice - 1)}
        aria-label={`Mover ${rotulo} para cima`}
        className="p-0.5 rounded text-ink-500 hover:text-violet-300 disabled:opacity-25 transition-colors"
      >
        <ArrowUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        disabled={indice === total - 1}
        onClick={() => aoMover(indice + 1)}
        aria-label={`Mover ${rotulo} para baixo`}
        className="p-0.5 rounded text-ink-500 hover:text-violet-300 disabled:opacity-25 transition-colors"
      >
        <ArrowDown className="w-3 h-3" />
      </button>
    </div>
  )
}

function SeletorDeCor({
  valor,
  rotulo,
  aoEscolher,
}: {
  valor: CorChave
  rotulo: string
  aoEscolher: (c: CorChave) => void
}) {
  return (
    <select
      value={valor}
      onChange={(e) => aoEscolher(e.target.value as CorChave)}
      aria-label={rotulo}
      className={cn(campo, 'w-28', cor(valor).text)}
    >
      {CORES.map((c) => (
        <option key={c} value={c}>
          {PALETA[c].label}
        </option>
      ))}
    </select>
  )
}

function BotaoRemover({
  rotulo,
  bloqueio,
  aoRemover,
}: {
  rotulo: string
  /** Motivo pelo qual não dá pra remover agora — `null` libera. */
  bloqueio: string | null
  aoRemover: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoRemover}
      disabled={!!bloqueio}
      aria-label={rotulo}
      title={bloqueio ?? rotulo}
      className={cn(
        'p-1.5 rounded-md transition-colors shrink-0',
        bloqueio
          ? 'text-ink-700 cursor-not-allowed'
          : 'text-ink-500 hover:text-red-400 hover:bg-red-500/10',
      )}
    >
      {bloqueio ? <TriangleAlert className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}

function BotaoAdicionar({
  rotulo,
  aoAdicionar,
}: {
  rotulo: string
  aoAdicionar: (nome: string) => void
}) {
  const [nome, setNome] = useState('')
  return (
    <div className="flex gap-2 mt-3">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (nome.trim()) {
              aoAdicionar(nome.trim())
              setNome('')
            }
          }
        }}
        placeholder={rotulo}
        aria-label={rotulo}
        className={cn(campo, 'flex-1 max-w-xs')}
      />
      <button
        type="button"
        onClick={() => {
          if (!nome.trim()) return
          aoAdicionar(nome.trim())
          setNome('')
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 text-ink-300 text-xs font-semibold transition-colors"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
        Adicionar
      </button>
    </div>
  )
}

/** Lista de tipos ou áreas — mesma forma, mesma edição. */
function ListaRotulada({
  itens,
  uso,
  usoDesconhecido,
  usadosPorModelos,
  aoAlterar,
  nomeSingular,
}: {
  itens: (TipoConfig | AreaConfig)[]
  uso: Map<string, number>
  usoDesconhecido: boolean
  usadosPorModelos: Set<string>
  aoAlterar: (itens: (TipoConfig | AreaConfig)[]) => void
  nomeSingular: string
}) {
  return (
    <>
      <ul className="space-y-2">
        {itens.map((item, i) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center gap-2 bg-bg-950/60 border border-bg-700/40 rounded-lg p-2"
          >
            <input
              type="text"
              value={item.label}
              onChange={(e) => aoAlterar(trocar(itens, i, { label: e.target.value }))}
              aria-label={`Nome do ${nomeSingular} ${i + 1}`}
              className={cn(campo, 'w-40')}
            />
            <SeletorDeCor
              valor={item.cor}
              rotulo={`Cor de ${item.label}`}
              aoEscolher={(c) => aoAlterar(trocar(itens, i, { cor: c }))}
            />
            <span className="text-[11px] text-ink-600 num ml-auto">
              {usoDesconhecido ? '—' : contagem(uso.get(item.key) ?? 0, 'demanda')}
            </span>
            <BotaoRemover
              rotulo={`Remover ${item.label}`}
              bloqueio={
                usoDesconhecido
                  ? 'Ainda conferindo quantas demandas usam isto.'
                  : (uso.get(item.key) ?? 0) > 0
                    ? `Tem demanda usando este ${nomeSingular} — troque-as antes de remover.`
                    : usadosPorModelos.has(item.key)
                      ? `Um modelo de projeto usa este ${nomeSingular} — tire de lá antes de remover.`
                      : null
              }
              aoRemover={() => aoAlterar(itens.filter((_, x) => x !== i))}
            />
          </li>
        ))}
        {!itens.length && (
          <li className="text-[12px] text-ink-600">
            Nenhum {nomeSingular} — o campo some do formulário.
          </li>
        )}
      </ul>
      <BotaoAdicionar
        rotulo={`Adicionar ${nomeSingular}`}
        aoAdicionar={(nome) =>
          aoAlterar([...itens, { key: chaveUnica(nome, itens), label: nome, cor: 'cinza' }])
        }
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Utilidades de lista                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Chave nova que não colide com as já usadas na lista.
 *
 * A chave é o que fica gravado em cada demanda. Deixar duas iguais nascerem aqui
 * empurraria o desempate para `comChavesUnicas`, no salvamento — e lá o critério
 * é a POSIÇÃO, então quem acaba renumerada pode ser a coluna antiga, trocando a
 * identidade de algo que já tem demandas dentro.
 */
function chaveUnica(rotulo: string, existentes: { key: string }[]): string {
  const usadas = new Set(existentes.map((e) => e.key))
  const base = chaveDe(rotulo)
  if (!usadas.has(base)) return base
  let n = 2
  while (usadas.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/**
 * Remove a subtarefa `j` do modelo REINDEXANDO as dependências.
 *
 * `dependeDoIndice` aponta por posição, então tirar uma etapa do meio faz todas
 * as seguintes escorregarem — e a corrente passa a apontar para a tarefa errada,
 * em silêncio, em todo projeto criado depois.
 */
function semEtapa(etapas: EtapaModelo[], j: number): EtapaModelo[] {
  return etapas
    .filter((_, x) => x !== j)
    .map((e) => ({
      ...e,
      dependeDoIndice:
        e.dependeDoIndice == null || e.dependeDoIndice === j
          ? null
          : e.dependeDoIndice > j
            ? e.dependeDoIndice - 1
            : e.dependeDoIndice,
    }))
}

/** "1 demanda" / "3 demandas" — plural que não deixa o número parecer defeito. */
function contagem(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : singular + 's'}`
}

function trocar<T>(lista: T[], indice: number, mudanca: Partial<T>): T[] {
  return lista.map((item, i) => (i === indice ? { ...item, ...mudanca } : item))
}

function reordenar<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista
  const copia = [...lista]
  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item)
  return copia
}

/** Onde a próxima subtarefa do modelo começa: logo depois da última. */
function ultimoFim(modelo: TemplateDemanda): number {
  const etapas = modelo.etapas ?? []
  if (!etapas.length) return 0
  return Math.max(...etapas.map((e) => e.inicioEmDias + e.duracaoEmDias))
}

'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus, TriangleAlert, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import {
  carregarConfigContratos,
  chaveDeCampo,
  chaveDeModelo,
  salvarConfigContratos,
} from '@/lib/contratos/config'
import { VARIAVEIS_AUTOMATICAS, variaveisDe } from '@/lib/contratos/modelo'
import {
  FORMATOS,
  TIPOS_CONTRATO,
  formatoMeta,
  tipoContratoMeta,
  type CampoContrato,
  type ConfigContratos,
  type FormatoCampo,
  type ModeloContrato,
  type QuemPreenche,
  type TipoContrato,
} from '@/lib/contratos/tipos'
import { cn } from '@/lib/utils'

const campo =
  'bg-bg-950 border border-bg-700/50 rounded-lg px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'

const rotulo = 'block text-[11px] font-semibold text-ink-400 mb-1'

/**
 * Os modelos de contrato — o texto que o painel emite e os campos que cada lado
 * preenche.
 *
 * Só o ADMIN, e aqui isso pesa mais do que na configuração do quadro: quem
 * edita um modelo está escrevendo o texto de um contrato. A regra de
 * `configuracoes/{doc}` já era essa; o corte abaixo é só a tela respeitando.
 *
 * Editar um modelo **não** mexe em contrato nenhum já emitido — o texto e os
 * campos são copiados pra dentro do contrato na hora de gerar. É a mesma regra
 * dos modelos de projeto do quadro, e aqui ela é o que impede um contrato
 * assinado de mudar depois de assinado.
 */
export function ConfigContratosTab() {
  const { role } = useAuth()
  // O corte de papel vem ANTES do componente que lê — mesmo motivo do quadro:
  // quem não é admin não deve pagar a leitura pra receber um aviso.
  if (role !== 'admin') {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6">
        <h2 className="text-lg font-bold text-ink-100 mb-1">Modelos de contrato</h2>
        <p className="text-sm text-ink-400">
          Só o admin edita os modelos — é o texto do contrato que o painel emite. Fale com quem
          administra o painel.
        </p>
      </div>
    )
  }
  return <ConfigContratosAdmin />
}

function ConfigContratosAdmin() {
  const [config, setConfig] = useState<ConfigContratos | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    carregarConfigContratos()
      .then((c) => vivo && setConfig(c))
      .catch(() => vivo && setErro('Não consegui carregar os modelos.'))
    return () => {
      vivo = false
    }
  }, [])

  function alterar(modelos: ModeloContrato[]) {
    setConfig({ modelos })
    setSalvo(false)
  }

  function alterarModelo(key: string, mudanca: Partial<ModeloContrato>) {
    if (!config) return
    alterar(config.modelos.map((m) => (m.key === key ? { ...m, ...mudanca } : m)))
  }

  function adicionarModelo() {
    if (!config) return
    const nome = 'Novo modelo'
    let key = chaveDeModelo(nome)
    let n = 2
    while (config.modelos.some((m) => m.key === key)) key = `${chaveDeModelo(nome)}-${n++}`
    alterar([...config.modelos, { key, nome, tipo: 'agenciamento', texto: '', campos: [] }])
    setAberto(key)
  }

  function removerModelo(key: string, nome: string) {
    if (!config) return
    // Modelo não é coluna de quadro: apagar não deixa nada órfão, porque o
    // contrato já emitido carrega a própria cópia do texto. Mesmo assim, um
    // modelo apagado é texto escrito à mão que não volta.
    if (!window.confirm(`Apagar o modelo "${nome}"? Contratos já emitidos não mudam.`)) return
    alterar(config.modelos.filter((m) => m.key !== key))
  }

  async function salvar() {
    if (!config) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarConfigContratos(config)
      setSalvo(true)
    } catch (e) {
      // Distinguir a recusa da regra de uma falha qualquer: culpar as regras em
      // toda falha já mandou gente pedir permissão que ela tinha.
      const codigo = (e as { code?: string })?.code
      setErro(
        codigo === 'permission-denied'
          ? 'As regras recusaram a escrita. Só o admin salva os modelos.'
          : 'Não consegui salvar os modelos. Tente de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  if (!config) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex items-center gap-2 text-sm text-ink-400">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Carregando os modelos…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
        <h3 className="text-sm font-bold text-ink-100">Modelos de contrato</h3>
        <p className="text-[12px] text-ink-500 mt-0.5">
          O texto que o painel emite. Escreva o contrato normalmente e marque o que varia com{' '}
          <code className="text-violet-300">{'{{chave}}'}</code> — cada chave vira um campo que a
          equipe ou o artista preenche. Editar aqui não altera contrato já emitido.
        </p>

        <div className="mt-4 space-y-2">
          {config.modelos.map((m) => (
            <ModeloEditor
              key={m.key}
              modelo={m}
              aberto={aberto === m.key}
              onAlternar={() => setAberto(aberto === m.key ? null : m.key)}
              onAlterar={(mudanca) => alterarModelo(m.key, mudanca)}
              onRemover={() => removerModelo(m.key, m.nome)}
            />
          ))}

          {!config.modelos.length && (
            <p className="text-sm text-ink-500 py-4 text-center">
              Nenhum modelo. Sem modelo, o painel não emite contrato — só guarda a ficha com o link
              do Drive.
            </p>
          )}

          <button
            type="button"
            onClick={adicionarModelo}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors pt-1"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            Adicionar modelo
          </button>
        </div>
      </section>

      <VariaveisAutomaticas />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
        >
          {salvando ? 'Salvando…' : 'Salvar modelos'}
        </button>
        {salvo && <span className="text-[12px] text-emerald-400">Salvo.</span>}
        {erro && (
          <span className="text-[12px] text-red-400" role="alert">
            {erro}
          </span>
        )}
      </div>
    </div>
  )
}

function ModeloEditor({
  modelo,
  aberto,
  onAlternar,
  onAlterar,
  onRemover,
}: {
  modelo: ModeloContrato
  aberto: boolean
  onAlternar: () => void
  onAlterar: (mudanca: Partial<ModeloContrato>) => void
  onRemover: () => void
}) {
  const usadas = variaveisDe(modelo.texto)
  const automaticas = VARIAVEIS_AUTOMATICAS.map((v) => v.chave)
  const declaradas = modelo.campos.map((c) => c.chave)
  // Variável citada no texto que ninguém preenche vira "__________" no contrato
  // impresso — não quebra, mas sai um espaço em branco que ninguém pediu.
  const semCampo = usadas.filter((v) => !automaticas.includes(v) && !declaradas.includes(v))
  // Campo declarado que o texto não cita: alguém vai preencher à toa.
  const semUso = declaradas.filter((c) => !usadas.includes(c))

  function alterarCampo(indice: number, mudanca: Partial<CampoContrato>) {
    onAlterar({ campos: modelo.campos.map((c, i) => (i === indice ? { ...c, ...mudanca } : c)) })
  }

  /**
   * A chave segue o rótulo só enquanto ninguém a editou à mão.
   *
   * Depois disso ela é intocável aqui: a chave é o que está escrito no texto do
   * modelo (`{{cpf}}`) e o que ficou gravado nos contratos já emitidos.
   */
  function alterarRotulo(indice: number, novo: string) {
    const atual = modelo.campos[indice]
    const seguia = !atual.chave || atual.chave === chaveDeCampo(atual.rotulo)
    alterarCampo(indice, { rotulo: novo, ...(seguia ? { chave: chaveDeCampo(novo) } : {}) })
  }

  function adicionarCampo() {
    onAlterar({
      campos: [
        ...modelo.campos,
        {
          chave: '',
          rotulo: '',
          formato: 'texto',
          obrigatorio: true,
          quemPreenche: 'artista',
          ajuda: null,
        },
      ],
    })
  }

  return (
    <div className="border border-bg-700/40 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 bg-bg-950/50 px-3 py-2">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm font-semibold text-ink-200 hover:text-violet-300 transition-colors"
        >
          {aberto ? (
            <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">{modelo.nome || 'Sem nome'}</span>
          <span className="text-[10px] font-medium text-ink-500 shrink-0">
            {tipoContratoMeta[modelo.tipo].label} · {modelo.campos.length} campo
            {modelo.campos.length === 1 ? '' : 's'}
          </span>
        </button>
        {(semCampo.length > 0 || semUso.length > 0) && (
          <TriangleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Apagar o modelo ${modelo.nome || 'sem nome'}`}
          className="p-1 rounded text-ink-500 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {aberto && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={rotulo} htmlFor={`m-nome-${modelo.key}`}>
                Nome do modelo
              </label>
              <input
                id={`m-nome-${modelo.key}`}
                value={modelo.nome}
                onChange={(e) => onAlterar({ nome: e.target.value })}
                placeholder="Contrato de agenciamento"
                className={cn(campo, 'w-full')}
              />
            </div>
            <div>
              <label className={rotulo} htmlFor={`m-tipo-${modelo.key}`}>
                Tipo
              </label>
              <select
                id={`m-tipo-${modelo.key}`}
                value={modelo.tipo}
                onChange={(e) => onAlterar({ tipo: e.target.value as TipoContrato })}
                className={cn(campo, 'w-full')}
              >
                {TIPOS_CONTRATO.map((t) => (
                  <option key={t} value={t}>
                    {tipoContratoMeta[t].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={rotulo} htmlFor={`m-texto-${modelo.key}`}>
              Texto do contrato
            </label>
            <textarea
              id={`m-texto-${modelo.key}`}
              value={modelo.texto}
              onChange={(e) => onAlterar({ texto: e.target.value })}
              rows={16}
              spellCheck={false}
              placeholder="Cole aqui o contrato. Linha inteira em MAIÚSCULAS vira título."
              className={cn(campo, 'w-full font-mono text-[12px] leading-relaxed resize-y')}
            />
            <p className="text-[11px] text-ink-600 mt-1">
              Uma linha sozinha e toda em maiúsculas vira título. Parágrafos separados por linha em
              branco.
            </p>
          </div>

          {(semCampo.length > 0 || semUso.length > 0) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
              {semCampo.length > 0 && (
                <p className="text-[11px] text-amber-200/90">
                  No texto, sem campo que preencha:{' '}
                  <strong>{semCampo.map((v) => `{{${v}}}`).join(', ')}</strong> — vai sair em branco
                  no contrato.
                </p>
              )}
              {semUso.length > 0 && (
                <p className="text-[11px] text-amber-200/90">
                  Campo que o texto não usa: <strong>{semUso.join(', ')}</strong> — alguém vai
                  preencher à toa.
                </p>
              )}
            </div>
          )}

          <div>
            <p className={rotulo}>Campos</p>
            <div className="space-y-2">
              {modelo.campos.map((c, i) => (
                <div key={i} className="bg-bg-950/40 border border-bg-700/30 rounded-lg p-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={c.rotulo}
                      onChange={(e) => alterarRotulo(i, e.target.value)}
                      placeholder="Rótulo (ex.: Nome completo)"
                      aria-label="Rótulo do campo"
                      className={cn(campo, 'w-full')}
                    />
                    <input
                      value={c.chave}
                      onChange={(e) => alterarCampo(i, { chave: e.target.value })}
                      onBlur={(e) => alterarCampo(i, { chave: chaveDeCampo(e.target.value) })}
                      placeholder="chave"
                      aria-label="Chave usada no texto"
                      className={cn(campo, 'w-full font-mono text-[12px]')}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <select
                      value={c.formato}
                      onChange={(e) => alterarCampo(i, { formato: e.target.value as FormatoCampo })}
                      aria-label="Formato do campo"
                      className={cn(campo, 'w-full')}
                    >
                      {FORMATOS.map((f) => (
                        <option key={f} value={f}>
                          {formatoMeta[f].label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.quemPreenche}
                      onChange={(e) =>
                        alterarCampo(i, { quemPreenche: e.target.value as QuemPreenche })
                      }
                      aria-label="Quem preenche o campo"
                      className={cn(campo, 'w-full')}
                    >
                      <option value="artista">O artista, pelo link</option>
                      <option value="equipe">A equipe, ao emitir</option>
                    </select>
                  </div>
                  <input
                    value={c.ajuda ?? ''}
                    onChange={(e) => alterarCampo(i, { ajuda: e.target.value || null })}
                    placeholder="Ajuda sob o campo (opcional)"
                    aria-label="Texto de ajuda"
                    className={cn(campo, 'w-full mt-2')}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-[12px] text-ink-300">
                      <input
                        type="checkbox"
                        checked={c.obrigatorio}
                        onChange={(e) => alterarCampo(i, { obrigatorio: e.target.checked })}
                        className="accent-violet-500"
                      />
                      Obrigatório
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-violet-300">
                        {`{{${c.chave || 'chave'}}}`}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          onAlterar({ campos: modelo.campos.filter((_, j) => j !== i) })
                        }
                        aria-label={`Remover o campo ${c.rotulo || 'sem rótulo'}`}
                        className="p-1 rounded text-ink-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={adicionarCampo}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden />
                Adicionar campo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** O que o painel já preenche sozinho — pra ninguém criar campo repetido. */
function VariaveisAutomaticas() {
  return (
    <section className="bg-bg-900 border border-bg-700/40 rounded-xl p-5">
      <h3 className="text-sm font-bold text-ink-100">Variáveis automáticas</h3>
      <p className="text-[12px] text-ink-500 mt-0.5 mb-3">
        Estas o painel preenche sozinho. Use no texto sem criar campo pra elas.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {VARIAVEIS_AUTOMATICAS.map((v) => (
          <div key={v.chave} className="flex items-baseline gap-2 min-w-0">
            <code className="text-[11px] text-violet-300 shrink-0">{`{{${v.chave}}}`}</code>
            <span className="text-[11px] text-ink-500 truncate">{v.descricao}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

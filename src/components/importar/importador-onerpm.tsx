'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  Loader2,
  Lock,
  Music2,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ConfirmarAcaoDialog } from '@/components/configuracoes/confirmar-acao-dialog'
import { auth } from '@/lib/firebase'
import { enxugarLote } from '@/lib/onerpm/aggregate'
import { consumoLabel, formatarMoedas, formatarMoedasCompacto, periodoLabel } from '@/lib/onerpm/display'
import type { EntradaWorker, SaidaWorker } from '@/lib/onerpm/parse.worker'
import type { ArtistaImportado, MoneyByCurrency, OneRpmAggregate, OneRpmLote } from '@/lib/onerpm/types'
import { cn } from '@/lib/utils'

type Resumo = {
  label: string
  periodo: OneRpmAggregate['periodo']
  moedas: string[]
  totais: OneRpmAggregate['totais']
  artistas: ArtistaImportado[]
  pagoTerceirosPorMoeda: MoneyByCurrency
  naoAtribuido: { linhas: number; streams: number } | null
  avisos: string[]
}

type Recente = {
  id: string
  periodoKey: string
  arquivoNome: string
  tamanhoBytes: number
  label: string
  status: 'processado' | 'erro'
  artistas: number
  artistasCriados: number
  linhas: number
  streams: number
  netPorMoeda: MoneyByCurrency
  periodo: OneRpmAggregate['periodo']
  artistasDetalhes: ArtistaImportado[]
  pagoTerceirosPorMoeda: MoneyByCurrency
  naoAtribuido: { linhas: number; streams: number; netPorMoeda: MoneyByCurrency } | null
  avisos: string[]
  criadoEmISO: string | null
  criadoPorEmail: string
}

/** Soma vários mapas por moeda, sem cruzar moedas (US$ com US$, R$ com R$). */
function somarMoedas(mapas: MoneyByCurrency[]): MoneyByCurrency {
  const out: MoneyByCurrency = {}
  for (const m of mapas) for (const [moeda, v] of Object.entries(m)) out[moeda] = (out[moeda] ?? 0) + v
  return out
}

const temValor = (m: MoneyByCurrency) => Object.values(m).some((v) => Math.abs(v) >= 0.005)
/** Magnitude só pra dimensionar a barra (nunca exibida) — ver display.ts. */
const magnitude = (m: MoneyByCurrency) => Object.values(m).reduce((a, v) => a + Math.abs(v), 0)

/** O arquivo é lido no browser; o teto só evita travar a máquina da usuária. */
const TAMANHO_MAX = 50 * 1024 * 1024

type Etapa = 'lendo' | 'agregando' | 'salvando'
const rotuloEtapa: Record<Etapa, string> = {
  lendo: 'Lendo a planilha',
  agregando: 'Separando por artista',
  salvando: 'Salvando no banco',
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

const fmtTamanho = (bytes: number) => {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${bytes}B`
}

// `periodoLabel`/`consumoLabel` vêm de `display.ts` — o rótulo de um relatório é o
// mês de LANÇAMENTO ("abr/2026"), não a faixa de consumo. Rotular pelo consumo fazia
// o arquivo de abril aparecer como "2024-01 → 2026-03", que não diz nada a quem subiu
// um arquivo chamado "abril".

export function ImportadorOneRpm() {
  const { loading, pode } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const [etapa, setEtapa] = useState<Etapa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resumo | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [recentes, setRecentes] = useState<Recente[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<Recente | null>(null)

  const podeImportar = pode('importar')
  const enviando = etapa !== null

  const carregarRecentes = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch('/api/importar/onerpm', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.importacoes) setRecentes(data.importacoes)
    } catch {
      /* silencioso — a lista é secundária */
    }
  }, [])

  useEffect(() => {
    if (podeImportar) void carregarRecentes()
  }, [podeImportar, carregarRecentes])

  useEffect(() => () => workerRef.current?.terminate(), [])

  /** Lê o .xlsx fora da thread principal — são ~120k linhas e alguns segundos. */
  const parsearNoWorker = useCallback(
    (arquivo: ArrayBuffer) =>
      new Promise<OneRpmLote>((resolve, reject) => {
        workerRef.current?.terminate()
        const worker = new Worker(new URL('../../lib/onerpm/parse.worker.ts', import.meta.url))
        workerRef.current = worker

        worker.onmessage = (e: MessageEvent<SaidaWorker>) => {
          const msg = e.data
          if (!msg.ok) {
            worker.terminate()
            reject(new Error(msg.erro))
            return
          }
          if (msg.etapa === 'pronto') {
            worker.terminate()
            resolve(msg.lote)
            return
          }
          setEtapa(msg.etapa)
        }
        worker.onerror = () => {
          worker.terminate()
          reject(new Error('Falha ao processar a planilha no navegador.'))
        }

        const entrada: EntradaWorker = { arquivo }
        worker.postMessage(entrada, [arquivo]) // transferível: não copia os 15MB
      }),
    []
  )

  const enviar = useCallback(
    async (file: File) => {
      setErro(null)
      setResultado(null)
      setNomeArquivo(file.name)
      setEtapa('lendo')
      try {
        if (!/\.(xlsx|xls)$/i.test(file.name)) {
          throw new Error('Envie o arquivo .xlsx exportado da OneRPM.')
        }
        if (file.size === 0) throw new Error('O arquivo está vazio.')
        if (file.size > TAMANHO_MAX) throw new Error('Arquivo muito grande (máx. 50MB).')

        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

        const lote = await parsearNoWorker(await file.arrayBuffer())

        setEtapa('salvando')
        const res = await fetch('/api/importar/onerpm', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arquivoNome: file.name,
            tamanhoBytes: file.size,
            lote: enxugarLote(lote),
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? `A importação falhou (HTTP ${res.status}).`)
        setResultado(data.resumo as Resumo)
        void carregarRecentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro inesperado ao importar.')
      } finally {
        setEtapa(null)
      }
    },
    [carregarRecentes, parsearNoWorker]
  )

  const abrirSeletor = () => inputRef.current?.click()

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void enviar(file)
  }

  const excluirImportacao = useCallback(
    async (imp: Recente) => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch('/api/importar/onerpm', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: imp.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível excluir a importação.')
      setConfirmarExclusao(null)
      setAbertoId((atual) => (atual === imp.id ? null : atual))
      await carregarRecentes()
    },
    [carregarRecentes]
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  if (!podeImportar) {
    return (
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-8 flex flex-col items-center text-center">
        <Lock className="w-6 h-6 text-ink-600 mb-3" />
        <h3 className="font-semibold text-ink-100">Importação restrita ao financeiro</h3>
        <p className="text-sm text-ink-400 mt-1 max-w-md">
          Importar relatórios da OneRPM mexe com dados de receita — disponível apenas para
          administradores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void enviar(file)
          e.target.value = ''
        }}
      />

      {/* Fonte: relatório OneRPM (.xlsx) — único importador de receita hoje */}
      <button
        type="button"
        onClick={abrirSeletor}
        disabled={enviando}
        className="w-full text-left bg-gradient-to-br from-amber-500/10 to-bg-900 border border-amber-500/30 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-5 hover:border-amber-500/60 transition-colors disabled:opacity-60"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 grid place-items-center shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-ink-100">Relatório OneRPM (.xlsx)</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            A planilha de vendas do selo inteiro — streams e receita por faixa, loja e país.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500 mt-3">
            <li>✓ Separa a receita por artista</li>
            <li>✓ Agrupa lojas (Spotify, Apple, Meta…)</li>
            <li>✓ Bruto e líquido por moeda</li>
          </ul>
        </div>
        <span className="shrink-0 w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-bg-950 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors text-center">
          Selecionar arquivo
        </span>
      </button>

      {/* Dropzone */}
      <div
        onClick={enviando ? undefined : abrirSeletor}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors',
          enviando ? 'cursor-wait' : 'cursor-pointer',
          arrastando
            ? 'border-amber-500/60 bg-amber-500/5'
            : 'border-bg-700/60 bg-bg-900/30 hover:bg-bg-900/50'
        )}
      >
        {etapa ? (
          <>
            <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-ink-100">
              {rotuloEtapa[etapa]}
              <span className="text-ink-400">…</span>
            </h3>
            <p className="text-sm text-ink-400 mt-1 truncate">{nomeArquivo}</p>
            <p className="text-[11px] text-ink-500 mt-3">
              Planilhas grandes levam alguns segundos — pode deixar a aba aberta.
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-ink-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-ink-100">Arraste o .xlsx da OneRPM aqui</h3>
            <p className="text-sm text-ink-400 mt-1">ou clique pra escolher o arquivo</p>
            <p className="text-[11px] text-ink-500 mt-3 num">Máx. 50MB · .xlsx / .xls</p>
          </>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-300 text-sm">Não deu pra importar</div>
            <div className="text-sm text-red-200/80 mt-0.5">{erro}</div>
          </div>
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar">
            <X className="w-4 h-4 text-red-300/60 hover:text-red-300" />
          </button>
        </div>
      )}

      {/* Resultado */}
      {resultado && <ResultadoImportacao resumo={resultado} onFechar={() => setResultado(null)} />}

      {/* Recentes */}
      <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
          <h3 className="font-bold text-ink-100">Importações recentes</h3>
          <span className="text-[11px] text-ink-500 num">{recentes.length} no total</span>
        </div>
        {recentes.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">
            Nenhuma importação ainda. Suba o primeiro relatório da OneRPM acima.
          </div>
        ) : (
          <div className="divide-y divide-bg-700/30">
            {recentes.map((imp) => {
              const aberto = abertoId === imp.id
              const artistas = imp.artistasDetalhes ?? []
              const artistasVisiveis = artistas.slice(0, 12)
              return (
                <div key={imp.id} className="hover:bg-bg-800/20 transition-colors">
                  <div className="flex items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => setAbertoId((id) => (id === imp.id ? null : imp.id))}
                      aria-expanded={aberto}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-amber-500/15 text-amber-400">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-ink-100 truncate">{imp.arquivoNome}</span>
                          <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                            {imp.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            {periodoLabel(imp.periodo)}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-500 num mt-0.5">
                          {fmtInt(imp.artistas)} {imp.artistas === 1 ? 'artista' : 'artistas'}
                          {imp.artistasCriados > 0 && ` (${fmtInt(imp.artistasCriados)} novos)`} ·{' '}
                          {fmtTamanho(imp.tamanhoBytes)} · {fmtInt(imp.streams)} streams · {fmtInt(imp.linhas)} linhas
                        </div>
                      </div>
                    </button>

                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="num text-[13px] font-bold text-emerald-400">{formatarMoedasCompacto(imp.netPorMoeda)}</div>
                      <div className="text-[11px] text-ink-500 num">{formatarData(imp.criadoEmISO)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmarExclusao(imp)}
                      aria-label={`Excluir importação ${imp.arquivoNome}`}
                      className="w-8 h-8 grid place-items-center rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronDown className={cn('w-4 h-4 text-ink-500 transition-transform shrink-0', aberto && 'rotate-180')} />
                  </div>

                  {aberto && (
                    <div className="px-4 pb-4 pl-16 space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <MiniKpi label="Mês (lançamento)" valor={periodoLabel(imp.periodo)} />
                        <MiniKpi label="Consumo coberto" valor={consumoLabel(imp.periodo)} />
                        <MiniKpi label="Líquido" valor={formatarMoedasCompacto(imp.netPorMoeda)} destaque />
                        <MiniKpi label="Enviado por" valor={imp.criadoPorEmail || '—'} />
                      </div>

                      {imp.naoAtribuido && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[12px] text-red-200/90">
                          {fmtInt(imp.naoAtribuido.linhas)} linhas ({fmtInt(imp.naoAtribuido.streams)} streams) ficaram sem artista.
                        </div>
                      )}

                      {imp.avisos?.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[12px] text-amber-200/90 space-y-1">
                          {imp.avisos.map((aviso, i) => (
                            <div key={i}>{aviso}</div>
                          ))}
                        </div>
                      )}

                      <div>
                        <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-2">
                          Artistas nesta importação
                        </div>
                        {artistas.length ? (
                          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {artistasVisiveis.map((a) => (
                              <Link
                                key={a.slug}
                                href={`/artistas/${a.slug}`}
                                className="flex items-center justify-between gap-3 rounded-lg bg-bg-950/50 border border-bg-700/35 px-3 py-2 hover:border-violet-500/35 transition-colors"
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm text-ink-100 truncate">{a.nome}</span>
                                  <span className="block text-[11px] text-ink-500 num">
                                    {fmtInt(a.streams)} streams
                                  </span>
                                </span>
                                <span className="num text-[12px] text-emerald-400 shrink-0">
                                  {formatarMoedasCompacto(a.netPorMoeda)}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-ink-500">Detalhe por artista indisponível nesta importação antiga.</div>
                        )}
                        {artistas.length > artistasVisiveis.length && (
                          <div className="text-[12px] text-ink-500 mt-2">
                            + {fmtInt(artistas.length - artistasVisiveis.length)} artistas no arquivo.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmarExclusao && (
        <ConfirmarAcaoDialog
          titulo="Excluir importação OneRPM?"
          descricao={
            <>
              Isto remove <b>{confirmarExclusao.arquivoNome}</b> e restaura automaticamente a importação anterior dos artistas afetados,
              quando existir.
            </>
          }
          labelConfirmar="Excluir importação"
          onConfirmar={() => excluirImportacao(confirmarExclusao)}
          onFechar={() => setConfirmarExclusao(null)}
        />
      )}
    </div>
  )
}

function ResultadoImportacao({ resumo, onFechar }: { resumo: Resumo; onFechar: () => void }) {
  const [verTodos, setVerTodos] = useState(false)
  // Já vem ordenado por receita; a barra usa a magnitude (só p/ tamanho, não exibida).
  const visiveis = verTodos ? resumo.artistas : resumo.artistas.slice(0, 10)
  const maiorMag = Math.max(1, ...resumo.artistas.map((a) => magnitude(a.netPorMoeda)))
  const criados = resumo.artistas.filter((a) => a.criado)
  const repasseTotal = somarMoedas(resumo.artistas.map((a) => a.repassePorMoeda ?? {}))
  const pagoTerceiros = resumo.pagoTerceirosPorMoeda ?? {}

  return (
    <div className="bg-bg-900 border border-emerald-500/30 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-bg-700/30 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 grid place-items-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100 text-lg">{resumo.label || 'Relatório importado'}</span>
              <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                FONTE: ONERPM
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              meses {resumo.periodo.transactionMonths[0]} →{' '}
              {resumo.periodo.transactionMonths[resumo.periodo.transactionMonths.length - 1]} · lançado{' '}
              {formatarDataCurta(resumo.periodo.accountedFrom)}–{formatarDataCurta(resumo.periodo.accountedTo)}
            </div>
          </div>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="shrink-0">
          <X className="w-4 h-4 text-ink-500 hover:text-ink-300" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-bg-700/30">
        <Kpi
          icon={Users}
          label="Artistas"
          valor={fmtInt(resumo.artistas.length)}
          nota={criados.length ? `${criados.length} cadastrados agora` : undefined}
        />
        <Kpi icon={Music2} label="Streams" valor={fmtInt(resumo.totais.streams)} />
        <Kpi icon={DollarSign} label="Líquido (moeda original)" valor={formatarMoedas(resumo.totais.netPorMoeda)} destaque />
        <Kpi
          icon={DollarSign}
          label="Repasse ao selo"
          valor={temValor(repasseTotal) ? formatarMoedas(repasseTotal) : '—'}
          nota={temValor(repasseTotal) ? 'já dentro da receita' : undefined}
        />
      </div>

      {/* Divisão com o selo — o repasse já está DENTRO da receita gerada acima. */}
      {(temValor(repasseTotal) || temValor(pagoTerceiros)) && (
        <div className="border-b border-bg-700/30 px-5 py-4 space-y-2">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase">
            Divisão do dinheiro (aba “Shares In &amp; Out”)
          </div>
          {temValor(repasseTotal) && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-400">Repasse dos artistas à Imagine</span>
              <span className="num text-emerald-400">{formatarMoedas(repasseTotal)}</span>
            </div>
          )}
          {temValor(pagoTerceiros) && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-400">Pago pelo selo a terceiros</span>
              <span className="num text-amber-400/90">{formatarMoedas(pagoTerceiros)}</span>
            </div>
          )}
          <p className="text-[11px] text-ink-500 pt-1">
            O repasse já está dentro da receita de cada artista — é a fatia do selo, não uma receita extra.
          </p>
        </div>
      )}

      {/* Artistas criados agora — precisam de perfil configurado */}
      {criados.length > 0 && (
        <div className="border-b border-bg-700/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <UserPlus className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200/90">
            <span className="font-semibold">
              {criados.length} {criados.length === 1 ? 'artista foi cadastrado' : 'artistas foram cadastrados'} agora
            </span>{' '}
            porque {criados.length === 1 ? 'tinha' : 'tinham'} receita mas não {criados.length === 1 ? 'existia' : 'existiam'} no
            painel: {criados.map((a) => a.nome).join(', ')}. {criados.length === 1 ? 'Ele está' : 'Eles estão'} sem redes
            sociais — há um alerta em{' '}
            <Link href="/alertas" className="underline underline-offset-2 hover:text-amber-100">
              Alertas
            </Link>{' '}
            pedindo a configuração do perfil.
          </div>
        </div>
      )}

      {/* Receita por artista */}
      <div className="p-5">
        <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-3">
          Receita líquida por artista
        </div>
        <div className="space-y-2.5">
          {visiveis.map((a) => {
            const pct = Math.max(2, Math.round((magnitude(a.netPorMoeda) / maiorMag) * 100))
            return (
              <div key={a.slug} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink-100 truncate flex items-center gap-1.5">
                      {a.nome}
                      {a.criado && (
                        <span
                          className="text-[9px] tracking-wider font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/15 shrink-0"
                          title="Cadastro criado por esta importação — falta configurar o perfil"
                        >
                          NOVO
                        </span>
                      )}
                    </span>
                    <span className="num text-ink-300 shrink-0 text-[13px]">{formatarMoedas(a.netPorMoeda)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {temValor(a.repassePorMoeda ?? {}) && (
                      <span
                        className="text-[10px] text-amber-400/80 num shrink-0"
                        title="Fatia que vai pro selo (já inclusa na receita)"
                      >
                        −{formatarMoedasCompacto(a.repassePorMoeda)}
                      </span>
                    )}
                    <span className="text-[10px] text-ink-500 num w-20 text-right shrink-0">
                      {fmtInt(a.streams)} str
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {resumo.artistas.length > 10 && (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            className="mt-4 text-[12px] text-amber-400 hover:text-amber-300 font-semibold"
          >
            {verTodos ? 'Mostrar menos' : `Ver todos os ${resumo.artistas.length} artistas`}
          </button>
        )}
      </div>

      {/* Sobra não atribuída */}
      {resumo.naoAtribuido && (
        <div className="border-t border-bg-700/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-red-200/90">
            <span className="font-semibold">
              {fmtInt(resumo.naoAtribuido.linhas)} linhas ficaram fora dos perfis
            </span>{' '}
            ({fmtInt(resumo.naoAtribuido.streams)} streams). Nenhum artista foi identificado nelas — a
            receita não foi atribuída a ninguém.
          </div>
        </div>
      )}

      {/* Avisos */}
      {resumo.avisos.length > 0 && (
        <div className="border-t border-bg-700/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200/90 space-y-1">
            {resumo.avisos.map((a, i) => (
              <div key={i}>{a}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniKpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg bg-bg-950/50 border border-bg-700/35 px-3 py-2 min-w-0">
      <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase">{label}</div>
      <div className={cn('num text-[12px] truncate mt-0.5', destaque ? 'text-emerald-400 font-bold' : 'text-ink-200')}>
        {valor}
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  valor,
  nota,
  destaque,
}: {
  icon: typeof Users
  label: string
  valor: string
  nota?: string
  destaque?: boolean
}) {
  return (
    <div className="bg-bg-900 p-4">
      <div className="flex items-center gap-1.5 text-[10px] tracking-wider text-ink-400 font-semibold uppercase">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={cn('num font-bold mt-1', destaque ? 'text-emerald-400 text-lg' : 'text-ink-100 text-lg')}>
        {valor}
      </div>
      {nota && <div className="text-[10px] text-ink-600 mt-0.5">{nota}</div>}
    </div>
  )
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatarDataCurta(iso: string | null): string {
  if (!iso) return '—'
  // aceita "2026-05-29" ou ISO completo
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

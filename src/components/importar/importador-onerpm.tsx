'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  Globe,
  Loader2,
  Lock,
  Music2,
  Upload,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { PlataformaIcon } from '@/components/artistas/plataforma-icon'
import { paraBRL } from '@/lib/onerpm/display'
import type { MoneyByCurrency, PlataformaAgregada, FaixaAgregada, TerritorioAgregado } from '@/lib/onerpm/types'
import { cn } from '@/lib/utils'

type Resumo = {
  artistaNome: string
  artistaSlug: string
  label: string
  periodo: { transactionMonths: string[]; accountedFrom: string | null; accountedTo: string | null }
  moedas: string[]
  totais: { linhas: number; streams: number; grossPorMoeda: MoneyByCurrency; netPorMoeda: MoneyByCurrency }
  totalBRL: number
  porPlataforma: PlataformaAgregada[]
  porFaixa: FaixaAgregada[]
  porTerritorio: TerritorioAgregado[]
  avisos: string[]
}

type Recente = {
  id: string
  arquivoNome: string
  tamanhoBytes: number
  artistaNome: string
  artistaSlug: string
  status: 'processado' | 'erro'
  linhas: number
  streams: number
  totalBRL: number
  periodo: { transactionMonths: string[]; accountedFrom: string | null; accountedTo: string | null }
  criadoEmISO: string | null
  criadoPorEmail: string
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')
const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

const simboloMoeda = (m: string) => (m === 'BRL' ? 'R$' : m === 'USD' ? 'US$' : m === 'EUR' ? '€' : m + ' ')

const fmtMoedas = (m: MoneyByCurrency) => {
  const partes = Object.entries(m)
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${simboloMoeda(k)} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  return partes.length ? partes.join('  +  ') : '—'
}

const fmtTamanho = (bytes: number) => {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${bytes}B`
}

const corBar: Record<string, string> = {
  emerald: 'from-emerald-500 to-emerald-400',
  pink: 'from-pink-500 to-pink-400',
  red: 'from-red-500 to-red-400',
  violet: 'from-violet-500 to-violet-400',
  blue: 'from-blue-500 to-blue-400',
  amber: 'from-amber-500 to-amber-400',
  cyan: 'from-cyan-500 to-cyan-400',
  gray: 'from-bg-700 to-ink-500',
}

export function ImportadorOneRpm() {
  const { role, loading } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resumo | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [recentes, setRecentes] = useState<Recente[]>([])
  const [arrastando, setArrastando] = useState(false)

  const ehAdmin = role === 'admin'

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
    if (ehAdmin) void carregarRecentes()
  }, [ehAdmin, carregarRecentes])

  const enviar = useCallback(
    async (file: File) => {
      setErro(null)
      setResultado(null)
      setNomeArquivo(file.name)
      setEnviando(true)
      try {
        if (!/\.(xlsx|xls)$/i.test(file.name)) {
          throw new Error('Envie o arquivo .xlsx exportado da OneRPM.')
        }
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/importar/onerpm', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Não foi possível importar o arquivo.')
        setResultado(data.resumo as Resumo)
        void carregarRecentes()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro inesperado ao importar.')
      } finally {
        setEnviando(false)
      }
    },
    [carregarRecentes]
  )

  const abrirSeletor = () => inputRef.current?.click()

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void enviar(file)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  if (!ehAdmin) {
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

      {/* Cards de fonte */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={abrirSeletor}
          disabled={enviando}
          className="text-left bg-gradient-to-br from-amber-500/10 to-bg-900 border border-amber-500/30 rounded-xl p-6 flex flex-col hover:border-amber-500/60 transition-colors disabled:opacity-60"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 grid place-items-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 inline-block w-fit mb-3">
            RECOMENDADO
          </span>
          <h3 className="font-bold text-lg text-ink-100">Relatório OneRPM (.xlsx)</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            A planilha de vendas exportada da OneRPM — streams e receita por faixa, loja e país.
          </p>
          <ul className="text-[11px] text-ink-500 mt-3 space-y-1">
            <li>✓ Lê a aba “Sales” automaticamente</li>
            <li>✓ Agrupa lojas (Spotify, Apple, Meta…)</li>
            <li>✓ Bruto e líquido por moeda</li>
          </ul>
          <span className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-bg-950 font-semibold py-2 rounded-lg text-sm transition-colors text-center">
            Selecionar arquivo
          </span>
        </button>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex flex-col opacity-90">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 grid place-items-center mb-4">
            <Upload className="w-6 h-6 text-violet-400" />
          </div>
          <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/40 inline-block w-fit mb-3">
            EM BREVE
          </span>
          <h3 className="font-bold text-lg text-ink-100">Planilha customizada</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            Métricas fora das plataformas (rádio, eventos, fanclubes).
          </p>
          <ul className="text-[11px] text-ink-500 mt-3 space-y-1">
            <li>✓ .csv · .xlsx · .xls</li>
          </ul>
        </div>

        <div className="bg-bg-900 border border-bg-700/40 rounded-xl p-6 flex flex-col opacity-90">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 grid place-items-center mb-4">
            <Edit3 className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/40 inline-block w-fit mb-3">
            EM BREVE
          </span>
          <h3 className="font-bold text-lg text-ink-100">Entrada manual</h3>
          <p className="text-sm text-ink-400 mt-1 leading-snug">
            Adicione qualquer métrica de qualquer artista em segundos.
          </p>
        </div>
      </div>

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
          'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
          enviando ? 'cursor-wait' : 'cursor-pointer',
          arrastando
            ? 'border-amber-500/60 bg-amber-500/5'
            : 'border-bg-700/60 bg-bg-900/30 hover:bg-bg-900/50'
        )}
      >
        {enviando ? (
          <>
            <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-ink-100">Processando {nomeArquivo}…</h3>
            <p className="text-sm text-ink-400 mt-1">Lendo a planilha e agregando os dados</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-ink-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-ink-100">Arraste o .xlsx da OneRPM aqui</h3>
            <p className="text-sm text-ink-400 mt-1">ou clique pra escolher o arquivo</p>
            <p className="text-[11px] text-ink-500 mt-3 num">Máx. 25MB · .xlsx / .xls</p>
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
            {recentes.map((imp) => (
              <div key={imp.id} className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors">
                <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-amber-500/15 text-amber-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-ink-100 truncate">{imp.arquivoNome}</span>
                    <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      {imp.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 num mt-0.5">
                    {imp.artistaNome} · {fmtTamanho(imp.tamanhoBytes)} · {fmtInt(imp.streams)} streams ·{' '}
                    {fmtInt(imp.linhas)} linhas
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-sm font-bold text-emerald-400">{fmtBRL(imp.totalBRL)}</div>
                  <div className="text-[11px] text-ink-500 num">{formatarData(imp.criadoEmISO)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultadoImportacao({ resumo, onFechar }: { resumo: Resumo; onFechar: () => void }) {
  const totalNetBRL = resumo.porPlataforma.reduce((acc, p) => acc + paraBRL(p.netPorMoeda), 0)
  const plataformas = resumo.porPlataforma
    .map((p) => ({ ...p, brl: paraBRL(p.netPorMoeda) }))
    .sort((a, b) => b.brl - a.brl)

  return (
    <div className="bg-bg-900 border border-emerald-500/30 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-bg-700/30 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 grid place-items-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-ink-100 text-lg">{resumo.artistaNome}</span>
              <span className="text-[10px] tracking-wider font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                FONTE: ONERPM
              </span>
            </div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              {resumo.label} · meses {resumo.periodo.transactionMonths[0]} →{' '}
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
      <div className="grid grid-cols-4 gap-px bg-bg-700/30">
        <Kpi icon={Music2} label="Streams" valor={fmtInt(resumo.totais.streams)} />
        <Kpi
          icon={DollarSign}
          label="Líquido (original)"
          valor={fmtMoedas(resumo.totais.netPorMoeda)}
          destaque
        />
        <Kpi icon={DollarSign} label="Líquido (≈ R$)" valor={fmtBRL(resumo.totalBRL)} nota="câmbio placeholder" />
        <Kpi
          icon={Globe}
          label="Faixas · países"
          valor={`${resumo.porFaixa.length}+ · ${resumo.porTerritorio.length}+`}
        />
      </div>

      {/* Por plataforma */}
      <div className="p-5">
        <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-3">
          Receita líquida por plataforma
        </div>
        <div className="space-y-2.5">
          {plataformas.map((p) => {
            const pct = totalNetBRL > 0 ? Math.round((p.brl / totalNetBRL) * 100) : 0
            return (
              <div key={p.plataforma} className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg grid place-items-center shrink-0 text-white bg-gradient-to-br',
                    corBar[p.corKey] ?? corBar.gray
                  )}
                >
                  <span className="block w-4 h-4">
                    <PlataformaIcon tipo={p.iconeTipo} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink-100 truncate">{p.plataforma}</span>
                    <span className="num text-ink-300 shrink-0">{fmtMoedas(p.netPorMoeda)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r', corBar[p.corKey] ?? corBar.gray)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-500 num w-14 text-right shrink-0">
                      {fmtInt(p.streams)} str
                    </span>
                    <span className="text-[10px] text-ink-400 num w-8 text-right shrink-0">{pct}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top faixas + países */}
      <div className="grid grid-cols-2 gap-px bg-bg-700/30 border-t border-bg-700/30">
        <div className="bg-bg-900 p-5">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-3">
            Top faixas
          </div>
          <div className="space-y-2">
            {resumo.porFaixa.slice(0, 5).map((f) => (
              <div key={f.trackId || f.titulo} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-200 truncate">{f.titulo}</span>
                <span className="num text-ink-400 text-[12px] shrink-0">{fmtMoedas(f.netPorMoeda)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bg-900 p-5">
          <div className="text-[11px] tracking-wider text-ink-400 font-semibold uppercase mb-3">
            Top países
          </div>
          <div className="space-y-2">
            {resumo.porTerritorio.slice(0, 5).map((t) => (
              <div key={t.territorio} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-200">{t.territorio}</span>
                <span className="num text-ink-400 text-[12px] shrink-0">
                  {fmtInt(t.streams)} str · {fmtMoedas(t.netPorMoeda)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

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

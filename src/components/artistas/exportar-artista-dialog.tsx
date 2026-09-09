'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/components/auth/auth-provider'
import { getArtista, getProjeto, type ArtistaDoc, type ProjetoDoc } from '@/lib/artistas/client'
import {
  montarExportacao,
  montarPlanilha,
  nomeDoArquivo,
  type DadosExportacao,
} from '@/lib/artistas/exportar'
import { getMetricasSociaisCached, getStreamingDetalhe } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc, StreamingDetalheDoc } from '@/lib/metricas-sociais/types'
import { getDiagnostico, type DiagnosticoDoc } from '@/lib/diagnostico/client'
import { getTikTokDoArtista, type TikTokDoArtista } from '@/lib/fonogramas/client'
import { periodoLabel, receitaPorPlataformaDisplay } from '@/lib/onerpm/display'
import type { ReceitaArtistaHistoricoItem } from '@/lib/onerpm/types'
import { NOME_CURTO, TIPOS } from '@/lib/diagnostico/perguntas'
import { calcularAudiencia, calcularIge, montarComponentes, type ResultadoIge } from '@/lib/iaos/ige'
import { derivarHealthScores } from '@/lib/health/score'
import { cn } from '@/lib/utils'

/**
 * Exporta o perfil do artista, em duas saídas para dois usos.
 *
 * COPIAR põe o Markdown na área de transferência, para colar num assistente de
 * IA e pedir análise — foi o pedido original da cliente, e por isso é o botão
 * em destaque. BAIXAR gera a planilha, para quem vai abrir no Excel, filtrar e
 * fazer gráfico. As duas saem dos mesmos dados.
 *
 * A RECEITA é opcional e entra DESMARCADA. Estes dados podem ir para uma IA de
 * terceiro, e faturamento não deve viajar junto por descuido. Quem não tem a
 * permissão de receita não vê nem a opção — a fronteira do painel vale aqui
 * igual. Ela também só é buscada quando alguém marca.
 */
export function ExportarArtistaDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { pode } = useAuth()
  const podeReceita = pode('verReceita')

  const [incluirReceita, setIncluirReceita] = useState(false)
  const [receita, setReceita] = useState<DadosExportacao['receita']>(null)
  const [carregandoReceita, setCarregandoReceita] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [base, setBase] = useState<{
    artista: ArtistaDoc
    metricas: MetricasSociaisDoc | null
    projeto: ProjetoDoc | null
    detalhe: StreamingDetalheDoc | null
    ugc: TikTokDoArtista | null
    titulos: Record<string, string>
    diagnosticos: { tipo: (typeof TIPOS)[number]; nome: string; doc: DiagnosticoDoc | null }[]
  } | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [artista, metricas, projeto, detalhe, ...diags] = await Promise.all([
          getArtista(slug),
          getMetricasSociaisCached(slug).catch(() => null),
          getProjeto(slug).catch(() => null),
          getStreamingDetalhe(slug).catch(() => null),
          ...TIPOS.map((t) => getDiagnostico(slug, t).catch(() => null)),
        ])
        if (!artista) throw new Error('Artista não encontrado.')

        // Títulos das faixas que vão para a tabela — ISRC cru não diz nada à IA.
        const isrcs = (detalhe?.porFaixa ?? []).slice(0, 15).map((f) => f.isrc)
        let titulos: Record<string, string> = {}
        if (isrcs.length) {
          try {
            const token = await auth.currentUser?.getIdToken()
            if (token) {
              const res = await fetch('/api/faixas/titulos', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isrcs }),
              })
              if (res.ok) titulos = (await res.json())?.titulos ?? {}
            }
          } catch {
            // Sem título a tabela cai no ISRC — pior, mas não impede a exportação.
          }
        }

        const ugcSnap = await getTikTokDoArtista(slug).catch(() => null)

        if (!vivo) return
        setBase({
          artista,
          metricas,
          projeto,
          detalhe,
          ugc: ugcSnap,
          titulos,
          diagnosticos: TIPOS.map((t, i) => ({
            tipo: t,
            nome: NOME_CURTO[t],
            doc: (diags[i] as DiagnosticoDoc | null) ?? null,
          })),
        })
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível montar a exportação.')
      }
    })()
    return () => {
      vivo = false
    }
  }, [slug])

  /**
   * A receita só é buscada quando alguém marca a opção — e não junto do resto.
   * Ela mora numa coleção separada por permissão, e não faz sentido pagar essa
   * leitura em toda exportação quando o padrão é não incluir.
   */
  useEffect(() => {
    if (!incluirReceita || receita || carregandoReceita) return
    let vivo = true
    setCarregandoReceita(true)
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sessão expirada.')
        const res = await fetch(`/api/artistas/${encodeURIComponent(slug)}/receitas`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? 'Não foi possível ler a receita.')
        const historico = Array.isArray(data?.historico)
          ? (data.historico as ReceitaArtistaHistoricoItem[])
          : []
        // O consolidado (soma dos meses) é o retrato certo; o histórico é fallback.
        const doc = (data?.consolidado as ReceitaArtistaHistoricoItem | null) ?? historico[0] ?? null
        if (!vivo) return
        if (!doc) {
          setErro('Este artista não tem receita importada.')
          setIncluirReceita(false)
          return
        }
        const plataformas = doc.agregado
          ? receitaPorPlataformaDisplay(doc.agregado)
          : (doc.receitaPorPlataforma ?? [])
        setReceita({
          periodo: periodoLabel(doc.periodo),
          porPlataforma: plataformas.map((x) => ({
            nome: x.plataforma,
            streams: x.streams,
            porMoeda: x.receitaPorMoeda ?? {},
          })),
        })
      } catch (e) {
        if (!vivo) return
        setErro(e instanceof Error ? e.message : 'Não foi possível ler a receita.')
        setIncluirReceita(false)
      } finally {
        if (vivo) setCarregandoReceita(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [incluirReceita, receita, carregandoReceita, slug])

  /** Os dados reunidos, uma vez — o Markdown e a planilha saem dos MESMOS. */
  const dados = useMemo<DadosExportacao | null>(() => {
    if (!base) return null
    const m = base.metricas
    const audiencia = calcularAudiencia({
      instagram: m?.instagram?.seguidores ?? null,
      tiktok: m?.tiktok?.seguidores ?? null,
      youtube: m?.youtube && !m.youtube.inscritosOcultos ? (m.youtube.inscritos ?? null) : null,
    })
    const sc = base.projeto?.soundcharts ?? null
    let ige: ResultadoIge | null = null
    try {
      ige = calcularIge(
        montarComponentes({
          audiencia,
          mercadoAoVivo: base.projeto?.mercadoAoVivo ?? null,
          consumo: sc?.consumo ?? null,
          airplay: sc ? sc.airplay28d : null,
        }),
      )
    } catch {
      ige = null
    }

    let saude: DadosExportacao['saude'] = null
    if (m) {
      const [s] = derivarHealthScores(
        new Map([[slug, m]]),
        new Map([[slug, base.artista.nome]]),
      )
      if (s) {
        // `breakdown` usa a chave interna `streaming`, mas o contrato e a UI chamam
        // esse pilar de "Carreira & Negócio" — o export usa o nome que a equipe lê.
        const rotulos: Record<string, string> = {
          audiencia: 'Audiência',
          crescimento: 'Crescimento',
          engajamento: 'Engajamento',
          conteudo: 'Conteúdo',
          streaming: 'Carreira & Negócio',
        }
        saude = {
          score: s.score,
          pilares: Object.entries(s.breakdown)
            .filter((par): par is [string, number] => typeof par[1] === 'number')
            .map(([k, v]) => ({ rotulo: rotulos[k] ?? k, score: v })),
        }
      }
    }

    return {
      artista: base.artista,
      metricas: base.metricas,
      projeto: base.projeto,
      detalhe: base.detalhe,
      ugc: base.ugc,
      titulos: base.titulos,
      ige,
      saude,
      diagnosticos: base.diagnosticos,
      // Só entra com permissão E opção marcada — ver o docblock.
      receita: podeReceita && incluirReceita ? receita : null,
    }
  }, [base, slug, podeReceita, incluirReceita, receita])

  const markdown = useMemo(() => (dados ? montarExportacao(dados) : ''), [dados])

  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('O navegador bloqueou a cópia. Use "Baixar planilha".')
    }
  }, [markdown])

  /**
   * Baixa a planilha. O SheetJS entra por import dinâmico: ele já é dependência
   * do projeto (o importador de receita usa), mas é grande, e não deve pesar o
   * carregamento do perfil de quem nunca clica aqui.
   */
  const baixar = useCallback(async () => {
    if (!dados) return
    setBaixando(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      for (const aba of montarPlanilha(dados)) {
        const ws = XLSX.utils.aoa_to_sheet(aba.linhas)
        ws['!cols'] = aba.larguras.map((wch) => ({ wch }))
        // Formato por coluna: a célula guarda a fração, mas chega legível.
        for (const [col, formato] of Object.entries(aba.formatos ?? {})) {
          for (let linha = 1; linha < aba.linhas.length; linha++) {
            const ref = XLSX.utils.encode_cell({ r: linha, c: Number(col) })
            const celula = ws[ref]
            if (celula && typeof celula.v === 'number') celula.z = formato
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, aba.nome)
      }
      XLSX.writeFile(wb, nomeDoArquivo(slug, 'xlsx'))
    } catch {
      setErro('Não foi possível gerar a planilha.')
    } finally {
      setBaixando(false)
    }
  }, [dados, slug])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Exportar dados do artista"
    >
      <div className="bg-bg-900 border border-bg-700/50 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-700/40 flex items-center gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-ink-100">Exportar para IA</h2>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Copie e cole num assistente para pedir análise, relatório ou plano.
            </p>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-200 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {erro ? (
            <p className="text-sm text-rose-300">{erro}</p>
          ) : !base ? (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Reunindo os dados do artista…
            </div>
          ) : (
            <pre className="text-[11px] leading-relaxed text-ink-300 whitespace-pre-wrap font-mono">
              {markdown}
            </pre>
          )}
        </div>

        <div className="px-5 py-4 border-t border-bg-700/40 flex items-center gap-3 flex-wrap">
          {podeReceita && (
            <label className="flex items-center gap-2 text-[11px] text-ink-400 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirReceita}
                onChange={(e) => setIncluirReceita(e.target.checked)}
                className="accent-violet-500"
              />
              Incluir receita
              {carregandoReceita && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
            </label>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={baixar}
            disabled={!base || baixando}
            title="Planilha com abas de resumo, faixas e como ler os dados"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-bg-700/60 text-ink-300 hover:text-ink-100 hover:border-bg-600 disabled:opacity-50 transition-colors"
          >
            {baixando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden />
            )}
            {baixando ? 'Gerando…' : 'Baixar planilha'}
          </button>
          <button
            type="button"
            onClick={copiar}
            disabled={!base}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
              copiado
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30',
            )}
          >
            {copiado ? (
              <Check className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden />
            )}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

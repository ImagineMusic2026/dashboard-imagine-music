'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  getHistoricoHealth,
  getHistoricoInstagram,
  getHistoricoStreaming,
  getHistoricoTikTok,
  getHistoricoYouTube,
  getMetricasSociaisCached,
  getStreamingDetalhe,
} from '@/lib/metricas-sociais/client'
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
 * Presets do período, ancorados no que EXISTE: a série mais longa é a de
 * streaming, que começa em fevereiro de 2026; as redes só têm ~3 meses. Oferecer
 * "últimos 2 anos" devolveria quase nada e faria parecer que o artista não tinha
 * público — exatamente a leitura errada que o resto do documento evita.
 */
const PERIODOS = [
  { dias: 28, rotulo: '28 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 400, rotulo: 'Tudo' },
] as const

/**
 * Exporta o perfil do artista, em duas saídas para dois usos.
 *
 * COPIAR põe o Markdown na área de transferência, para colar num assistente de
 * IA e pedir análise — foi o pedido original da cliente, e por isso é o botão
 * em destaque. BAIXAR gera a planilha, para quem vai abrir no Excel, filtrar e
 * fazer gráfico. As duas saem dos mesmos dados.
 *
 * O PERÍODO afeta só a evolução dia a dia. O resto do documento é retrato de
 * janelas fixas que não dão para recortar, e cada bloco carimba a própria — um
 * seletor que mudasse o rótulo sem mudar o dado faria o documento afirmar um
 * período que ele não tem.
 *
 * A RECEITA é opcional e entra DESMARCADA. Estes dados podem ir para uma IA de
 * terceiro, e faturamento não deve viajar junto por descuido. Quem não tem a
 * permissão de receita não vê nem a opção — a fronteira do painel vale aqui
 * igual. Ela também só é buscada quando alguém marca.
 */

export function ExportarArtistaDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { pode } = useAuth()
  const podeReceita = pode('verReceita')

  const [dias, setDias] = useState<number>(28)
  const [serie, setSerie] = useState<DadosExportacao['serie']>(null)
  const [carregandoSerie, setCarregandoSerie] = useState(true)
  const [incluirReceita, setIncluirReceita] = useState(false)
  const [receita, setReceita] = useState<DadosExportacao['receita']>(null)
  const [carregandoReceita, setCarregandoReceita] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const buscandoReceita = useRef(false)
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
   * As séries diárias, recarregadas quando o período muda.
   *
   * São cinco subcoleções e uma leitura por dia de cada — 28 dias custam ~140
   * leituras do Firestore. Numa conta no plano gratuito isso não é desprezível,
   * e é por isso que o padrão é a janela CURTA: quem precisar do histórico
   * inteiro escolhe, em vez de todo mundo pagar por ele sem querer.
   */
  useEffect(() => {
    let vivo = true
    setCarregandoSerie(true)
    ;(async () => {
      const [ig, tt, yt, st, he] = await Promise.all([
        getHistoricoInstagram(slug, dias).catch(() => []),
        getHistoricoTikTok(slug, dias).catch(() => []),
        getHistoricoYouTube(slug, dias).catch(() => []),
        getHistoricoStreaming(slug, dias).catch(() => []),
        getHistoricoHealth(slug, dias).catch(() => []),
      ])
      if (!vivo) return

      // Une pelo dia: cada fonte tem a própria cobertura, e um dia que só tem
      // streaming continua sendo um dia com informação.
      const porDia = new Map<string, NonNullable<DadosExportacao['serie']>['pontos'][number]>()
      const garantir = (d: string) => {
        let p = porDia.get(d)
        if (!p) {
          p = { dia: d, instagram: null, tiktok: null, youtube: null, streams: null, health: null }
          porDia.set(d, p)
        }
        return p
      }
      for (const x of ig) garantir(x.dia).instagram = x.seguidores ?? null
      for (const x of tt) garantir(x.dia).tiktok = x.seguidores ?? null
      for (const x of yt) garantir(x.dia).youtube = x.inscritos ?? null
      for (const x of st) garantir(x.dia).streams = x.streams ?? null
      for (const x of he) garantir(x.dia).health = x.score ?? null

      const pontos = Array.from(porDia.values()).sort((a, b) => a.dia.localeCompare(b.dia))
      setSerie(
        pontos.length
          ? { dias, de: pontos[0].dia, ate: pontos[pontos.length - 1].dia, pontos }
          : null,
      )
      setCarregandoSerie(false)
    })()
    return () => {
      vivo = false
    }
  }, [slug, dias])

  /**
   * A receita só é buscada quando alguém marca a opção — e não junto do resto.
   * Ela mora numa coleção separada por permissão, e não faz sentido pagar essa
   * leitura em toda exportação quando o padrão é não incluir.
   */
  useEffect(() => {
    // A trava de "já estou buscando" é um ref, NÃO estado: como estado ela
    // entraria nas dependências deste efeito, e o `setCarregando(true)` logo
    // abaixo re-executaria o efeito, cuja limpeza mataria a busca em andamento —
    // o resultado voltava e era descartado, e o checkbox não fazia nada.
    if (!incluirReceita || receita || buscandoReceita.current) return
    buscandoReceita.current = true
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
        buscandoReceita.current = false
        if (vivo) setCarregandoReceita(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [incluirReceita, receita, slug])

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
      serie,
      // Só entra com permissão E opção marcada — ver o docblock.
      receita: podeReceita && incluirReceita ? receita : null,
    }
  }, [base, slug, podeReceita, incluirReceita, receita, serie])

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
   * Baixa a planilha. A montagem do CONTEÚDO é aqui (mesmos dados do Markdown);
   * a FORMATAÇÃO acontece no servidor, porque a biblioteca que grava cor, fonte
   * e imagem é grande demais para entrar no pacote do navegador.
   */
  const baixar = useCallback(async () => {
    if (!dados) return
    setBaixando(true)
    setErro(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch(`/api/artistas/${encodeURIComponent(slug)}/planilha`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ abas: montarPlanilha(dados), artista: dados.artista.nome }),
      })
      if (!res.ok) {
        const erroJson = await res.json().catch(() => null)
        throw new Error(erroJson?.error ?? 'Não foi possível gerar a planilha.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeDoArquivo(slug, 'xlsx')
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar a planilha.')
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
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] text-ink-500"
              title="Vale para a evolução dia a dia. Os outros blocos são retratos de janelas fixas e cada um mostra a sua."
            >
              Evolução:
            </span>
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                type="button"
                onClick={() => setDias(p.dias)}
                className={cn(
                  'text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors',
                  dias === p.dias
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                    : 'text-ink-400 border-bg-700/60 hover:text-ink-200 hover:border-bg-600',
                )}
              >
                {p.rotulo}
              </button>
            ))}
            {carregandoSerie && <Loader2 className="w-3 h-3 animate-spin text-ink-500" aria-hidden />}
          </div>
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

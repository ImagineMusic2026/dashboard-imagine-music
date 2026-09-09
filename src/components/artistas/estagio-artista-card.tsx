'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Compass, Info, Pencil, RefreshCw } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { auth } from '@/lib/firebase'
import { MercadoAoVivoDialog } from '@/components/artistas/mercado-ao-vivo-dialog'
import { ehStaff } from '@/lib/permissions'
import { getProjeto, type ProjetoDoc } from '@/lib/artistas/client'
import { invalidarCachesDeLeitura } from '@/lib/cache-leitura'
import { getMetricasSociaisCached } from '@/lib/metricas-sociais/client'
import type { MetricasSociaisDoc } from '@/lib/metricas-sociais/types'
import type { SoundchartsSnapshot } from '@/lib/soundcharts/tipos'
import {
  ESTAGIOS,
  calcularAudiencia,
  calcularIge,
  montarComponentes,
  nivelMercadoAoVivo,
  type Estagio,
  type ResultadoAudiencia,
  type ResultadoIge,
} from '@/lib/iaos/ige'
import { derivarHealthScores } from '@/lib/health/score'
import { extrairSinais } from '@/lib/health/sinais'
import { FAIXAS_V12, ROTULO_PILAR_V12, calcularHealthV12 } from '@/lib/health/v12'
import { cn } from '@/lib/utils'

/**
 * Bloco "Estágio" do perfil — o IGE da metodologia IAOS v1.2.
 *
 * Fica ao lado do Health Score de propósito e mede outra coisa: o IGE responde
 * "que escala de mercado o projeto alcançou" e o Health Score "quão saudável ele
 * está para essa escala". A v1.2 separou os dois justamente para não confundir
 * porte com desempenho.
 *
 * Consumo e airplay chegam pela Soundcharts, no botão daqui — a consulta é sob
 * demanda por pedido da cliente, não por rotina. Antes da primeira consulta os
 * dois saem ND (50% do índice), e o card NÃO esconde isso: mostra a cobertura,
 * marca o estágio como provisório e lista cada dimensão que falta. Um número
 * redondo aqui, sem a cobertura ao lado, viraria decisão errada — a simulação
 * sobre o roster mostrou artista indo de "Descoberta" a "Mainstream" só conforme
 * a leitura do ausente.
 *
 * ⚠️ SÓ STAFF: este componente vive dentro de `PerfilArtistaReal`, que o portal
 * do artista renderiza igual, e o mercado ao vivo é classificação da equipe.
 */
export function EstagioArtistaCard({ slug, nome }: { slug: string; nome: string }) {
  const { role, pode, loading } = useAuth()
  const staff = !loading && ehStaff(role)
  const podeDeclarar = staff && pode('editarArtistas')

  const [metricas, setMetricas] = useState<MetricasSociaisDoc | null>(null)
  const [projeto, setProjeto] = useState<ProjetoDoc | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [erroConsulta, setErroConsulta] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [m, p] = await Promise.all([
      getMetricasSociaisCached(slug).catch(() => null),
      getProjeto(slug).catch(() => null),
    ])
    setMetricas(m)
    setProjeto(p)
    setCarregado(true)
  }, [slug])

  useEffect(() => {
    if (!staff) return
    carregar()
  }, [staff, carregar])

  /**
   * Consulta a Soundcharts agora. É o "gerar diagnóstico" pedido pela Imagine:
   * a consulta acontece no clique, não numa rotina — cada uma gasta ~4 das 10
   * mil requisições mensais do time.
   */
  const consultarSoundcharts = useCallback(async () => {
    setConsultando(true)
    setErroConsulta(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const res = await fetch(`/api/artistas/${slug}/soundcharts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Não foi possível consultar a Soundcharts.')
      // A rota acabou de reescrever `projetos/{slug}`; sem derrubar o cache o
      // `carregar` devolveria o valor de antes e o botão pareceria não ter feito nada.
      invalidarCachesDeLeitura()
      await carregar()
    } catch (e) {
      setErroConsulta(e instanceof Error ? e.message : 'Não foi possível consultar a Soundcharts.')
    } finally {
      setConsultando(false)
    }
  }, [slug, carregar])

  if (!staff || !carregado) return null

  const yt = metricas?.youtube
  const audiencia = calcularAudiencia({
    instagram: metricas?.instagram?.seguidores ?? null,
    tiktok: metricas?.tiktok?.seguidores ?? null,
    youtube: yt && !yt.inscritosOcultos ? (yt.inscritos ?? null) : null,
  })
  const mercado = projeto?.mercadoAoVivo ?? null
  const sc = projeto?.soundcharts ?? null
  const resultado = calcularIge(
    montarComponentes({
      audiencia,
      mercadoAoVivo: mercado,
      consumo: sc?.consumo ?? null,
      airplay: sc ? sc.airplay28d : null,
    }),
  )

  // Sem nenhum componente medido não há estágio a mostrar — o card não inventa
  // um número. Some de vez só para quem não pode consultar: para quem pode, ele
  // fica como convite, senão o artista sem métrica nenhuma nunca teria por onde
  // começar (o botão vive dentro deste card).
  if (resultado.ige == null && !podeDeclarar) return null

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center gap-2 flex-wrap">
        <Compass className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
        <span className="font-bold text-ink-100">Estágio</span>
        <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/50">
          INTERNO
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-ink-600 num">{resultado.metodologia}</span>
      </div>

      <div className="p-5 space-y-5">
        {resultado.ige == null ? (
          <p className="text-sm text-ink-500">
            Nenhum componente medido ainda. Consulte a Soundcharts para trazer consumo e airplay, ou
            declare o mercado ao vivo.
          </p>
        ) : (
          <>
            <Cabecalho resultado={resultado} />
            <Cobertura resultado={resultado} />
            <Componentes
              resultado={resultado}
              audiencia={audiencia}
              mercado={mercado}
              podeDeclarar={podeDeclarar}
              onDeclarar={() => setDialogo(true)}
            />
          </>
        )}
        {podeDeclarar && (
          <Soundcharts
            dados={sc}
            consultando={consultando}
            erro={erroConsulta}
            onConsultar={consultarSoundcharts}
          />
        )}
        {resultado.estagio && metricas && (
          <PreviaHealthV12 doc={metricas} slug={slug} nome={nome} estagio={resultado.estagio} />
        )}
      </div>

      {dialogo && (
        <MercadoAoVivoDialog
          slug={slug}
          nome={nome}
          nivelAtual={mercado?.nivel ?? null}
          onClose={() => setDialogo(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  )
}

function Cabecalho({ resultado }: { resultado: ResultadoIge }) {
  const meta = resultado.estagio ? ESTAGIOS[resultado.estagio] : null
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div>
        <div className="text-[10px] tracking-wider text-ink-500 font-semibold uppercase">
          Índice Geral de Estágio
        </div>
        <div className="num text-4xl font-bold text-ink-100 leading-tight">
          {resultado.ige?.toFixed(1)}
          <span className="text-lg text-ink-600 font-semibold"> / 100</span>
        </div>
      </div>
      {meta && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-bold px-2.5 py-1 rounded-lg border', meta.cor)}>
              {meta.titulo}
            </span>
            {resultado.provisorio && (
              <span
                className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30"
                title="A metodologia manda marcar o estágio como provisório enquanto a cobertura não fecha em 100%."
              >
                provisório
              </span>
            )}
          </div>
          <p className="text-[12px] text-ink-400 mt-1.5 leading-relaxed">{meta.leitura}</p>
        </div>
      )}
    </div>
  )
}

function Cobertura({ resultado }: { resultado: ResultadoIge }) {
  const pct = Math.round(resultado.cobertura * 100)
  const faltando = resultado.componentes.filter((c) => c.score == null)
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span className="text-ink-400 font-semibold">Cobertura da metodologia</span>
        <span className={cn('num font-bold', pct === 100 ? 'text-emerald-300' : 'text-amber-300')}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-bg-800 overflow-hidden" aria-hidden>
        <div
          className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500/70' : 'bg-amber-500/70')}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      {faltando.length > 0 && (
        <div className="flex items-start gap-2 mt-2 text-[11px] text-ink-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          <p>
            O índice está calculado só sobre o que existe hoje. Falta{' '}
            {listar(faltando.map((c) => c.rotulo.toLowerCase()))} —{' '}
            {Math.round(faltando.reduce((s, c) => s + c.peso, 0) * 100)}% do peso total.
          </p>
        </div>
      )}
    </div>
  )
}

function Componentes({
  resultado,
  audiencia,
  mercado,
  podeDeclarar,
  onDeclarar,
}: {
  resultado: ResultadoIge
  audiencia: ResultadoAudiencia | null
  mercado: { nivel: number; declaradoEm: string; declaradoPorEmail?: string | null } | null
  podeDeclarar: boolean
  onDeclarar: () => void
}) {
  return (
    <div className="space-y-2">
      {resultado.componentes.map((c) => {
        const ausente = c.score == null
        return (
          <div
            key={c.chave}
            className={cn(
              'rounded-lg border px-4 py-3',
              ausente ? 'bg-bg-950/50 border-bg-700/30' : 'bg-bg-950 border-bg-700/40',
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-semibold', ausente ? 'text-ink-500' : 'text-ink-100')}>
                {c.rotulo}
              </span>
              <span className="num text-[10px] text-ink-600 bg-bg-800 px-1.5 py-0.5 rounded">
                {Math.round(c.peso * 100)}%
              </span>
              <div className="flex-1" />
              {ausente ? (
                <span className="text-[11px] font-bold text-ink-600 tracking-wider">ND</span>
              ) : (
                <span className="num text-sm font-bold text-ink-100">{c.score}</span>
              )}
            </div>

            <p className="text-[11px] text-ink-500 mt-1">{c.origem}</p>

            {c.chave === 'audiencia' && audiencia && (
              <DetalheAudiencia a={audiencia} />
            )}

            {c.chave === 'mercadoAoVivo' && (
              <DetalheMercado mercado={mercado} podeDeclarar={podeDeclarar} onDeclarar={onDeclarar} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DetalheAudiencia({ a }: { a: ResultadoAudiencia }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400 num">
      <span title="Instagram + TikTok + YouTube, só as redes medidas">
        bruta {a.bruta.toLocaleString('pt-BR')}
      </span>
      {a.fatorAplicado ? (
        <>
          <span title="Participação da maior rede na audiência bruta">
            maior rede {Math.round((a.participacaoMaior ?? 0) * 100)}%
          </span>
          <span title="Fator de equilíbrio da tabela oficial">fator {a.fator.toFixed(2)}</span>
          <span className="text-ink-300">ajustada {a.ajustada.toLocaleString('pt-BR')}</span>
        </>
      ) : (
        // Ver a nota de desvio em `calcularAudiencia`: com uma rede medida não há
        // como distinguir concentração real de buraco de coleta.
        <span className="text-amber-300/80" title="O fator de equilíbrio precisa de pelo menos duas redes medidas para significar alguma coisa. Conectar Instagram e TikTok deste artista fecha a conta.">
          fator não aplicado — só 1 rede medida
        </span>
      )}
    </div>
  )
}

function DetalheMercado({
  mercado,
  podeDeclarar,
  onDeclarar,
}: {
  mercado: { nivel: number; declaradoEm: string; declaradoPorEmail?: string | null } | null
  podeDeclarar: boolean
  onDeclarar: () => void
}) {
  const nivel = mercado ? nivelMercadoAoVivo(mercado.nivel) : null
  return (
    <div className="mt-2 flex items-start gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        {nivel ? (
          <>
            <div className="text-[12px] text-ink-200 font-semibold">{nivel.titulo}</div>
            <div className="text-[11px] text-ink-600 mt-0.5">
              declarado em {dataCurta(mercado!.declaradoEm)}
              {mercado!.declaradoPorEmail ? ` por ${mercado!.declaradoPorEmail}` : ''}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-ink-500">
            {podeDeclarar
              ? 'A equipe ainda não classificou o mercado ao vivo deste artista.'
              : 'Ainda não classificado. Quem edita artistas pode declarar.'}
          </div>
        )}
      </div>
      {podeDeclarar && (
        <button
          type="button"
          onClick={onDeclarar}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 border border-bg-700/50 text-ink-200 hover:text-ink-100 text-[11px] font-semibold transition-colors"
        >
          <Pencil className="w-3 h-3" aria-hidden />
          {nivel ? 'Alterar' : 'Declarar'}
        </button>
      )}
    </div>
  )
}

/**
 * Prévia do Health Score na régua v1.2 — quatro pilares, faixa e peso pelo
 * estágio apurado acima.
 *
 * Fica AQUI, e não no card de Health Score, de propósito: o número oficial que a
 * equipe usa todo dia continua sendo o outro, e trocá-lo agora colocaria um
 * degrau no histórico de 74 dias por causa de um estágio ainda provisório. Aqui
 * a comparação fica visível para a Imagine decidir, sem mexer no que já roda.
 */
function PreviaHealthV12({
  doc,
  slug,
  nome,
  estagio,
}: {
  doc: MetricasSociaisDoc
  slug: string
  nome: string
  estagio: Estagio
}) {
  const [aberto, setAberto] = useState(false)
  const oficial = derivarHealthScores(new Map([[slug, doc]]), new Map([[slug, nome]]))[0] ?? null
  const previa = calcularHealthV12(extrairSinais(doc), estagio)
  if (!previa) return null

  const meta = FAIXAS_V12[previa.faixa]
  const delta = oficial ? previa.score - oficial.score : null

  return (
    <div className="rounded-lg border border-bg-700/40 bg-bg-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2 flex-wrap px-4 py-3 hover:bg-bg-800/30 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-ink-100">Health Score na régua v1.2</span>
        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
          prévia
        </span>
        <div className="flex-1" />
        <span className="num text-lg font-bold text-ink-100">{previa.score}</span>
        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded border', meta.cor)}>
          {meta.titulo}
        </span>
        {delta != null && delta !== 0 && (
          <span
            className={cn(
              'num text-[11px] font-semibold px-1.5 py-0.5 rounded',
              delta > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
            )}
            title={`Régua atual: ${oficial?.score}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
        <ChevronDown
          className={cn('w-4 h-4 text-ink-500 transition-transform', aberto && 'rotate-180')}
          aria-hidden
        />
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3 border-t border-bg-700/30 pt-3">
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Quatro pilares (a audiência saiu — virou os 35% do índice acima), com faixa esperada e
            peso definidos pelo estágio <strong className="text-ink-300">{ESTAGIOS[estagio].titulo}</strong>. O
            número oficial do painel continua sendo {oficial ? oficial.score : 'o outro'} — esta régua
            só entra no lugar dele quando a Imagine homologar as faixas.
          </p>

          <div className="space-y-1.5">
            {(Object.keys(previa.pesos) as (keyof typeof previa.pesos)[]).map((k) => {
              const v = previa.breakdown[k]
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-400 w-24 shrink-0">
                    {ROTULO_PILAR_V12[k]}
                    <span className="num text-ink-600"> · {Math.round(previa.pesos[k] * 100)}%</span>
                  </span>
                  <span className="flex-1 h-1.5 rounded-full bg-bg-800 overflow-hidden" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-violet-500/70"
                      style={{ width: `${v ?? 0}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      'num text-[11px] font-semibold w-8 text-right shrink-0',
                      v == null ? 'text-ink-600' : 'text-ink-200',
                    )}
                  >
                    {v ?? 'ND'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** "a", "a e b", "a, b e c" — três dimensões ausentes é o caso comum hoje. */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

/**
 * Consulta sob demanda à Soundcharts — o "gerar diagnóstico" que a Imagine
 * pediu. Mostra SEMPRE a data da consulta: sem ela, um número de três meses
 * atrás passaria por atual, que é o erro que o carimbo existe para evitar.
 */
function Soundcharts({
  dados,
  consultando,
  erro,
  onConsultar,
}: {
  dados: SoundchartsSnapshot | null
  consultando: boolean
  erro: string | null
  onConsultar: () => void
}) {
  const num = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('pt-BR')

  return (
    <div className="rounded-lg border border-bg-700/40 bg-bg-950/40 p-3.5">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[11px] font-semibold text-ink-400">Soundcharts</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onConsultar}
          disabled={consultando}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', consultando && 'animate-spin')} aria-hidden />
          {consultando ? 'Consultando…' : dados ? 'Consultar de novo' : 'Consultar agora'}
        </button>
      </div>

      {erro && <p className="text-[11px] text-rose-300 mb-2">{erro}</p>}

      {!dados ? (
        <p className="text-[11px] text-ink-500">
          Consumo e airplay saem daqui. A consulta só acontece quando você pede.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <dt className="text-ink-500">Ouvintes mensais</dt>
            <dd className="num text-ink-200 text-right">{num(dados.ouvintesSpotify)}</dd>
            <dt className="text-ink-500">Views YouTube/28d</dt>
            <dd className="num text-ink-200 text-right">{num(dados.youtubeViews)}</dd>
            <dt className="text-ink-500">Airplay/28d</dt>
            <dd className="num text-ink-200 text-right">
              {num(dados.airplay28d)}
              {dados.airplayEmissoras28d > 0 && (
                <span className="text-ink-600"> · {dados.airplayEmissoras28d} emissoras</span>
              )}
            </dd>
            <dt className="text-ink-500">Airplay/12 meses</dt>
            <dd className="num text-ink-200 text-right">{num(dados.airplay365d)}</dd>
          </dl>

          {/* Airplay de 28 dias zerado com 12 meses positivo não é ausência de
              rádio: é a janela curta não pegando. Dizer isso evita a leitura errada. */}
          {dados.airplay28d === 0 && dados.airplay365d > 0 && (
            <p className="text-[11px] text-ink-500 mt-2">
              Sem execução nos últimos 28 dias, mas {num(dados.airplay365d)} no ano — a janela da
              metodologia é curta para o volume deste roster.
            </p>
          )}

          {dados.resolvidoPor === 'nome' && (
            <div className="flex items-start gap-2 mt-2 text-[11px] text-amber-300/90">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
              <p>
                Artista encontrado por nome
                {dados.resultadosDaBusca && dados.resultadosDaBusca > 1
                  ? `, entre ${dados.resultadosDaBusca.toLocaleString('pt-BR')} resultados`
                  : ''}
                . Pode ser homônimo — cadastrar o Spotify do artista torna a consulta exata.
              </p>
            </div>
          )}

          <p className="text-[10px] text-ink-600 mt-2">
            Consultado em {dataCurta(dados.consultadoEm)}
            {dados.careerStage ? ` · estágio global: ${dados.careerStage}` : ''}
          </p>
        </>
      )}
    </div>
  )
}

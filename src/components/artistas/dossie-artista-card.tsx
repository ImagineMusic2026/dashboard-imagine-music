'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  Loader2,
  Megaphone,
  Pencil,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { DossieDialog } from '@/components/artistas/dossie-dialog'
import {
  getArtista,
  getPatrimonio,
  getProjeto,
  type ArtistaDoc,
  type ProjetoDoc,
} from '@/lib/artistas/client'
import {
  CAMPOS_EXPANSAO,
  coberturaExpansao,
  plataformaMidiaMeta,
  statusDaEvidencia,
  statusMeta,
  statusCatalogoMeta,
  temPatrimonio,
  type Evidencia,
  type Patrimonio,
} from '@/lib/artistas/dossie'
import { cn } from '@/lib/utils'

/**
 * Bloco "Alavancas estratégicas" do perfil — o dossiê do documento
 * "Cadastro-base do projeto/artista" (IAOS).
 *
 * ⚠️ SÓ EQUIPE. Este componente vive dentro de `PerfilArtistaReal`, que o portal
 * do artista (/meu-perfil) renderiza igualzinho — então ele se autoprotege pela
 * capacidade `editarArtistas`, que o papel `artista` não tem. A barreira de
 * verdade é a regra do Firestore sobre `projetos/{slug}`, que o artista não lê.
 *
 * O inventário de patrimônio tem uma segunda porta, `contratos` (admin por
 * padrão): ele traz titularidade e licenciamento, a mesma natureza dos
 * contratos. Quem tem `editarArtistas` mas não `contratos` vê o dossiê sem o
 * inventário.
 */
export function DossieArtistaCard({ slug }: { slug: string }) {
  const { pode, loading } = useAuth()
  const podeVer = !loading && pode('editarArtistas')
  const podePatrimonio = !loading && pode('contratos')

  const [artista, setArtista] = useState<ArtistaDoc | null>(null)
  const [projeto, setProjeto] = useState<ProjetoDoc | null>(null)
  const [patrimonio, setPatrimonio] = useState<Patrimonio | null>(null)
  const [carregando, setCarregando] = useState(true)
  // Separado de "carregou vazio": com falha de leitura o formulário abriria em
  // branco, e salvar apagaria o que estava gravado. Ver o `disabled` do Editar.
  const [falhou, setFalhou] = useState(false)
  const [aberto, setAberto] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // As três leituras são cacheadas por slug e o perfil já fez as duas
      // primeiras para outros cards. A do inventário só acontece para quem tem
      // `contratos` — quem não tem nem paga a leitura nem recebe o dado.
      const [a, p, pat] = await Promise.all([
        getArtista(slug),
        getProjeto(slug),
        podePatrimonio ? getPatrimonio(slug).catch(() => null) : Promise.resolve(null),
      ])
      setArtista(a)
      setProjeto(p)
      setPatrimonio(pat)
      setFalhou(false)
    } catch {
      // Sem permissão / offline: o card some em vez de gritar no perfil.
      setProjeto(null)
      setFalhou(true)
    } finally {
      setCarregando(false)
    }
  }, [slug, podePatrimonio])

  useEffect(() => {
    if (podeVer) carregar()
  }, [podeVer, carregar])

  if (!podeVer) return null

  const cobertura = coberturaExpansao(projeto?.expansao)
  const equipe = projeto?.equipe ?? []
  const midia = projeto?.digital?.midiaPaga ?? null
  const mostraPatrimonio = podePatrimonio && temPatrimonio(patrimonio)
  // Editar só depois de um retrato confiável: o formulário nasce do que foi
  // lido, então abri-lo antes (ou depois de uma falha) mostraria campos vazios
  // de dados que EXISTEM — e salvar gravaria esse vazio por cima.
  const podeEditar = !carregando && !falhou

  return (
    <section className="bg-bg-900 border border-bg-700/40 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-100">
            <Sparkles className="w-4 h-4 text-violet-400" aria-hidden />
            Alavancas estratégicas
          </h2>
          <p className="text-[12px] text-ink-500 mt-0.5">
            As evidências que o IAOS pede — mantidas pela equipe ao longo do tempo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          disabled={!podeEditar}
          aria-busy={carregando}
          title={falhou ? 'Não consegui carregar o dossiê — recarregue a página.' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-800 hover:bg-bg-700 disabled:opacity-40 disabled:cursor-not-allowed text-ink-200 text-xs font-semibold transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden />
          Editar
        </button>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-ink-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…
        </p>
      ) : falhou ? (
        <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5">
          Não consegui carregar o dossiê. Recarregue a página — editar agora
          gravaria campos em branco por cima do que já existe.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Cadastro-base ------------------------------------------------- */}
          <Bloco icone={FileText} titulo="Cadastro-base">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Campo rotulo="Entrada no IAOS" valor={dataBr(artista?.entradaIaos)} />
              <Campo
                rotulo="Soundcharts"
                valor={artista?.soundchartsId ?? null}
                vazio="Sem assinatura"
              />
              <CampoLink rotulo="ImagineBio" url={artista?.imagineBio ?? null} />
              <CampoLink rotulo="ImagineUp" url={artista?.imagineUp ?? null} vazio="App em construção" />
            </dl>
          </Bloco>

          {/* Equipe -------------------------------------------------------- */}
          <Bloco icone={Users} titulo="Equipe responsável">
            {equipe.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {equipe.map((m) => (
                  <li
                    key={m.uid}
                    className="flex items-center gap-1.5 text-[12px] text-ink-200 bg-bg-800 border border-bg-700/50 rounded-lg px-2 py-1"
                  >
                    <span
                      className="w-4 h-4 rounded-full bg-bg-700 grid place-items-center text-[8px] font-bold text-ink-300"
                      aria-hidden
                    >
                      {iniciais(m.nome)}
                    </span>
                    {m.nome}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-600 italic">Ninguém atribuído ainda.</p>
            )}
          </Bloco>

          {/* Expansão de Mercado -------------------------------------------- */}
          <Bloco
            icone={Megaphone}
            titulo="Expansão de mercado"
            resumo={`${cobertura.disponiveis}/${cobertura.total} disponíveis${
              cobertura.desatualizadas ? ` · ${cobertura.desatualizadas} a revisar` : ''
            }`}
          >
            <ul className="space-y-1.5">
              {CAMPOS_EXPANSAO.map((c) => (
                <LinhaEvidencia
                  key={c.chave}
                  rotulo={c.label}
                  evidencia={projeto?.expansao?.[c.chave] ?? null}
                />
              ))}
            </ul>
          </Bloco>

          {/* Crescimento digital -------------------------------------------- */}
          <Bloco icone={Link2} titulo="Crescimento digital">
            {midia ? (
              <div className="text-[12px] space-y-1">
                <LinhaEvidencia rotulo="Painel de mídia paga" evidencia={midia} />
                <p className="text-ink-500 pl-0.5">
                  {plataformaMidiaMeta[midia.plataforma]}
                  {midia.periodo ? ` · ${midia.periodo}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-ink-600 italic">
                Sem painel de mídia paga registrado.
              </p>
            )}
            {/* As métricas de plataforma (Spotify, YouTube, TikTok, airplay) NÃO
                entram aqui: são séries com histórico e vivem nos cards de
                métricas do perfil. Aqui fica só o que é link mantido à mão. */}
          </Bloco>

          {/* Patrimônio ------------------------------------------------------ */}
          {podePatrimonio && (
            <Bloco icone={Landmark} titulo="Patrimônio artístico">
              {mostraPatrimonio ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <Campo rotulo="IPI (autoral)" valor={patrimonio?.autoral?.ipi ?? null} />
                  <Campo rotulo="IPN (intérprete)" valor={patrimonio?.interpretativo?.ipn ?? null} />
                  <Campo rotulo="Editora" valor={patrimonio?.autoral?.editora ?? null} />
                  <Campo rotulo="Sociedade" valor={patrimonio?.autoral?.sociedade ?? null} />
                  <Campo
                    rotulo="Obras registradas"
                    valor={numero(patrimonio?.autoral?.numeroObras)}
                  />
                  <Campo
                    rotulo="Fonogramas como produtor"
                    valor={numero(patrimonio?.fonografico?.fonogramasProdutor)}
                  />
                  <Campo rotulo="Masters" valor={numero(patrimonio?.fonografico?.masters)} />
                  <div>
                    <dt className="text-ink-500 mb-0.5">Status do catálogo</dt>
                    <dd>
                      {patrimonio?.fonografico?.statusCatalogo ? (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                            statusCatalogoMeta[patrimonio.fonografico.statusCatalogo.valor].chip,
                          )}
                        >
                          {statusCatalogoMeta[patrimonio.fonografico.statusCatalogo.valor].label}
                        </span>
                      ) : (
                        <span className="text-ink-600 italic">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-[12px] text-ink-600 italic">
                  Inventário ainda não preenchido.
                </p>
              )}
              <p className="text-[11px] text-ink-600 mt-2">
                Fonogramas como intérprete e a lista de ISRCs saem do catálogo — veja o card de
                Fonogramas. Contratos e licenças ficam no card de Contratos.
              </p>
            </Bloco>
          )}
        </div>
      )}

      {aberto && podeEditar && (
        <DossieDialog
          slug={slug}
          artista={artista}
          projeto={projeto}
          patrimonio={patrimonio}
          podePatrimonio={podePatrimonio}
          onFechar={() => setAberto(false)}
          onSalvo={async () => {
            setAberto(false)
            await carregar()
          }}
        />
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

function Bloco({
  icone: Icone,
  titulo,
  resumo,
  children,
}: {
  icone: typeof FileText
  titulo: string
  resumo?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
        <Icone className="w-3.5 h-3.5" aria-hidden />
        {titulo}
        {resumo && <span className="ml-auto font-normal normal-case tracking-normal">{resumo}</span>}
      </h3>
      {children}
    </div>
  )
}

function Campo({
  rotulo,
  valor,
  vazio = '—',
}: {
  rotulo: string
  valor: string | null
  vazio?: string
}) {
  return (
    <div>
      <dt className="text-ink-500 mb-0.5">{rotulo}</dt>
      <dd className={cn(valor ? 'text-ink-200' : 'text-ink-600 italic')}>{valor ?? vazio}</dd>
    </div>
  )
}

function CampoLink({
  rotulo,
  url,
  vazio = '—',
}: {
  rotulo: string
  url: string | null
  vazio?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-500 mb-0.5">{rotulo}</dt>
      <dd className="truncate">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
            Abrir
          </a>
        ) : (
          <span className="text-ink-600 italic">{vazio}</span>
        )}
      </dd>
    </div>
  )
}

/** Linha de evidência: o link, o selo de status e há quanto tempo foi conferida. */
function LinhaEvidencia({ rotulo, evidencia }: { rotulo: string; evidencia: Evidencia | null }) {
  const status = statusDaEvidencia(evidencia)
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span className="text-ink-300 w-36 shrink-0 truncate">{rotulo}</span>
      <span
        className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
          statusMeta[status].chip,
        )}
      >
        {statusMeta[status].label}
      </span>
      {evidencia?.url && (
        <a
          href={evidencia.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="w-3 h-3" aria-hidden />
          Abrir
        </a>
      )}
      {evidencia?.atualizadoEm && (
        <span className="ml-auto text-[10px] text-ink-600 truncate">
          {conferidoHa(evidencia.atualizadoEm)} · {evidencia.atualizadoPor}
        </span>
      )}
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Formatos                                                                    */
/* -------------------------------------------------------------------------- */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function dataBr(iso: string | null | undefined): string | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''} ${a}`
}

function numero(v: number | null | undefined): string | null {
  return typeof v === 'number' ? String(v) : null
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

/** "hoje" / "há 12 dias" / "há 4 meses" — precisão de relógio não importa aqui. */
function conferidoHa(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'conferido hoje'
  if (dias === 1) return 'há 1 dia'
  if (dias < 60) return `há ${dias} dias`
  return `há ${Math.floor(dias / 30)} meses`
}

export { DossieArtistaCard as default }

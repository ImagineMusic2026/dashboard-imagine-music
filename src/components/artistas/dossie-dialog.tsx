'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { salvarDossie, type ArtistaDoc, type ProjetoDoc } from '@/lib/artistas/client'
import {
  CAMPOS_EXPANSAO,
  linkValido,
  plataformaMidiaMeta,
  PLATAFORMAS_MIDIA,
  STATUS_CATALOGO,
  statusCatalogoMeta,
  type MembroEquipe,
  type Patrimonio,
  type PlataformaMidiaPaga,
  type StatusCatalogo,
} from '@/lib/artistas/dossie'
// A lista de equipe do quadro de atividades: mesma consulta, mesmo filtro
// (staff ativo) e JÁ CACHEADA. Chamar `listAppUsers()` aqui varria `users` a
// cada abertura do formulário.
import { listarEquipe } from '@/lib/atividades/client'
import type { AppUser } from '@/lib/users'
import { cn } from '@/lib/utils'

const campo =
  'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
const rotulo = 'block text-[12px] font-medium text-ink-400 mb-1'

/**
 * Formulário do dossiê — os cinco blocos do documento numa tela só.
 *
 * Salva BLOCO A BLOCO, e só os que mudaram. Dois motivos: a permissão é por
 * bloco no servidor (patrimônio exige `contratos`, o resto exige
 * `editarArtistas`), e reenviar um bloco intocado faria o servidor recarimbar
 * evidências que ninguém conferiu — o carimbo é o que sustenta o status
 * "desatualizado", então rejuvenescê-lo à toa esvaziaria o próprio indicador.
 */
export function DossieDialog({
  slug,
  artista,
  projeto,
  patrimonio: patrimonioAtual,
  podePatrimonio,
  onFechar,
  onSalvo,
}: {
  slug: string
  artista: ArtistaDoc | null
  projeto: ProjetoDoc | null
  /** Inventário — vem de subcoleção própria, não do documento do projeto. */
  patrimonio: Patrimonio | null
  podePatrimonio: boolean
  onFechar: () => void
  onSalvo: () => void | Promise<void>
}) {
  const painel = useRef<HTMLDivElement>(null)

  // ── estado inicial, a partir do que já está gravado ─────────────────────
  const [identidade, setIdentidade] = useState({
    entradaIaos: artista?.entradaIaos ?? '',
    soundchartsId: artista?.soundchartsId ?? '',
    imagineBio: artista?.imagineBio ?? '',
    imagineUp: artista?.imagineUp ?? '',
  })
  const [equipe, setEquipe] = useState<MembroEquipe[]>(projeto?.equipe ?? [])
  const [expansao, setExpansao] = useState({
    agenda: projeto?.expansao?.agenda?.url ?? '',
    release: projeto?.expansao?.release?.url ?? '',
    presskit: projeto?.expansao?.presskit?.url ?? '',
    notoriedade: projeto?.expansao?.notoriedade?.url ?? '',
  })
  const [midia, setMidia] = useState({
    url: projeto?.digital?.midiaPaga?.url ?? '',
    plataforma: (projeto?.digital?.midiaPaga?.plataforma ?? 'meta') as PlataformaMidiaPaga,
    periodo: projeto?.digital?.midiaPaga?.periodo ?? '',
  })
  const p = patrimonioAtual
  const [patrimonio, setPatrimonio] = useState({
    ipi: p?.autoral?.ipi ?? '',
    editora: p?.autoral?.editora ?? '',
    numeroObras: p?.autoral?.numeroObras != null ? String(p.autoral.numeroObras) : '',
    sociedade: p?.autoral?.sociedade ?? '',
    obsAutoral: p?.autoral?.observacoes ?? '',
    ipn: p?.interpretativo?.ipn ?? '',
    obsInterpretativo: p?.interpretativo?.observacoes ?? '',
    fonogramasProdutor:
      p?.fonografico?.fonogramasProdutor != null ? String(p.fonografico.fonogramasProdutor) : '',
    masters: p?.fonografico?.masters != null ? String(p.fonografico.masters) : '',
    statusCatalogo: (p?.fonografico?.statusCatalogo?.valor ?? '') as StatusCatalogo | '',
    obsFonografico: p?.fonografico?.observacoes ?? '',
    songDna: p?.relacional?.songDna ?? '',
    colaboracoes: p?.relacional?.colaboracoes ?? '',
    conexoes: p?.relacional?.conexoes ?? '',
    obsRelacional: p?.relacional?.observacoes ?? '',
  })

  const [staff, setStaff] = useState<AppUser[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Guarda o retrato inicial para comparar no envio — é o que decide quais
  // blocos vão ao servidor.
  const inicial = useRef({
    identidade: JSON.stringify({
      entradaIaos: artista?.entradaIaos ?? '',
      soundchartsId: artista?.soundchartsId ?? '',
      imagineBio: artista?.imagineBio ?? '',
      imagineUp: artista?.imagineUp ?? '',
    }),
    equipe: JSON.stringify(projeto?.equipe ?? []),
    expansao: JSON.stringify({
      agenda: projeto?.expansao?.agenda?.url ?? '',
      release: projeto?.expansao?.release?.url ?? '',
      presskit: projeto?.expansao?.presskit?.url ?? '',
      notoriedade: projeto?.expansao?.notoriedade?.url ?? '',
    }),
    midia: JSON.stringify({
      url: projeto?.digital?.midiaPaga?.url ?? '',
      plataforma: projeto?.digital?.midiaPaga?.plataforma ?? 'meta',
      periodo: projeto?.digital?.midiaPaga?.periodo ?? '',
    }),
  })
  const patrimonioInicial = useRef(JSON.stringify(patrimonio))

  const [equipeFalhou, setEquipeFalhou] = useState(false)

  useEffect(() => {
    listarEquipe()
      .then(setStaff)
      .catch(() => setEquipeFalhou(true))
  }, [])

  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null
    painel.current?.focus()
    return () => origem?.focus?.()
  }, [])

  const urlsInvalidas = useMemo(() => {
    const candidatas = [
      ...Object.values(expansao),
      midia.url,
      identidade.imagineBio,
      identidade.imagineUp,
      patrimonio.songDna,
    ]
    return candidatas.filter((u) => u.trim() && !linkValido(u)).length
  }, [expansao, midia.url, identidade, patrimonio.songDna])

  function alternarMembro(u: AppUser) {
    setEquipe((atual) =>
      atual.some((m) => m.uid === u.uid)
        ? atual.filter((m) => m.uid !== u.uid)
        : [...atual, { uid: u.uid, nome: u.nome || u.email }],
    )
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setErro(null)
    if (urlsInvalidas) {
      setErro('Um dos links não é um endereço válido. Use http:// ou https://.')
      return
    }
    setSalvando(true)
    try {
      // Só os blocos que mudaram — ver o comentário do topo.
      if (JSON.stringify(identidade) !== inicial.current.identidade) {
        await salvarDossie(slug, 'identidade', identidade)
      }
      if (JSON.stringify(equipe) !== inicial.current.equipe) {
        await salvarDossie(slug, 'equipe', { equipe })
      }
      if (JSON.stringify(expansao) !== inicial.current.expansao) {
        await salvarDossie(slug, 'expansao', expansao)
      }
      if (JSON.stringify(midia) !== inicial.current.midia) {
        await salvarDossie(slug, 'digital', { midiaPaga: midia })
      }
      if (podePatrimonio && JSON.stringify(patrimonio) !== patrimonioInicial.current) {
        await salvarDossie(slug, 'patrimonio', {
          autoral: {
            ipi: patrimonio.ipi,
            editora: patrimonio.editora,
            numeroObras: patrimonio.numeroObras,
            sociedade: patrimonio.sociedade,
            observacoes: patrimonio.obsAutoral,
          },
          interpretativo: {
            ipn: patrimonio.ipn,
            observacoes: patrimonio.obsInterpretativo,
          },
          fonografico: {
            fonogramasProdutor: patrimonio.fonogramasProdutor,
            masters: patrimonio.masters,
            statusCatalogo: patrimonio.statusCatalogo || null,
            observacoes: patrimonio.obsFonografico,
          },
          relacional: {
            songDna: patrimonio.songDna,
            colaboracoes: patrimonio.colaboracoes,
            conexoes: patrimonio.conexoes,
            observacoes: patrimonio.obsRelacional,
          },
        })
      }
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
      setSalvando(false)
    }
  }

  /**
   * Tab preso no painel. Sem isto o `aria-modal` mente: o foco escapava para os
   * links do perfil por trás do overlay, que continuavam clicáveis e anunciáveis
   * enquanto o leitor de tela dizia que a página estava bloqueada.
   */
  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-950/70 backdrop-blur-sm" onClick={onFechar} aria-hidden />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossie-titulo"
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className="relative w-full max-w-2xl bg-bg-900 border border-bg-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-700/40 sticky top-0 bg-bg-900 rounded-t-2xl z-10">
          <div id="dossie-titulo" className="font-bold text-ink-100">
            Alavancas estratégicas
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

        <form className="p-5 space-y-6" onSubmit={aoEnviar}>
          {/* Cadastro-base --------------------------------------------------- */}
          <Secao titulo="Cadastro-base" ajuda="O que o IAOS pede além do cadastro que já existe.">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="d-entrada" className={rotulo}>
                  Data de entrada no IAOS
                </label>
                <input
                  id="d-entrada"
                  type="date"
                  value={identidade.entradaIaos}
                  onChange={(e) => setIdentidade({ ...identidade, entradaIaos: e.target.value })}
                  className={cn(campo, '[color-scheme:dark]')}
                />
              </div>
              <div>
                <label htmlFor="d-sc" className={rotulo}>
                  Soundcharts Artist ID
                </label>
                <input
                  id="d-sc"
                  type="text"
                  value={identidade.soundchartsId}
                  onChange={(e) => setIdentidade({ ...identidade, soundchartsId: e.target.value })}
                  placeholder="Preencher quando houver assinatura"
                  className={campo}
                />
              </div>
              <div>
                <label htmlFor="d-bio" className={rotulo}>
                  ImagineBio
                </label>
                <input
                  id="d-bio"
                  type="url"
                  value={identidade.imagineBio}
                  onChange={(e) => setIdentidade({ ...identidade, imagineBio: e.target.value })}
                  placeholder="https://…"
                  className={campo}
                />
              </div>
              <div>
                <label htmlFor="d-up" className={rotulo}>
                  ImagineUp
                </label>
                <input
                  id="d-up"
                  type="url"
                  value={identidade.imagineUp}
                  onChange={(e) => setIdentidade({ ...identidade, imagineUp: e.target.value })}
                  placeholder="App em construção"
                  className={campo}
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-600 mt-2">
              Estes quatro ficam no cadastro do artista — ele os vê no portal.
            </p>
          </Secao>

          {/* Equipe ---------------------------------------------------------- */}
          <Secao titulo="Equipe responsável" ajuda="Quem da Imagine atende este artista.">
            <div className="flex flex-wrap gap-1.5">
              {staff.map((u) => {
                const marcado = equipe.some((m) => m.uid === u.uid)
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => alternarMembro(u)}
                    aria-pressed={marcado}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors',
                      marcado
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                        : 'bg-bg-950 text-ink-400 border-bg-700/50 hover:bg-bg-800',
                    )}
                  >
                    {u.nome || u.email}
                  </button>
                )
              })}
              {!staff.length && (
                <p className="text-[12px] text-ink-600">
                  {equipeFalhou
                    ? 'Não consegui carregar a equipe. Recarregue a página.'
                    : 'Carregando equipe…'}
                </p>
              )}
            </div>
          </Secao>

          {/* Expansão -------------------------------------------------------- */}
          <Secao
            titulo="Expansão de mercado"
            ajuda="O status (disponível / desatualizado / ausente) é calculado pela data em que o link foi conferido."
          >
            <div className="space-y-3">
              {CAMPOS_EXPANSAO.map((c) => (
                <div key={c.chave}>
                  <label htmlFor={`d-${c.chave}`} className={rotulo}>
                    {c.label}
                  </label>
                  <input
                    id={`d-${c.chave}`}
                    type="url"
                    value={expansao[c.chave]}
                    onChange={(e) => setExpansao({ ...expansao, [c.chave]: e.target.value })}
                    placeholder="https://…"
                    className={campo}
                  />
                  <p className="text-[11px] text-ink-600 mt-0.5">{c.ajuda}</p>
                </div>
              ))}
            </div>
          </Secao>

          {/* Mídia paga ------------------------------------------------------ */}
          <Secao
            titulo="Crescimento digital"
            ajuda="As métricas de plataforma vêm das integrações — aqui fica só o painel de mídia paga."
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="d-midia" className={rotulo}>
                  Painel de mídia paga
                </label>
                <input
                  id="d-midia"
                  type="url"
                  value={midia.url}
                  onChange={(e) => setMidia({ ...midia, url: e.target.value })}
                  placeholder="https://…"
                  className={campo}
                />
              </div>
              <div>
                <label htmlFor="d-plataforma" className={rotulo}>
                  Plataforma
                </label>
                <select
                  id="d-plataforma"
                  value={midia.plataforma}
                  onChange={(e) =>
                    setMidia({ ...midia, plataforma: e.target.value as PlataformaMidiaPaga })
                  }
                  className={campo}
                >
                  {PLATAFORMAS_MIDIA.map((pl) => (
                    <option key={pl} value={pl}>
                      {plataformaMidiaMeta[pl]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="d-periodo" className={rotulo}>
                  Período coberto
                </label>
                <input
                  id="d-periodo"
                  type="text"
                  value={midia.periodo}
                  onChange={(e) => setMidia({ ...midia, periodo: e.target.value })}
                  placeholder="jan–mar/2026"
                  className={campo}
                />
              </div>
            </div>
          </Secao>

          {/* Patrimônio ------------------------------------------------------ */}
          {podePatrimonio && (
            <Secao
              titulo="Patrimônio artístico"
              ajuda="Inventário documental. Fonogramas como intérprete e ISRCs saem do catálogo; contratos, do card de Contratos."
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <Texto id="d-ipi" label="IPI (autoral)" valor={patrimonio.ipi} aoMudar={(v) => setPatrimonio({ ...patrimonio, ipi: v })} />
                <Texto id="d-ipn" label="IPN (intérprete)" valor={patrimonio.ipn} aoMudar={(v) => setPatrimonio({ ...patrimonio, ipn: v })} />
                <Texto id="d-editora" label="Editora" valor={patrimonio.editora} aoMudar={(v) => setPatrimonio({ ...patrimonio, editora: v })} />
                <Texto id="d-sociedade" label="Sociedade / associação" valor={patrimonio.sociedade} aoMudar={(v) => setPatrimonio({ ...patrimonio, sociedade: v })} placeholder="ECAD, ABRAMUS, UBC…" />
                <Texto id="d-obras" label="Nº de obras registradas" valor={patrimonio.numeroObras} aoMudar={(v) => setPatrimonio({ ...patrimonio, numeroObras: v })} tipo="number" />
                <Texto id="d-produtor" label="Fonogramas como produtor" valor={patrimonio.fonogramasProdutor} aoMudar={(v) => setPatrimonio({ ...patrimonio, fonogramasProdutor: v })} tipo="number" />
                <Texto id="d-masters" label="Masters identificados" valor={patrimonio.masters} aoMudar={(v) => setPatrimonio({ ...patrimonio, masters: v })} tipo="number" />
                <div>
                  <label htmlFor="d-status" className={rotulo}>
                    Status do catálogo
                  </label>
                  <select
                    id="d-status"
                    value={patrimonio.statusCatalogo}
                    onChange={(e) =>
                      setPatrimonio({
                        ...patrimonio,
                        statusCatalogo: e.target.value as StatusCatalogo | '',
                      })
                    }
                    className={campo}
                  >
                    <option value="">— Não declarado —</option>
                    {STATUS_CATALOGO.map((st) => (
                      <option key={st} value={st}>
                        {statusCatalogoMeta[st].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Texto id="d-songdna" label="Spotify SongDNA" valor={patrimonio.songDna} aoMudar={(v) => setPatrimonio({ ...patrimonio, songDna: v })} tipo="url" placeholder="https://…" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="d-colab" className={rotulo}>
                    Colaborações e conexões relevantes
                  </label>
                  <textarea
                    id="d-colab"
                    rows={2}
                    value={patrimonio.colaboracoes}
                    onChange={(e) => setPatrimonio({ ...patrimonio, colaboracoes: e.target.value })}
                    placeholder="Parcerias, participações, circulação…"
                    className={cn(campo, 'resize-none')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="d-obs" className={rotulo}>
                    Observações sobre titularidade
                  </label>
                  <textarea
                    id="d-obs"
                    rows={2}
                    value={patrimonio.obsFonografico}
                    onChange={(e) =>
                      setPatrimonio({ ...patrimonio, obsFonografico: e.target.value })
                    }
                    className={cn(campo, 'resize-none')}
                  />
                </div>
              </div>
            </Secao>
          )}

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
            className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-80 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Secao({
  titulo,
  ajuda,
  children,
}: {
  titulo: string
  ajuda: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-sm font-bold text-ink-100">{titulo}</h3>
      <p className="text-[11px] text-ink-500 mt-0.5 mb-3">{ajuda}</p>
      {children}
    </section>
  )
}

function Texto({
  id,
  label,
  valor,
  aoMudar,
  tipo = 'text',
  placeholder,
}: {
  id: string
  label: string
  valor: string
  aoMudar: (v: string) => void
  tipo?: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>
        {label}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className={campo}
      />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CloudOff, Loader2, Send, UserCog } from 'lucide-react'
import {
  getDiagnostico,
  salvarDiagnostico,
  MAX_RESPOSTA,
  type OrigemDiagnostico,
} from '@/lib/diagnostico/client'
import { progressoDe, questionario, type Pergunta, type TipoDiagnostico } from '@/lib/diagnostico/perguntas'
import { cn } from '@/lib/utils'

/** Pausa de digitação que dispara o autosave. */
const DEBOUNCE_MS = 1200

type Salvamento = { estado: 'ocioso' | 'salvando' | 'salvo' | 'erro'; em?: number }

/**
 * Formulário do questionário de estruturação. Serve os DOIS lados:
 *
 * - `modo="artista"`: o artista responde no portal;
 * - `modo="equipe"`: a equipe preenche pelo painel, porque boa parte das respostas
 *   chega por fora (reunião, WhatsApp, o formulário antigo) e antes só o artista
 *   logado conseguia registrar.
 *
 * É o MESMO documento nos dois casos — um questionário por artista e tipo, não uma
 * cópia por quem digitou. O que muda é a `origem` gravada a cada save, e a cópia da
 * tela: no portal se fala COM o artista, no painel se fala SOBRE ele.
 *
 * São ~20 perguntas de texto longo: ninguém responde de uma sentada. Por isso
 * autosave por pausa de digitação + retomada — fecha e volta depois, e o rascunho
 * está lá. Concluir não tranca nada: só sinaliza que acabou (e editar depois volta
 * pra rascunho, pra o que se vê ser o estado real).
 */
export function DiagnosticoForm({
  tipo,
  slug,
  modo,
  artistaNome,
}: {
  tipo: TipoDiagnostico
  /** Dono do questionário. `null` no portal de um login ainda sem artista vinculado. */
  slug: string | null
  modo: OrigemDiagnostico
  /** Só no modo equipe: de quem é o questionário (o painel preenche por vários). */
  artistaNome?: string
}) {
  const q = questionario(tipo)
  const equipe = modo === 'equipe'

  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [enviado, setEnviado] = useState(false)
  // Origem do que estava GRAVADO ao abrir — avisa a equipe quando ela está prestes a
  // editar por cima do que o próprio artista escreveu.
  const [origemSalva, setOrigemSalva] = useState<OrigemDiagnostico | null>(null)
  const [salvamento, setSalvamento] = useState<Salvamento>({ estado: 'ocioso' })
  const [enviando, setEnviando] = useState(false)

  // Refs pro autosave: o timer não pode reiniciar o efeito, e o salvar precisa do
  // valor mais recente sem virar dependência.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const respostasRef = useRef(respostas)
  respostasRef.current = respostas
  const sujo = useRef(false)

  useEffect(() => {
    if (!slug) return
    let vivo = true
    getDiagnostico(slug, tipo)
      .then((d) => {
        if (!vivo) return
        if (d) {
          setRespostas(d.respostas)
          setEnviado(d.status === 'enviado')
          setOrigemSalva(d.origem)
        }
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [slug, tipo])

  const salvar = useCallback(
    async (enviar = false) => {
      if (!slug) return
      setSalvamento({ estado: 'salvando' })
      try {
        await salvarDiagnostico(slug, tipo, respostasRef.current, { origem: modo, enviar })
        sujo.current = false
        setSalvamento({ estado: 'salvo', em: Date.now() })
        setOrigemSalva(modo)
        if (enviar) setEnviado(true)
        else setEnviado(false)
      } catch {
        setSalvamento({ estado: 'erro' })
      }
    },
    [slug, tipo, modo]
  )

  function aoDigitar(id: string, valor: string) {
    setRespostas((r) => ({ ...r, [id]: valor.slice(0, MAX_RESPOSTA) }))
    sujo.current = true
    setSalvamento({ estado: 'ocioso' })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void salvar(false), DEBOUNCE_MS)
  }

  // Salva o que estiver pendente ao sair da página — quem fecha a aba no meio de uma
  // frase não perde o parágrafo inteiro.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (sujo.current) void salvar(false)
    }
  }, [salvar])

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    if (timer.current) clearTimeout(timer.current)
    await salvar(true)
    setEnviando(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!slug) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-bold text-ink-100">Perfil ainda não vinculado</h1>
        <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">
          Seu login ainda não está ligado a um perfil de artista. Fale com a equipe da Imagine pra concluir a
          configuração.
        </p>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-400 py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        {equipe ? 'Carregando as respostas…' : 'Carregando suas respostas…'}
      </div>
    )
  }

  const prog = progressoDe(tipo, respostas)

  return (
    <div className="space-y-6">
      <Link
        href={equipe ? `/artistas/${slug}` : '/meu-perfil'}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {equipe ? 'Voltar ao perfil do artista' : 'Voltar ao meu perfil'}
      </Link>

      <div>
        {equipe && (
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1.5 text-[10px] tracking-wider font-bold text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30">
              <UserCog className="w-2.5 h-2.5" />
              PREENCHENDO PELA EQUIPE
            </span>
            {artistaNome && <span className="text-[13px] text-ink-400 truncate">{artistaNome}</span>}
          </div>
        )}
        <h1 className="text-2xl font-bold text-ink-100">{q.titulo}</h1>
        {/* A intro do questionário fala COM o artista ("seu projeto", "sua carreira") —
            no painel quem lê é a equipe, e o que ela precisa saber é outra coisa. */}
        <p className="text-[13px] text-ink-400 leading-relaxed mt-2">
          {equipe
            ? 'Registre aqui as respostas que o artista já deu por fora — reunião, WhatsApp, formulário antigo. É o mesmo questionário que ele enxerga no portal: o que você salvar aparece pra ele, e ele pode continuar de onde você parou.'
            : q.intro}
        </p>
      </div>

      {/* Editar por cima do que o artista escreveu é permitido — mas ele deixa de
          constar como autor, e isso não pode ser uma surpresa. */}
      {equipe && origemSalva === 'artista' && prog.respondidas > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-[13px] text-amber-200/90 leading-relaxed">
          <strong className="font-semibold">
            {enviado ? 'O artista já enviou este questionário.' : 'Este questionário foi respondido pelo artista.'}
          </strong>{' '}
          Se você editar, ele passa a constar como preenchido pela equipe.
        </div>
      )}

      {/* O artista pode abrir e encontrar respostas que não foi ele quem digitou —
          dizer de onde vieram evita o susto (e o "eu não escrevi isso"). */}
      {!equipe && origemSalva === 'equipe' && (
        <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3 text-[13px] text-violet-200/90 leading-relaxed">
          <strong className="font-semibold">A equipe da Imagine preencheu este questionário</strong> com o que você já
          passou por fora. Confira, corrija e complete o que faltar — quando você salvar, volta a constar como
          respondido por você.
        </div>
      )}

      {/* Só faz sentido celebrar o envio de quem enviou: pra equipe, o questionário
          que o ARTISTA mandou já está dito no aviso acima. */}
      {enviado && (equipe ? origemSalva === 'equipe' : origemSalva !== 'equipe') && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[13px] text-emerald-200/90">
            {equipe ? (
              <>
                <strong className="font-semibold">Questionário concluído.</strong> Está no perfil do artista, marcado
                como preenchido pela equipe. Dá pra continuar editando — é só salvar de novo.
              </>
            ) : (
              <>
                <strong className="font-semibold">Respostas enviadas.</strong> A equipe da Imagine já consegue ver.
                Você pode continuar editando se lembrar de algo — é só salvar de novo.
              </>
            )}
          </div>
        </div>
      )}

      {/* Progresso + estado do autosave, grudados no topo: quem escreve sempre sabe
          se o que digitou já está seguro. O sangramento lateral acompanha a coluna do
          portal (px-5); no painel a coluna é centrada e não tem o que sangrar. */}
      <div
        className={cn(
          'sticky top-16 z-30 py-3 bg-bg-950/90 backdrop-blur border-b border-bg-700/40',
          !equipe && '-mx-5 px-5'
        )}
      >
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <span className="text-ink-400 num">
            {prog.respondidas} de {prog.total} respondidas
          </span>
          <EstadoSalvamento salvamento={salvamento} />
        </div>
        <div className="h-1 rounded-full bg-bg-800 mt-2 overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${prog.pct}%` }}
          />
        </div>
      </div>

      {q.secoes.map((secao, i) => (
        <section key={secao.titulo ?? i} className="space-y-4">
          {secao.titulo && (
            <div className="pt-2">
              <h2 className="text-[11px] tracking-[0.18em] font-bold text-violet-400 uppercase">{secao.titulo}</h2>
              {secao.descricao && <p className="text-[12px] text-ink-500 mt-1.5 leading-relaxed">{secao.descricao}</p>}
            </div>
          )}
          {secao.perguntas.map((p) => (
            <Campo key={p.id} pergunta={p} valor={respostas[p.id] ?? ''} onChange={(v) => aoDigitar(p.id, v)} />
          ))}
        </section>
      ))}

      <div className="pt-2 pb-8 space-y-3">
        <p className="text-[12px] text-ink-500 leading-relaxed">
          {equipe
            ? 'As respostas salvam sozinhas conforme você escreve — pode fechar e voltar depois. Não precisa preencher tudo de uma vez.'
            : 'Suas respostas salvam sozinhas conforme você escreve — pode fechar e voltar depois. Não precisa responder tudo de uma vez.'}
        </p>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          aria-busy={enviando}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {equipe
            ? enviado
              ? 'Salvar e manter concluído'
              : 'Marcar como concluído'
            : enviado
              ? 'Enviar novamente'
              : 'Enviar respostas'}
        </button>
      </div>
    </div>
  )
}

function EstadoSalvamento({ salvamento }: { salvamento: Salvamento }) {
  if (salvamento.estado === 'salvando') {
    return (
      <span className="flex items-center gap-1.5 text-ink-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Salvando…
      </span>
    )
  }
  if (salvamento.estado === 'salvo') {
    return (
      <span className="flex items-center gap-1.5 text-emerald-400">
        <Check className="w-3 h-3" />
        Salvo
      </span>
    )
  }
  if (salvamento.estado === 'erro') {
    return (
      <span className="flex items-center gap-1.5 text-red-400" role="alert">
        <CloudOff className="w-3 h-3" />
        Não consegui salvar — confira a conexão
      </span>
    )
  }
  return <span className="text-ink-600">Salva sozinho</span>
}

function Campo({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta
  valor: string
  onChange: (v: string) => void
}) {
  const id = `d-${pergunta.id}`
  const ajudaId = pergunta.ajuda ? `${id}-ajuda` : undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-200 mb-1">
        {pergunta.rotulo}
      </label>
      {pergunta.ajuda && (
        <p id={ajudaId} className="text-[12px] text-ink-500 leading-relaxed mb-1.5">
          {pergunta.ajuda}
        </p>
      )}
      <textarea
        id={id}
        aria-describedby={ajudaId}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={pergunta.linhas ?? 3}
        maxLength={MAX_RESPOSTA}
        className={cn(
          'w-full bg-bg-950 border border-bg-700/50 rounded-lg px-4 py-2.5 text-sm text-ink-100',
          'placeholder:text-ink-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20',
          'resize-y leading-relaxed transition-colors'
        )}
        placeholder="Escreva aqui…"
      />
    </div>
  )
}

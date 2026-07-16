'use client'

import { Briefcase } from 'lucide-react'
import type { ArtistaDoc } from '@/lib/artistas/client'

/**
 * Bloco "Projeto" do perfil: o lado COMERCIAL do cadastro (conta do selo, e-mail do
 * projeto, serviços contratados, anotações) — espelha o card de estruturação do
 * Pipefy. Não é dado de plataforma e não passa por gate de receita: vive em
 * `artistas/{slug}`, que o time inteiro lê.
 *
 * Some inteiro quando nada foi preenchido — a maioria dos artistas veio do roster ou
 * de uma importação e não tem nenhum destes campos.
 */
export function ProjetoArtistaCard({ artista }: { artista: ArtistaDoc }) {
  const servicos = artista.servicosPrevistos ?? []
  const temAlgo =
    Boolean(artista.contaArtistaSelo || artista.emailProjeto || artista.anotacoesGerais) || servicos.length > 0
  if (!temAlgo) return null

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 font-bold text-ink-100 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-violet-400 shrink-0" />
        Projeto
      </div>

      <div className="p-5 space-y-4">
        {(artista.contaArtistaSelo || artista.emailProjeto) && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Email rotulo="Conta do artista (selo)" valor={artista.contaArtistaSelo} />
            <Email rotulo="E-mail do projeto" valor={artista.emailProjeto} />
          </div>
        )}

        {servicos.length > 0 && (
          <div>
            <Rotulo>Serviços previstos</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {servicos.map((s) => (
                <span
                  key={s}
                  className="text-[12px] text-violet-200 bg-violet-500/10 border border-violet-500/25 rounded-full px-2.5 py-1"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {artista.anotacoesGerais && (
          <div>
            <Rotulo>Anotações gerais</Rotulo>
            {/* `whitespace-pre-wrap`: é texto livre, as quebras de linha são do autor. */}
            <p className="text-[13px] text-ink-300 leading-relaxed whitespace-pre-wrap">{artista.anotacoesGerais}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] tracking-wider text-ink-500 font-semibold uppercase mb-1.5">{children}</div>
}

function Email({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null
  return (
    <div className="min-w-0">
      <Rotulo>{rotulo}</Rotulo>
      <a
        href={`mailto:${valor}`}
        className="text-[13px] num text-violet-400 hover:text-violet-300 break-all transition-colors"
      >
        {valor}
      </a>
    </div>
  )
}

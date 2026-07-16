'use client'

import { useEffect, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { ehStaff } from '@/lib/permissions'
import { getProjeto, type ProjetoDoc } from '@/lib/artistas/client'

/**
 * Bloco "Projeto" do perfil: o lado COMERCIAL do cadastro — conta do selo, e-mail do
 * projeto, serviços contratados e anotações da equipe. Espelha o card de estruturação
 * do Pipefy.
 *
 * ⚠️ SÓ STAFF. Este componente vive dentro de `PerfilArtistaReal`, que o portal do
 * artista (/meu-perfil) renderiza igualzinho — e as "anotações gerais" são notas da
 * equipe SOBRE o artista. Por isso o dado mora em `projetos/{slug}` (coleção que as
 * regras negam ao artista) e não em `artistas/{slug}`, que ele lê. O gate abaixo é a
 * camada de UX; a proteção real é a regra do Firestore.
 *
 * Some inteiro quando nada foi preenchido — a maioria dos artistas veio do roster ou
 * de uma importação de receita e não tem nenhum destes campos.
 */
export function ProjetoArtistaCard({ slug }: { slug: string }) {
  const { role, loading } = useAuth()
  const [projeto, setProjeto] = useState<ProjetoDoc | null>(null)
  const staff = !loading && ehStaff(role)

  useEffect(() => {
    if (!staff) return
    let vivo = true
    getProjeto(slug)
      .then((p) => vivo && setProjeto(p))
      // Sem permissão / offline / doc inexistente: o card simplesmente não aparece.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [slug, staff])

  if (!staff || !projeto) return null

  const servicos = projeto.servicosPrevistos ?? []
  const temAlgo =
    Boolean(projeto.contaArtistaSelo || projeto.emailProjeto || projeto.anotacoesGerais) || servicos.length > 0
  if (!temAlgo) return null

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 font-bold text-ink-100 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-violet-400 shrink-0" />
        Projeto
        <span className="text-[10px] tracking-wider font-bold text-ink-500 px-2 py-0.5 rounded-full bg-bg-800 border border-bg-700/50">
          INTERNO
        </span>
      </div>

      <div className="p-5 space-y-4">
        {(projeto.contaArtistaSelo || projeto.emailProjeto) && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Email rotulo="Conta do artista (selo)" valor={projeto.contaArtistaSelo} />
            <Email rotulo="E-mail do projeto" valor={projeto.emailProjeto} />
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

        {projeto.anotacoesGerais && (
          <div>
            <Rotulo>Anotações gerais</Rotulo>
            {/* `whitespace-pre-wrap`: é texto livre, as quebras de linha são do autor. */}
            <p className="text-[13px] text-ink-300 leading-relaxed whitespace-pre-wrap">{projeto.anotacoesGerais}</p>
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

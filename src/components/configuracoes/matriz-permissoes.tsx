'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Minus, RotateCcw } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import {
  listAppUsers,
  roleMeta,
  updateUserPermissoes,
  type AppUser,
  type Capacidade,
  type Role,
} from '@/lib/users'
import { CAPACIDADES, padraoDoPapel, temPermissao } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/**
 * Permissões. O acesso parte do PAPEL (padrão), mas o admin pode conceder ou
 * restringir capacidades POR PESSOA — um override gravado em
 * `users/{uid}.permissoes`, honrado nas 3 camadas (UI, API e regras do Firestore).
 */

const PAPEIS: Role[] = ['admin', 'marketing', 'artista']

function iniciaisDe(u: AppUser): string {
  const base = u.nome?.trim() || u.email
  return base.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export function MatrizPermissoes() {
  const { role } = useAuth()
  const ehAdmin = role === 'admin'
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!ehAdmin) return
    setUsers(null)
    setErro(null)
    listAppUsers()
      .then((todos) => setUsers(todos.filter((u) => u.role !== 'artista')))
      .catch(() => {
        setErro('Não foi possível carregar os membros do time.')
        setUsers([])
      })
  }, [ehAdmin])

  useEffect(() => {
    carregar()
  }, [carregar])

  function patch(uid: string, permissoes: AppUser['permissoes']) {
    setUsers((arr) => arr?.map((x) => (x.uid === uid ? { ...x, permissoes } : x)) ?? null)
  }

  async function alternar(u: AppUser, cap: Capacidade) {
    const novas = { ...(u.permissoes ?? {}), [cap]: !temPermissao(u, cap) }
    const anterior = u.permissoes
    patch(u.uid, novas)
    setSalvando(`${u.uid}:${cap}`)
    try {
      await updateUserPermissoes(u.uid, novas)
      setErro(null)
    } catch {
      patch(u.uid, anterior)
      setErro('Não foi possível salvar a permissão. Tente de novo.')
    } finally {
      setSalvando(null)
    }
  }

  async function restaurar(u: AppUser) {
    if (!u.permissoes || Object.keys(u.permissoes).length === 0) return
    const anterior = u.permissoes
    patch(u.uid, {})
    setSalvando(`${u.uid}:*`)
    try {
      await updateUserPermissoes(u.uid, {})
      setErro(null)
    } catch {
      patch(u.uid, anterior)
      setErro('Não foi possível restaurar o padrão. Tente de novo.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Referência: padrão por papel */}
      <ReferenciaPapeis />

      {/* Editor por pessoa — só admin */}
      {ehAdmin && (
        <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-700/30">
            <div className="font-bold text-ink-100">Exceções por pessoa</div>
            <p className="text-[12px] text-ink-400 mt-0.5">
              Conceda ou restrinja capacidades de um membro específico — sobrescreve o padrão do
              papel. Salva na hora.
            </p>
          </div>

          {erro && (
            <div className="mx-5 mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          {users === null ? (
            <div className="flex items-center justify-center gap-2 text-ink-500 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando membros…
            </div>
          ) : users.length === 0 ? (
            <div className="text-ink-500 text-sm text-center py-10 px-6">Nenhum membro no time.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bg-700/40">
                    <th className="text-left text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-5">
                      Membro
                    </th>
                    {CAPACIDADES.map((c) => (
                      <th
                        key={c.cap}
                        className="py-3 px-3 text-center text-[11px] tracking-wider text-ink-400 font-semibold"
                        title={c.descricao}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-700/30">
                  {users.map((u) => {
                    const temOverride = u.permissoes && Object.keys(u.permissoes).length > 0
                    return (
                      <tr key={u.uid} className="hover:bg-bg-800/30 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <AvatarFallback iniciais={iniciaisDe(u)} gradient={roleMeta[u.role].gradient} size="sm" />
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-ink-100 truncate capitalize">
                                {u.nome || u.email.split('@')[0]}
                              </div>
                              <div className="text-[11px] text-ink-500 truncate">{roleMeta[u.role].label}</div>
                            </div>
                          </div>
                        </td>
                        {CAPACIDADES.map((c) => {
                          const ligado = temPermissao(u, c.cap)
                          const ehOverride = u.permissoes?.[c.cap] !== undefined
                          return (
                            <td key={c.cap} className="py-3 px-3 text-center">
                              <Switch
                                ligado={ligado}
                                personalizado={ehOverride}
                                ocupado={salvando === `${u.uid}:${c.cap}` || salvando === `${u.uid}:*`}
                                onClick={() => alternar(u, c.cap)}
                                rotulo={`${c.label} de ${u.nome || u.email}`}
                              />
                            </td>
                          )
                        })}
                        <td className="py-3 px-4 text-right">
                          {temOverride && (
                            <button
                              type="button"
                              onClick={() => restaurar(u)}
                              disabled={salvando === `${u.uid}:*`}
                              title="Restaurar o padrão do papel"
                              className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-200 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" /> padrão
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t border-bg-700/30 text-[11px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" /> ponto roxo = personalizado (difere
              do padrão do papel). Acessar o painel, ver artistas e gerenciar o time seguem o papel e
              não são editáveis aqui.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Toggle on/off, com anel quando o valor é um override do padrão do papel. */
function Switch({
  ligado,
  personalizado,
  ocupado,
  onClick,
  rotulo,
}: {
  ligado: boolean
  personalizado: boolean
  ocupado: boolean
  onClick: () => void
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onClick}
      disabled={ocupado}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
        ligado ? 'bg-emerald-500/80' : 'bg-bg-700',
        personalizado && 'ring-2 ring-violet-400/60 ring-offset-1 ring-offset-bg-900',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform grid place-items-center',
          ligado ? 'translate-x-4' : 'translate-x-0.5',
        )}
      >
        {ocupado ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin text-ink-600" />
        ) : ligado ? (
          <Check className="w-2.5 h-2.5 text-emerald-600" />
        ) : null}
      </span>
    </button>
  )
}

/** Tabela read-only do padrão de cada capacidade por papel. */
function ReferenciaPapeis() {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30">
        <div className="font-bold text-ink-100">Padrão por papel</div>
        <p className="text-[12px] text-ink-400 mt-0.5">
          O que cada papel pode fazer por padrão. O admin ajusta exceções por pessoa abaixo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-700/40">
              <th className="text-left text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-5">
                Capacidade
              </th>
              {PAPEIS.map((p) => (
                <th key={p} className="py-3 px-4 text-center">
                  <span className={cn('text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border', roleMeta[p].classe)}>
                    {roleMeta[p].label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-700/30">
            {CAPACIDADES.map((c) => (
              <tr key={c.cap} className="hover:bg-bg-800/30 transition-colors">
                <td className="py-3 px-5 text-sm text-ink-200">
                  {c.label}
                  <div className="text-[11px] text-ink-500">{c.descricao}</div>
                </td>
                {PAPEIS.map((p) => (
                  <td key={p} className="py-3 px-4 text-center">
                    {padraoDoPapel(p, c.cap) ? (
                      <Check className="w-4 h-4 text-emerald-400 inline-block" />
                    ) : (
                      <Minus className="w-4 h-4 text-ink-700 inline-block" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

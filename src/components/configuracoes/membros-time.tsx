'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { AvatarFallback } from '@/components/artistas/avatar-fallback'
import { useAuth } from '@/components/auth/auth-provider'
import { ConvidarMembroDialog } from '@/components/configuracoes/convidar-membro-dialog'
import { MembroAcoes } from '@/components/configuracoes/membro-acoes'
import { listAppUsers, roleMeta, type AppUser, type Role } from '@/lib/users'
import { cn } from '@/lib/utils'

function iniciaisDe(u: AppUser): string {
  const base = u.nome?.trim() || u.email
  return base
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function MembrosTime() {
  const { role, user } = useAuth()
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // null = fechado; Role = papel já selecionado ao abrir o convite.
  const [convidar, setConvidar] = useState<Role | null>(null)

  const recarregar = useCallback(() => {
    setUsers(null)
    setErro(null)
    listAppUsers()
      .then(setUsers)
      .catch((e: unknown) => {
        console.error(e)
        const code = (e as { code?: string })?.code
        setErro(
          code === 'permission-denied'
            ? 'Sem acesso ao Firestore ainda. Publique as regras de segurança e crie seu usuário admin para ver os membros.'
            : 'Não foi possível carregar os membros do time.'
        )
        setUsers([])
      })
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const ehAdmin = role === 'admin'
  const carregando = users === null
  // O time de trabalho é admin + marketing. Artistas têm área própria (são logins
  // de portal, não fazem parte da equipe).
  const time = users?.filter((u) => u.role !== 'artista') ?? []
  const artistas = users?.filter((u) => u.role === 'artista') ?? []

  return (
    <>
      <SecaoMembros
        titulo="Membros do time"
        descricao={`${time.length} ${time.length === 1 ? 'ativo' : 'ativos'} · admin e marketing`}
        membros={carregando ? null : time}
        erro={erro}
        ehAdmin={ehAdmin}
        currentUid={user?.uid}
        onRecarregar={recarregar}
        onConvidar={() => setConvidar('marketing')}
        rotuloConvidar="Convidar membro"
        vazio="Nenhum membro no time ainda. Convide o primeiro."
      />

      {!erro && (
        <SecaoMembros
          titulo="Artistas"
          descricao={`${artistas.length} ${artistas.length === 1 ? 'artista' : 'artistas'} · acesso só ao próprio portal`}
          membros={carregando ? null : artistas}
          erro={null}
          ehAdmin={ehAdmin}
          currentUid={user?.uid}
          onRecarregar={recarregar}
          onConvidar={() => setConvidar('artista')}
          rotuloConvidar="Convidar artista"
          vazio="Nenhum artista com acesso ao portal ainda."
        />
      )}

      {convidar && (
        <ConvidarMembroDialog
          roleInicial={convidar}
          onClose={() => setConvidar(null)}
          onConcluido={() => {
            setConvidar(null)
            recarregar()
            window.dispatchEvent(new Event('convite:atualizado'))
          }}
        />
      )}
    </>
  )
}

function SecaoMembros({
  titulo,
  descricao,
  membros,
  erro,
  ehAdmin,
  currentUid,
  onRecarregar,
  onConvidar,
  rotuloConvidar,
  vazio,
}: {
  titulo: string
  descricao: string
  membros: AppUser[] | null
  erro: string | null
  ehAdmin: boolean
  currentUid: string | undefined
  onRecarregar: () => void
  onConvidar: () => void
  rotuloConvidar: string
  vazio: string
}) {
  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30 flex items-center justify-between">
        <div>
          <div className="font-bold text-ink-100">{titulo}</div>
          <div className="text-[12px] text-ink-500">
            {membros === null ? 'Carregando…' : descricao}
          </div>
        </div>
        {ehAdmin && (
          <button
            type="button"
            onClick={onConvidar}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {rotuloConvidar}
          </button>
        )}
      </div>

      {membros === null ? (
        <div className="flex items-center justify-center gap-2 text-ink-500 text-sm py-10">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Carregando…
        </div>
      ) : erro ? (
        <div className="text-amber-400/90 text-sm text-center py-8 px-6 leading-relaxed">{erro}</div>
      ) : membros.length === 0 ? (
        <div className="text-ink-500 text-sm text-center py-10 px-6">{vazio}</div>
      ) : (
        <div className="divide-y divide-bg-700/30">
          {membros.map((u) => (
            <MembroRow
              key={u.uid}
              u={u}
              ehAdmin={ehAdmin}
              currentUid={currentUid}
              onMudar={onRecarregar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MembroRow({
  u,
  ehAdmin,
  currentUid,
  onMudar,
}: {
  u: AppUser
  ehAdmin: boolean
  currentUid: string | undefined
  onMudar: () => void
}) {
  const meta = roleMeta[u.role] ?? roleMeta.marketing
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-bg-800/30 transition-colors">
      <AvatarFallback iniciais={iniciaisDe(u)} gradient={meta.gradient} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink-100 truncate capitalize">
          {u.nome || u.email.split('@')[0]}
        </div>
        <div className="text-[12px] text-ink-500 num truncate">{u.email}</div>
      </div>
      {u.ativo === false && (
        <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border bg-bg-700 text-ink-400 border-bg-600">
          INATIVO
        </span>
      )}
      <span className={cn('text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border', meta.classe)}>
        {meta.label.toUpperCase()}
      </span>
      {ehAdmin &&
        (u.uid === currentUid ? (
          <span className="text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border bg-bg-700/40 text-ink-400 border-bg-600/60">
            VOCÊ
          </span>
        ) : (
          <MembroAcoes membro={u} onMudar={onMudar} />
        ))}
    </div>
  )
}

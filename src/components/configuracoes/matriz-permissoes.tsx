import { Check, Minus } from 'lucide-react'
import { roleMeta } from '@/lib/users'
import { cn } from '@/lib/utils'

/**
 * Matriz de acesso por papel (referência). Reflete o que as regras do Firestore
 * + os gates da UI já aplicam de verdade — não é editável (o acesso é definido
 * pelo papel, ajustado na aba "Time"). Para exceções por pessoa seria preciso um
 * sistema de permissões granular (fica para depois, se a necessidade aparecer).
 */

type Acesso = true | false | 'proprio'

const PAPEIS = ['admin', 'marketing', 'artista'] as const

const CAPACIDADES: {
  label: string
  nota?: string
  admin: Acesso
  marketing: Acesso
  artista: Acesso
}[] = [
  { label: 'Acessar o painel da equipe', admin: true, marketing: true, artista: false },
  { label: 'Ver roster e perfis de todos os artistas', admin: true, marketing: true, artista: false },
  {
    label: 'Ver métricas sociais (Instagram)',
    admin: true,
    marketing: true,
    artista: 'proprio',
    nota: 'Artista vê apenas as métricas do próprio perfil.',
  },
  { label: 'Ver receita / financeiro', admin: true, marketing: false, artista: false },
  { label: 'Agenda — criar e editar eventos', admin: true, marketing: true, artista: false },
  { label: 'Integrações — descobrir e sincronizar', admin: true, marketing: false, artista: false },
  { label: 'Importar dados (OneRPM / roster)', admin: true, marketing: false, artista: false },
  { label: 'Gerenciar o time (convites e papéis)', admin: true, marketing: false, artista: false },
  { label: 'Portal do artista (só o próprio perfil)', admin: false, marketing: false, artista: true },
]

function Celula({ valor }: { valor: Acesso }) {
  if (valor === true) return <Check className="w-4 h-4 text-emerald-400 inline-block" />
  if (valor === 'proprio') {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400">
        <Check className="w-4 h-4" />
        <span className="text-violet-400 text-xs">*</span>
      </span>
    )
  }
  return <Minus className="w-4 h-4 text-ink-700 inline-block" />
}

export function MatrizPermissoes() {
  const notas = CAPACIDADES.filter((c) => c.nota)

  return (
    <div className="bg-bg-900 border border-bg-700/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-700/30">
        <div className="font-bold text-ink-100">Permissões por papel</div>
        <p className="text-[12px] text-ink-400 mt-0.5">
          O acesso é definido pelo papel de cada pessoa (você ajusta na aba{' '}
          <span className="text-violet-300">Time</span>). Abaixo, o que cada papel pode ver e fazer.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-700/40">
              <th className="text-left text-[11px] tracking-wider text-ink-400 font-semibold uppercase py-3 px-5">
                Acesso
              </th>
              {PAPEIS.map((p) => (
                <th key={p} className="py-3 px-4 text-center">
                  <span
                    className={cn(
                      'text-[10px] tracking-wider font-bold px-2 py-0.5 rounded border',
                      roleMeta[p].classe,
                    )}
                  >
                    {roleMeta[p].label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-700/30">
            {CAPACIDADES.map((c) => (
              <tr key={c.label} className="hover:bg-bg-800/30 transition-colors">
                <td className="py-3 px-5 text-sm text-ink-200">
                  {c.label}
                  {c.nota && <span className="text-violet-400 ml-1">*</span>}
                </td>
                {PAPEIS.map((p) => (
                  <td key={p} className="py-3 px-4 text-center">
                    <Celula valor={c[p]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notas.length > 0 && (
        <div className="px-5 py-3 border-t border-bg-700/30 space-y-0.5">
          {notas.map((c) => (
            <div key={c.label} className="text-[11px] text-ink-500">
              <span className="text-violet-400">*</span> {c.nota}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

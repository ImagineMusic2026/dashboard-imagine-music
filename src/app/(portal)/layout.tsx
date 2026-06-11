import { PortalGuard } from '@/components/portal/portal-guard'
import { PortalShell } from '@/components/portal/portal-shell'

/** Área do portal do artista (acesso restrito ao próprio perfil). */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard>
      <PortalShell>{children}</PortalShell>
    </PortalGuard>
  )
}

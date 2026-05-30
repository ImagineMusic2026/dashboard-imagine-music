import emailjs from '@emailjs/browser'
import { roleMeta, type Role } from '@/lib/users'

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

/** True quando as 3 chaves do EmailJS estão preenchidas no .env.local. */
export function emailjsConfigurado(): boolean {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)
}

/**
 * Envia o e-mail de convite via EmailJS.
 * O template no EmailJS deve usar estas variáveis:
 *   {{to_email}}  {{to_nome}}  {{invite_link}}  {{role_label}}  {{from_nome}}
 * (e configure "To Email" do template como {{to_email}})
 */
export async function enviarEmailConvite(params: {
  toEmail: string
  toNome: string
  inviteLink: string
  role: Role
  fromNome?: string
}): Promise<void> {
  if (!emailjsConfigurado()) {
    throw new Error('EMAILJS_NAO_CONFIGURADO')
  }
  await emailjs.send(
    SERVICE_ID as string,
    TEMPLATE_ID as string,
    {
      to_email: params.toEmail,
      to_nome: params.toNome,
      invite_link: params.inviteLink,
      role_label: roleMeta[params.role].label,
      from_nome: params.fromNome ?? 'Equipe Imagine',
    },
    { publicKey: PUBLIC_KEY as string }
  )
}

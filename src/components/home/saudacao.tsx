'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/auth/auth-provider'

function saudacaoPorHora(h: number): string {
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

export function Saudacao({ right }: { right?: ReactNode }) {
  const { user, appUser } = useAuth()
  // `agora` só é definido no cliente (evita mismatch de hidratação com a hora/data do servidor).
  const [agora, setAgora] = useState<Date | null>(null)

  useEffect(() => {
    setAgora(new Date())
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const saudacao = agora ? saudacaoPorHora(agora.getHours()) : 'Olá'
  const dataLabel = agora
    ? `${DIAS[agora.getDay()]} · ${agora.getDate()} DE ${MESES[agora.getMonth()]} · ${agora.getFullYear()}`
    : ' '

  const primeiroNome = (
    appUser?.nome ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    ''
  )
    .trim()
    .split(/\s+/)[0]

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[11px] tracking-[0.18em] text-ink-400 font-semibold min-w-0 truncate">
          {dataLabel}
        </div>
        {right}
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-ink-100">
        {saudacao}
        {primeiroNome ? `, ${primeiroNome}` : ''}.
      </h1>
    </>
  )
}

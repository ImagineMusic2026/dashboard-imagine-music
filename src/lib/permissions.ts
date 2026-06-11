import type { Role } from '@/lib/users'

/**
 * Permissões por papel. Centraliza as regras de "quem vê o quê" na UI.
 * Obs: por enquanto é um gate de interface (os dados ainda são mock no código).
 * A proteção de verdade virá com as security rules quando a receita estiver no Firestore.
 */

/** Apenas admin vê dados de receita dos artistas. */
export function podeVerReceita(role: Role | null): boolean {
  return role === 'admin'
}

/** Equipe Imagine (admin ou marketing) — acessa o painel completo. */
export function ehStaff(role: Role | null): boolean {
  return role === 'admin' || role === 'marketing'
}

/** Artista — acesso restrito ao próprio perfil (portal /meu-perfil). */
export function ehArtista(role: Role | null): boolean {
  return role === 'artista'
}

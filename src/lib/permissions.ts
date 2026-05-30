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

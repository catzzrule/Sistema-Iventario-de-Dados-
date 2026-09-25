import { Role } from '../types/inventory'

// Dois perfis: Ponto Focal (preenche) e Master (aprova, vê relatórios e
// administra tudo). O antigo perfil Gestor foi unificado ao Master.
export const ROLE_LABELS: Record<Role, string> = {
  ponto_focal: 'Ponto Focal',
  master: 'Master'
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ponto_focal: 'Preenche e acompanha os inventários da própria área',
  master: 'Acesso total: aprovações, relatórios, usuários, permissões e todos os dados'
}

// Aceita os nomes antigos gravados antes das migrações, para o app não
// quebrar caso o banco ainda não tenha sido migrado.
const LEGACY_ROLE_MAP: Record<string, Role> = {
  ponto_focal: 'ponto_focal',
  master: 'master',
  gestor: 'master',
  user: 'ponto_focal',
  admin: 'master',
  encarregado: 'master'
}

export function normalizeRole(raw: unknown): Role {
  return LEGACY_ROLE_MAP[String(raw ?? '').toLowerCase().trim()] ?? 'ponto_focal'
}

export const isMasterRole = (role?: Role | null) => role === 'master'
// Mantidos como nomes próprios para deixar claro o que cada tela exige.
export const isManagerRole = isMasterRole
export const canViewReports = isMasterRole
export const canApprove = isMasterRole
export const canManageUsers = isMasterRole

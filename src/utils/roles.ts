import { Role } from '../types/inventory'

export const ROLE_LABELS: Record<Role, string> = {
  ponto_focal: 'Ponto Focal',
  gestor: 'Gestor',
  master: 'Master'
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ponto_focal: 'Preenche e acompanha os inventários da própria área',
  gestor: 'Acompanha e aprova os dados enviados pelos Pontos Focais e acessa os relatórios',
  master: 'Acesso total: usuários, permissões, relatórios e todos os dados'
}

// Aceita os nomes antigos gravados antes da migração da Fase 4, para o app
// não quebrar caso o banco ainda não tenha sido migrado.
const LEGACY_ROLE_MAP: Record<string, Role> = {
  ponto_focal: 'ponto_focal',
  gestor: 'gestor',
  master: 'master',
  user: 'ponto_focal',
  admin: 'gestor',
  encarregado: 'master'
}

export function normalizeRole(raw: unknown): Role {
  return LEGACY_ROLE_MAP[String(raw ?? '').toLowerCase().trim()] ?? 'ponto_focal'
}

export const isManagerRole = (role?: Role | null) => role === 'gestor' || role === 'master'
export const isMasterRole = (role?: Role | null) => role === 'master'
export const canViewReports = isManagerRole
export const canApprove = isManagerRole
export const canManageUsers = isMasterRole

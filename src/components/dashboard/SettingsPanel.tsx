import React, { useState } from 'react'
import {
  User,
  Lock,
  Building2,
  Mail,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Users as UsersIcon,
  Pencil,
  KeyRound,
  RotateCcw,
  X
} from 'lucide-react'
import { ManagedProfile, ManagedUserUpdate, Role, Unit, UserProfile } from '../../types/inventory'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../utils/roles'
import { UserManagementModal } from '../auth/UserManagementModal'

interface SettingsPanelProps {
  user: UserProfile
  isMaster: boolean
  allUsers: ManagedProfile[]
  units: Unit[]
  onUpdateProfile: (updates: { full_name: string; unit: string }) => Promise<void>
  onUpdatePassword: (newPassword: string) => Promise<void>
  onCreateUser?: (params: {
    email: string
    fullName: string
    unit: string
    role: Role
    provisionalPassword?: string
  }) => Promise<{ tempPassword?: string }>
  onUpdateUser?: (targetId: string, updates: ManagedUserUpdate) => Promise<void>
  onSendPasswordReset?: (email: string) => Promise<void>
  onForcePasswordChange?: (targetId: string) => Promise<void>
}

const ROLE_OPTIONS: Role[] = ['ponto_focal', 'gestor', 'master']

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  user,
  isMaster,
  allUsers,
  units,
  onUpdateProfile,
  onUpdatePassword,
  onCreateUser,
  onUpdateUser,
  onSendPasswordReset,
  onForcePasswordChange
}) => {
  const [tab, setTab] = useState<'perfil' | 'usuarios'>('perfil')

  const [fullName, setFullName] = useState(user.full_name || '')
  const [unit, setUnit] = useState(user.unit || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [userModalOpen, setUserModalOpen] = useState(false)

  const [editingUser, setEditingUser] = useState<ManagedProfile | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<Role>('ponto_focal')
  const [editUnit, setEditUnit] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  const [usersMessage, setUsersMessage] = useState('')
  const [usersError, setUsersError] = useState('')

  const unitName = (u: ManagedProfile) =>
    units.find(x => x.id === u.unit_id)?.name || u.unit || '—'

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileMessage('')
    setSavingProfile(true)
    try {
      await onUpdateProfile({ full_name: fullName.trim(), unit: unit.trim() })
      setProfileMessage('Perfil atualizado com sucesso.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não confere com a nova senha.')
      return
    }

    setSavingPassword(true)
    try {
      await onUpdatePassword(newPassword)
      setPasswordMessage('Senha atualizada com sucesso.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erro ao atualizar senha.')
    } finally {
      setSavingPassword(false)
    }
  }

  function openEdit(u: ManagedProfile) {
    setEditingUser(u)
    setEditName(u.full_name || '')
    setEditRole(u.role)
    setEditUnit(unitName(u) === '—' ? '' : unitName(u))
    setEditError('')
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser || !onUpdateUser) return
    setEditBusy(true)
    setEditError('')
    try {
      await onUpdateUser(editingUser.id, { full_name: editName.trim(), role: editRole, unit: editUnit })
      setUsersMessage(`Usuário ${editingUser.email || ''} atualizado.`)
      setUsersError('')
      setEditingUser(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao atualizar usuário.')
    } finally {
      setEditBusy(false)
    }
  }

  async function runUserAction(action: () => Promise<void>, success: string) {
    setUsersMessage('')
    setUsersError('')
    try {
      await action()
      setUsersMessage(success)
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-tabs">
        <button
          type="button"
          className={`settings-tab ${tab === 'perfil' ? 'active' : ''}`}
          onClick={() => setTab('perfil')}
        >
          <User size={16} />
          <span>Meu Perfil</span>
        </button>
        {isMaster && (
          <button
            type="button"
            className={`settings-tab ${tab === 'usuarios' ? 'active' : ''}`}
            onClick={() => setTab('usuarios')}
          >
            <UsersIcon size={16} />
            <span>Usuários e permissões</span>
          </button>
        )}
      </div>

      {tab === 'perfil' && (
        <div className="settings-section-grid">
          <section className="table-card glass-card settings-card">
            <div className="settings-card-header">
              <h3>Dados do Perfil</h3>
              <p>Suas informações pessoais dentro da plataforma.</p>
            </div>
            <form onSubmit={handleSaveProfile} className="auth-form settings-card-body">
              <div className="input-group">
                <label htmlFor="settings-email">E-mail</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input id="settings-email" type="email" value={user.email} disabled />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="settings-role">Perfil de acesso</label>
                <div className="input-with-icon">
                  <UsersIcon size={16} className="input-icon" />
                  <input id="settings-role" type="text" value={ROLE_LABELS[user.role]} disabled />
                </div>
                <span className="settings-hint">{ROLE_DESCRIPTIONS[user.role]}</span>
              </div>

              <div className="input-group">
                <label htmlFor="settings-name">Nome completo</label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    id="settings-name"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="settings-unit">Unidade / Área</label>
                <div className="input-with-icon">
                  <Building2 size={16} className="input-icon" />
                  <input
                    id="settings-unit"
                    type="text"
                    list="settings-units-list"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="Ex.: Recursos Humanos"
                    disabled={!isMaster}
                  />
                </div>
                {!isMaster && (
                  <span className="settings-hint">A unidade define quais dados você enxerga e só pode ser alterada pelo Master.</span>
                )}
              </div>

              {profileMessage && (
                <div className="alert-box alert-success flex-center-gap">
                  <CheckCircle2 size={16} />
                  <span>{profileMessage}</span>
                </div>
              )}
              {profileError && (
                <div className="alert-box alert-error flex-center-gap">
                  <AlertTriangle size={16} />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="settings-card-footer">
                <button type="submit" disabled={savingProfile} className="btn-primary btn-sm shadow-emerald">
                  {savingProfile ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </section>

          <section className="table-card glass-card settings-card">
            <div className="settings-card-header">
              <h3>Alterar Senha</h3>
              <p>Defina uma nova senha de acesso pra sua conta.</p>
            </div>
            <form onSubmit={handleSavePassword} className="auth-form settings-card-body">
              <div className="input-group">
                <label htmlFor="settings-new-password">Nova senha (mínimo 6 caracteres)</label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="settings-new-password"
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Crie sua nova senha"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="settings-confirm-password">Confirme a nova senha</label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="settings-confirm-password"
                    type="password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              {passwordMessage && (
                <div className="alert-box alert-success flex-center-gap">
                  <CheckCircle2 size={16} />
                  <span>{passwordMessage}</span>
                </div>
              )}
              {passwordError && (
                <div className="alert-box alert-error flex-center-gap">
                  <AlertTriangle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="settings-card-footer">
                <button type="submit" disabled={savingPassword} className="btn-primary btn-sm shadow-emerald">
                  {savingPassword ? 'Atualizando...' : 'Atualizar senha'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {tab === 'usuarios' && isMaster && (
        <section className="table-card glass-card">
          <div className="settings-card-header settings-users-header">
            <div>
              <h3>Usuários e permissões</h3>
              <p>Pontos Focais, Gestores e Masters com acesso ao sistema.</p>
            </div>
            {onCreateUser && (
              <button
                type="button"
                onClick={() => setUserModalOpen(true)}
                className="btn-primary btn-sm shadow-emerald"
              >
                <UserPlus size={16} />
                <span>Novo Usuário</span>
              </button>
            )}
          </div>

          {(usersMessage || usersError) && (
            <div className="settings-users-feedback">
              {usersMessage && (
                <div className="alert-box alert-success flex-center-gap">
                  <CheckCircle2 size={16} />
                  <span>{usersMessage}</span>
                </div>
              )}
              {usersError && (
                <div className="alert-box alert-error flex-center-gap">
                  <AlertTriangle size={16} />
                  <span>{usersError}</span>
                </div>
              )}
            </div>
          )}

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>E-MAIL</th>
                  <th>UNIDADE</th>
                  <th>PERFIL</th>
                  <th>DESDE</th>
                  <th className="text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length > 0 ? (
                  allUsers.map(u => (
                    <tr key={u.id} className="table-row-hover">
                      <td className="cell-main">
                        <span className="process-title">{u.full_name || '—'}</span>
                        {u.id === user.id && <span className="settings-you-tag">você</span>}
                      </td>
                      <td>{u.email || '—'}</td>
                      <td>{unitName(u)}</td>
                      <td>
                        <span className={`user-role-badge role-${u.role}`}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="cell-date">
                        {new Date(u.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="text-right">
                        <div className="row-actions-group">
                          {onUpdateUser && (
                            <button type="button" className="btn-action-open" onClick={() => openEdit(u)} title="Editar nome, perfil e unidade">
                              <Pencil size={13} />
                              <span>Editar</span>
                            </button>
                          )}
                          {onSendPasswordReset && u.email && (
                            <button
                              type="button"
                              className="btn-action-delete"
                              title="Enviar link de redefinição de senha por e-mail"
                              aria-label="Enviar link de redefinição de senha"
                              onClick={() =>
                                runUserAction(
                                  () => onSendPasswordReset(u.email as string),
                                  `Link de redefinição de senha enviado para ${u.email}.`
                                )
                              }
                            >
                              <KeyRound size={15} />
                            </button>
                          )}
                          {onForcePasswordChange && u.role === 'ponto_focal' && u.id !== user.id && (
                            <button
                              type="button"
                              className="btn-action-delete"
                              title="Exigir troca de senha no próximo acesso"
                              aria-label="Exigir troca de senha no próximo acesso"
                              onClick={() =>
                                runUserAction(
                                  () => onForcePasswordChange(u.id),
                                  `${u.email || 'O usuário'} deverá trocar a senha no próximo acesso.`
                                )
                              }
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <p>Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <datalist id="settings-units-list">
        {units.map(u => (
          <option key={u.id} value={u.name} />
        ))}
      </datalist>

      {editingUser && onUpdateUser && (
        <div className="modal-backdrop-overlay" onClick={() => (!editBusy ? setEditingUser(null) : null)}>
          <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Pencil size={22} />
              </div>
              <div className="flex-1">
                <h3>Editar usuário</h3>
                <p>{editingUser.email}</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="btn-icon" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body margin-top">
                <div className="form-field">
                  <label htmlFor="edit-user-name">Nome completo</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="custom-select-large"
                  />
                </div>
                <div className="form-field margin-top-xs">
                  <label htmlFor="edit-user-role">Perfil de acesso</label>
                  <select
                    id="edit-user-role"
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as Role)}
                    className="custom-select-large select-compact"
                    disabled={editingUser.id === user.id}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                      </option>
                    ))}
                  </select>
                  {editingUser.id === user.id && (
                    <span className="settings-hint">Você não pode alterar o seu próprio perfil de acesso.</span>
                  )}
                </div>
                <div className="form-field margin-top-xs">
                  <label htmlFor="edit-user-unit">Unidade / Área</label>
                  <input
                    id="edit-user-unit"
                    type="text"
                    list="settings-units-list"
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    placeholder="Escolha uma unidade existente ou digite uma nova"
                    className="custom-select-large"
                  />
                  <span className="settings-hint">
                    O Gestor só enxerga os dados da própria unidade. Gestor sem unidade vê todas as áreas.
                  </span>
                </div>
                {editError && <div className="alert-box alert-error margin-top-xs">{editError}</div>}
              </div>
              <div className="modal-footer margin-top">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingUser(null)} disabled={editBusy}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary btn-sm shadow-emerald" disabled={editBusy}>
                  {editBusy ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {onCreateUser && (
        <UserManagementModal
          isOpen={userModalOpen}
          units={units}
          onClose={() => setUserModalOpen(false)}
          onCreateUser={onCreateUser}
        />
      )}
    </div>
  )
}

import React, { useState } from 'react'
import {
  User,
  Lock,
  Building2,
  Mail,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Users as UsersIcon
} from 'lucide-react'
import { ManagedProfile, Role, UserProfile } from '../../types/inventory'
import { UserManagementModal } from '../auth/UserManagementModal'

interface SettingsPanelProps {
  user: UserProfile
  isManager: boolean
  allUsers: ManagedProfile[]
  onUpdateProfile: (updates: { full_name: string; unit: string }) => Promise<void>
  onUpdatePassword: (newPassword: string) => Promise<void>
  onCreateUser?: (params: {
    email: string
    fullName: string
    unit: string
    role: Role
    provisionalPassword?: string
  }) => Promise<{ tempPassword?: string }>
}

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  master: 'Master (TI)',
  encarregado: 'Encarregado (DPO)',
  user: 'Operador de Dados'
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  user,
  isManager,
  allUsers,
  onUpdateProfile,
  onUpdatePassword,
  onCreateUser
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
        {isManager && (
          <button
            type="button"
            className={`settings-tab ${tab === 'usuarios' ? 'active' : ''}`}
            onClick={() => setTab('usuarios')}
          >
            <UsersIcon size={16} />
            <span>Usuários</span>
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
                  <input id="settings-role" type="text" value={roleLabels[user.role]} disabled />
                </div>
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
                <label htmlFor="settings-unit">Unidade / Departamento</label>
                <div className="input-with-icon">
                  <Building2 size={16} className="input-icon" />
                  <input
                    id="settings-unit"
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="Ex.: Recursos Humanos"
                  />
                </div>
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

      {tab === 'usuarios' && isManager && (
        <section className="table-card glass-card">
          <div className="settings-card-header settings-users-header">
            <div>
              <h3>Usuários da Plataforma</h3>
              <p>Todos os operadores e gestores com acesso ao sistema.</p>
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

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>E-MAIL</th>
                  <th>UNIDADE</th>
                  <th>PERFIL</th>
                  <th>DESDE</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length > 0 ? (
                  allUsers.map(u => (
                    <tr key={u.id} className="table-row-hover">
                      <td className="cell-main">
                        <span className="process-title">{u.full_name || '—'}</span>
                      </td>
                      <td>{u.email || '—'}</td>
                      <td>{u.unit || '—'}</td>
                      <td>
                        <span className={`user-role-badge role-${u.role}`}>{roleLabels[u.role]}</span>
                      </td>
                      <td className="cell-date">
                        {new Date(u.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      <p>Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {onCreateUser && (
        <UserManagementModal
          isOpen={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          onCreateUser={onCreateUser}
        />
      )}
    </div>
  )
}

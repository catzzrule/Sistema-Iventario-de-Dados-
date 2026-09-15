import React, { useState } from 'react'
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, ArrowRight, LogOut, KeyRound } from 'lucide-react'
import { AetherFlow } from './AetherFlow'
import { UserProfile } from '../../types/inventory'

interface ForcePasswordChangeViewProps {
  user: UserProfile
  onPasswordChanged: (newPassword: string) => Promise<void>
  onLogout: () => void
  mode?: 'first-access' | 'recovery'
}

export const ForcePasswordChangeView: React.FC<ForcePasswordChangeViewProps> = ({
  user,
  onPasswordChanged,
  onLogout,
  mode = 'first-access'
}) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isMinLength = newPassword.length >= 6
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere com a nova senha.')
      return
    }

    setLoading(true)
    try {
      await onPasswordChanged(newPassword)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível atualizar a senha.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-container">
      <AetherFlow />

      <div className="login-panel single-card-panel">
        <div className="force-password-card glass-card">
          <div className="force-card-header">
            <div className="force-icon-badge">
              <KeyRound size={28} />
            </div>
            <div className="eyebrow-tag flex-center-gap margin-top-xs">
              <ShieldCheck size={13} className="sparkle-icon" />
              <span>SEGURANÇA & CONFORMIDADE LGPD</span>
            </div>
            <h2>{mode === 'recovery' ? 'Redefinir Senha' : 'Primeiro Acesso — Criar Senha Definitiva'}</h2>
            <p className="force-subtitle">
              {mode === 'recovery' ? (
                <>Defina uma nova senha para a conta <strong>{user.email}</strong>. Ela deve ter no mínimo 6 caracteres.</>
              ) : (
                <>Sua conta <strong>{user.email}</strong> foi cadastrada pela equipe de TI com uma senha provisória. Por exigência de segurança e privacidade da LGPD, você deve cadastrar sua nova senha pessoal de no mínimo 6 caracteres antes de prosseguir para o sistema.</>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form margin-top">
            <div className="input-group">
              <label htmlFor="new-password">Nova Senha Pessoal (mínimo 6 caracteres) *</label>
              <div className="input-with-icon">
                <Lock size={17} className="input-icon" />
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Crie sua nova senha segura"
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="confirm-password">Confirme a Nova Senha *</label>
              <div className="input-with-icon">
                <Lock size={17} className="input-icon" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha digitada acima"
                />
              </div>
            </div>

            {/* Password validation indicators */}
            <div className="password-checks-box">
              <div className={`check-item ${isMinLength ? 'valid' : 'invalid'}`}>
                <CheckCircle2 size={14} />
                <span>Mínimo de 6 caracteres</span>
              </div>
              <div className={`check-item ${passwordsMatch ? 'valid' : 'invalid'}`}>
                <CheckCircle2 size={14} />
                <span>Senhas coincidem</span>
              </div>
            </div>

            {error && (
              <div className="alert-box alert-error flex-center-gap">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="force-actions-row margin-top">
              <button
                type="button"
                onClick={onLogout}
                disabled={loading}
                className="btn-secondary btn-sm"
                title="Cancelar e sair"
              >
                <LogOut size={15} />
                <span>Sair</span>
              </button>

              <button
                type="submit"
                disabled={loading || !isMinLength || !passwordsMatch}
                className="btn-primary shadow-emerald flex-1"
              >
                {loading ? (
                  'Gravando Nova Senha...'
                ) : (
                  <>
                    <span>Definir Senha & Acessar Sistema</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

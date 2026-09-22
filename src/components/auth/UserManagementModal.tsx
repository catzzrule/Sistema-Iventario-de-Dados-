import React, { useState } from 'react'
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Building2,
  ShieldAlert,
  Copy,
  Check,
  X,
  Sparkles,
  Info,
  ShieldCheck
} from 'lucide-react'
import { Role } from '../../types/inventory'

interface UserManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateUser: (params: {
    email: string
    fullName: string
    unit: string
    role: Role
    provisionalPassword?: string
  }) => Promise<{ tempPassword?: string }>
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onCreateUser
}) => {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [unit, setUnit] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [customPassword, setCustomPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdData, setCreatedData] = useState<{
    email: string
    tempPassword?: string
    role: Role
  } | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleGenerateRandomPass = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pass = 'Lgpd@'
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCustomPassword(pass)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await onCreateUser({
        email: email.trim(),
        fullName: fullName.trim(),
        unit: unit.trim(),
        role,
        provisionalPassword: customPassword.trim() || undefined
      })

      setCreatedData({
        email: email.trim(),
        tempPassword: result.tempPassword || customPassword.trim() || 'Cadastrada no Supabase',
        role
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar usuário.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCredentials = () => {
    if (!createdData) return
    const text = `Acesso ao Inventário LGPD:\nE-mail: ${createdData.email}\nSenha Provisória: ${createdData.tempPassword}\n\nInstruções: Ao entrar no sistema pela primeira vez, será exigido cadastrar sua senha pessoal definitiva de no mínimo 6 caracteres.`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleReset = () => {
    setEmail('')
    setFullName('')
    setUnit('')
    setRole('user')
    setCustomPassword('')
    setCreatedData(null)
    setError('')
  }

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-card-custom glass-card user-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon-badge">
            <UserPlus size={24} />
          </div>
          <div className="flex-1">
            <h3>Gestão de Usuários e Acessos (TI)</h3>
            <p>Cadastre novos usuários com envio de senha provisória e troca obrigatória no 1º acesso.</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {createdData ? (
          <div className="user-success-box margin-top animate-slide-fade">
            <div className="success-badge-header">
              <ShieldCheck size={24} className="text-success" />
              <div>
                <h4>Usuário Cadastrado com Sucesso!</h4>
                <p>Envie as credenciais abaixo para o usuário:</p>
              </div>
            </div>

            <div className="credentials-card margin-top-sm">
              <div className="cred-row">
                <span className="cred-label">E-mail de Acesso:</span>
                <span className="cred-val font-mono">{createdData.email}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Senha Provisória:</span>
                <span className="cred-val font-mono font-bold text-primary">{createdData.tempPassword}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Tipo de Perfil:</span>
                <span className="cred-val">
                  {createdData.role === 'admin'
                    ? 'Gestor da Unidade'
                    : createdData.role === 'encarregado'
                    ? 'Encarregado (DPO)'
                    : 'Usuário Comum (Preenchedor)'}
                </span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Primeiro Acesso:</span>
                <span className="cred-val text-warning font-bold">
                  {createdData.role === 'user'
                    ? '⚠️ Obrigatório cadastrar nova senha definitiva no 1º login'
                    : 'Acesso direto sem troca obrigatória'}
                </span>
              </div>
            </div>

            <div className="modal-footer margin-top">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="btn-secondary btn-sm"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                <span>{copied ? 'Copiado para Área de Transferência!' : 'Copiar Credenciais'}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="btn-primary btn-sm shadow-emerald"
              >
                <UserPlus size={16} />
                <span>Cadastrar Outro Usuário</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form margin-top">
            <div className="form-grid-2">
              <div className="input-group">
                <label htmlFor="user-email">E-mail do Usuário *</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="user-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@orgao.gov.br"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="user-fullname">Nome Completo</label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    id="user-fullname"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ex.: Maria Souza"
                  />
                </div>
              </div>
            </div>

            <div className="form-grid-2 margin-top-xs">
              <div className="input-group">
                <label htmlFor="user-unit">Unidade / Departamento</label>
                <div className="input-with-icon">
                  <Building2 size={16} className="input-icon" />
                  <input
                    id="user-unit"
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="Ex.: Recursos Humanos / TI"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="user-role">Perfil de Acesso *</label>
                <select
                  id="user-role"
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className="custom-select-large select-compact"
                >
                  <option value="user">👤 Ponto Focal / Usuário Comum (Preenchedor — Troca Obrigatória)</option>
                  <option value="admin">🛡️ Gestor de Unidade (aprova a declaração da própria unidade)</option>
                  <option value="encarregado">🏛️ Encarregado (DPO) — visão de toda a instituição</option>
                </select>
              </div>
            </div>

            <div className="input-group margin-top-xs">
              <div className="label-with-action">
                <label htmlFor="user-pass">Senha Provisória (Opcional - deixe vazio para gerar automática)</label>
                <button
                  type="button"
                  onClick={handleGenerateRandomPass}
                  className="btn-text-action"
                >
                  <Sparkles size={13} />
                  <span>Gerar Senha Forte</span>
                </button>
              </div>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="user-pass"
                  type="text"
                  value={customPassword}
                  onChange={e => setCustomPassword(e.target.value)}
                  placeholder="Ex.: Lgpd@2026! (mín. 6 caracteres)"
                />
              </div>
            </div>

            <div className="info-notice-banner margin-top-xs">
              <Info size={15} className="notice-icon" />
              <span>
                {role === 'user'
                  ? '🔒 Como usuário comum, o sistema forçará a criação de uma nova senha pessoal no 1º acesso.'
                  : '⚡ Perfis de Administrador têm acesso liberado direto sem troca obrigatória.'}
              </span>
            </div>

            {error && <div className="alert-box alert-error margin-top-xs">{error}</div>}

            <div className="modal-footer margin-top">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-secondary btn-sm"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-sm shadow-emerald"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Usuário & Gerar Acesso'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

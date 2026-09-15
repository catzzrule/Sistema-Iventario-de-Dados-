import React, { useState } from 'react'
import { ShieldCheck, Lock, Mail, ArrowRight, UserPlus, Info, CheckCircle2, LogIn } from 'lucide-react'
import { AetherFlow } from './AetherFlow'
import { supabase } from '../../supabase'

interface LoginViewProps {
  configured: boolean
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, password: string) => Promise<void>
}

export const LoginView: React.FC<LoginViewProps> = ({ configured, onLogin, onSignup }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSending(true)

    try {
      if (mode === 'register') {
        await onSignup(email, password)
        setMessage('Conta cadastrada! Se a confirmação de e-mail estiver ativa no Supabase, verifique sua caixa de entrada antes de entrar.')
      } else {
        await onLogin(email, password)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação.'
      if (msg.includes('email rate limit exceeded')) {
        setError('Limite temporário de envio de e-mails do Supabase atingido. Crie o usuário diretamente no painel do Supabase (Authentication > Users > Add User com "Auto Confirm" marcado) ou aguarde alguns minutos.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos. Caso tenha criado a conta no Supabase recentemente, verifique se o e-mail foi confirmado no painel.')
      } else {
        setError(msg)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="login-container">
      <AetherFlow />

      <div className="login-panel">
        {/* Left Column: Brand & Info */}
        <div className="login-panel-left">
          <div className="login-badge-chip">
            <ShieldCheck size={14} />
            <span>GOVERNANÇA LGPD ENTERPRISE</span>
          </div>

          <h1 className="login-panel-title">
            Inventário de <br />
            <span className="gradient-text">Dados Pessoais</span>
          </h1>

          <p className="login-panel-desc">
            Mapeie processos de negócio, identifique riscos operacionais e garanta conformidade com a LGPD.
          </p>

          <div className="login-features">
            <div className="feature-item">
              <div className="feature-icon"><CheckCircle2 size={15} /></div>
              <span>Conformidade com o Guia 3 SGD/MGI</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><CheckCircle2 size={15} /></div>
              <span>Matriz de Risco LGPD Automatizada</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><CheckCircle2 size={15} /></div>
              <span>Relatório de Impacto (DPIA) em CSV</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Card with Login / Signup Tabs */}
        <div className="login-panel-right">
          {/* Tabs for Mode Switching */}
          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`mode-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login')
                setError('')
                setMessage('')
              }}
            >
              <LogIn size={15} />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register')
                setError('')
                setMessage('')
              }}
            >
              <UserPlus size={15} />
              <span>Criar Conta</span>
            </button>
          </div>

          <div className="login-card-header">
            <h2>{mode === 'register' ? 'Criar Novo Acesso' : 'Acesse o Sistema'}</h2>
            <p className="login-subtitle">
              {mode === 'register'
                ? 'Cadastre seu e-mail corporativo para solicitar ou criar acesso'
                : 'Informe suas credenciais para acessar os inventários'}
            </p>
          </div>

          {!configured && (
            <div className="demo-notice">
              <Info size={15} className="notice-icon" />
              <div>
                <strong>Modo Demonstração Ativo</strong>
                <p>Insira qualquer e-mail contendo <code>admin</code> para testar a visão de Administrador (DPO).</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="email">E-mail corporativo</label>
              <div className="input-with-icon">
                <Mail size={17} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@suaempresa.gov.br"
                />
              </div>
            </div>

            <div className="input-group">
              <div className="label-with-action">
                <label htmlFor="password">Senha de acesso</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email.trim()) {
                        setError('Digite seu e-mail no campo acima antes de solicitar redefinição.')
                        return
                      }
                      setError('')
                      setMessage('')
                      setSending(true)
                      try {
                        if (supabase) {
                          const redirectTo = window.location.origin + import.meta.env.BASE_URL
                          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
                          if (resetErr) throw resetErr
                          setMessage('Link de redefinição enviado para ' + email.trim() + '! Verifique sua caixa de entrada / spam.')
                        } else {
                          setMessage('Em modo local/demo: use qualquer senha para acessar.')
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Erro ao solicitar redefinição.')
                      } finally {
                        setSending(false)
                      }
                    }}
                    className="btn-text-action"
                  >
                    Esqueci a senha
                  </button>
                )}
              </div>
              <div className="input-with-icon">
                <Lock size={17} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="•••••••• (mínimo 6 caracteres)"
                />
              </div>
            </div>

            {error && <div className="alert-box alert-error">{error}</div>}
            {message && <div className="alert-box alert-success">{message}</div>}

            <button type="submit" disabled={sending} className="btn-primary btn-block">
              {sending ? (
                'Processando...'
              ) : mode === 'register' ? (
                <>
                  <span>Criar Minha Conta</span>
                  <UserPlus size={17} />
                </>
              ) : (
                <>
                  <span>Entrar na Plataforma</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

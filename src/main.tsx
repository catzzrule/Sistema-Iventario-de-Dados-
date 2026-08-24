import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configured, supabase } from './supabase'
import { Inventory, UserProfile, Role } from './types/inventory'
import { initialForm } from './utils/lgpdRisk'
import { exportInventoriesToCsv } from './utils/exportCsv'
import { LoginView } from './components/auth/LoginView'
import { ForcePasswordChangeView } from './components/auth/ForcePasswordChangeView'
import { DashboardView } from './components/dashboard/DashboardView'
import { InventoryFormView } from './components/inventory/InventoryFormView'
import './styles.css'

const MASTER_TI_EMAILS = ['catzzrule65@gmail.com']

function getRoleForEmail(email: string): Role {
  const clean = (email || '').toLowerCase().trim()
  if (MASTER_TI_EMAILS.includes(clean) || clean.includes('master')) {
    return 'master'
  }
  if (clean.includes('admin') || clean.includes('dpo')) {
    return 'admin'
  }
  return 'user'
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [editing, setEditing] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadSession()
  }, [])

  async function loadSession() {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await loadProfile(session.user.id, session.user.email || '')
    }
    setLoading(false)
  }

  async function loadProfile(id: string, email: string) {
    const cleanEmail = email.toLowerCase().trim()
    const autoRole = getRoleForEmail(cleanEmail)
    let role: Role = autoRole
    let fullName = cleanEmail === 'catzzrule65@gmail.com' ? 'Administrador TI / Master' : ''
    let unit = cleanEmail === 'catzzrule65@gmail.com' ? 'Tecnologia da Informação (TI)' : ''

    // Check if password has already been changed in localStorage fallback
    const localAlreadyChanged =
      localStorage.getItem('lgpd_pwd_changed_' + cleanEmail) === 'true' ||
      localStorage.getItem('lgpd_pwd_changed_' + id) === 'true'

    let mustChangePassword = role === 'user' && !localAlreadyChanged

    if (supabase) {
      try {
        // Also check supabase session user metadata
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser?.user_metadata?.must_change_password === false) {
          mustChangePassword = false
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, must_change_password, unit')
          .eq('id', id)
          .single()

        if (profile) {
          if (cleanEmail === 'catzzrule65@gmail.com') {
            role = 'master'
            mustChangePassword = false
            // Ensure DB profile is upgraded to master
            if (profile.role !== 'master' || profile.must_change_password !== false) {
              await supabase.from('profiles').update({ role: 'master', must_change_password: false }).eq('id', id)
            }
          } else if (profile.role) {
            role = profile.role as Role
          }
          if (profile.full_name) fullName = profile.full_name
          if (profile.unit) unit = profile.unit
          if (profile.must_change_password === false) {
            mustChangePassword = false
          }
        } else {
          // If profile table entry doesn't exist yet, insert it
          await supabase.from('profiles').upsert({
            id,
            role: autoRole,
            full_name: fullName,
            unit,
            must_change_password: autoRole === 'user'
          })
        }
      } catch (err) {
        console.warn('Notice loading profile:', err)
      }
    }

    // Admins and masters never have forced password change
    if (role === 'admin' || role === 'master' || cleanEmail === 'catzzrule65@gmail.com') {
      mustChangePassword = false
    }

    setUser({
      id,
      email: cleanEmail,
      role,
      full_name: fullName,
      unit,
      must_change_password: mustChangePassword
    })
    await loadInventories()
  }

  async function loadInventories() {
    if (!supabase) return
    const { data } = await supabase
      .from('inventories')
      .select('*')
      .order('updated_at', { ascending: false })

    setInventories((data || []) as Inventory[])
  }

  async function signIn(email: string, password: string) {
    const cleanEmail = email.toLowerCase().trim()

    if (!supabase) {
      const role = getRoleForEmail(cleanEmail)
      const alreadyChanged = localStorage.getItem('lgpd_pwd_changed_' + cleanEmail) === 'true'

      setUser({
        email: cleanEmail,
        role,
        full_name: cleanEmail === 'catzzrule65@gmail.com' ? 'Administrador TI / Master' : '',
        unit: cleanEmail === 'catzzrule65@gmail.com' ? 'Tecnologia da Informação (TI)' : '',
        must_change_password: role === 'user' && !alreadyChanged
      })
      setInventories([])
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw error

    const { data: { user: signed } } = await supabase.auth.getUser()
    if (signed) {
      await loadProfile(signed.id, signed.email || cleanEmail)
    }
  }

  async function signUp(email: string, password: string) {
    const cleanEmail = email.toLowerCase().trim()
    if (!supabase) {
      throw new Error('Configure o Supabase para cadastrar novas contas de usuário.')
    }
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password })
    if (error) throw error

    if (data.user) {
      const defaultRole = getRoleForEmail(cleanEmail)
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          role: defaultRole,
          must_change_password: defaultRole === 'user'
        })
      } catch (err) {
        console.warn('Profile creation notice:', err)
      }
    }
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setEditing(null)
    setInventories([])
  }

  async function saveInventory(next: Inventory) {
    const payload = {
      title: next.title,
      reference_id: next.reference_id,
      status: next.status,
      form_data: next.form_data
    }

    if (supabase) {
      const { data, error } = next.id.startsWith('draft-')
        ? await supabase.from('inventories').insert(payload).select().single()
        : await supabase.from('inventories').update(payload).eq('id', next.id).select().single()

      if (error) throw error
      setEditing(data as Inventory)
      await loadInventories()
    } else {
      const saved = {
        ...next,
        id: next.id.startsWith('draft-') ? crypto.randomUUID() : next.id,
        updated_at: new Date().toISOString()
      }
      setInventories(old => [saved, ...old.filter(i => i.id !== saved.id)])
      setEditing(saved)
    }
  }

  async function handlePasswordChanged(newPassword: string) {
    if (supabase) {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      })
      if (authError) throw authError

      if (user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', user.id)
        } catch (err) {
          console.warn('Profile update notice:', err)
        }
      }
    }

    if (user?.email) {
      localStorage.setItem('lgpd_pwd_changed_' + user.email.toLowerCase(), 'true')
    }
    if (user?.id) {
      localStorage.setItem('lgpd_pwd_changed_' + user.id, 'true')
    }

    setUser(prev => (prev ? { ...prev, must_change_password: false } : null))
  }

  async function handleCreateUser(params: {
    email: string
    fullName: string
    unit: string
    role: Role
    provisionalPassword?: string
  }): Promise<{ tempPassword?: string }> {
    const tempPassword = params.provisionalPassword || `Lgpd@${Math.random().toString(36).slice(-6)}!`
    const mustChange = params.role === 'user' // only regular users must change password

    // Clear any past flag for this email so they are prompted on first login
    localStorage.removeItem('lgpd_pwd_changed_' + params.email.toLowerCase())

    if (supabase) {
      // 1. Tenta cadastrar via signUp com a senha provisória
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: tempPassword,
        options: {
          data: {
            full_name: params.fullName,
            unit: params.unit,
            must_change_password: mustChange
          }
        }
      })

      if (error) {
        throw error
      }

      if (data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            role: params.role,
            full_name: params.fullName,
            unit: params.unit,
            must_change_password: mustChange
          })
        } catch (err) {
          console.warn('Profile upsert notice:', err)
        }
      }
    }

    return { tempPassword }
  }

  async function deleteInventory(id: string) {
    if (supabase && !id.startsWith('draft-')) {
      const { error } = await supabase.from('inventories').delete().eq('id', id)
      if (error) {
        alert('Erro ao excluir do banco de dados: ' + error.message)
        throw error
      }
    }
    setInventories(prev => prev.filter(i => i.id !== id))
    if (editing?.id === id) {
      setEditing(null)
    }
    await loadInventories()
  }

  function handleExport(unitFilter?: string) {
    exportInventoriesToCsv(inventories, unitFilter)
  }

  if (loading) {
    return (
      <main className="loading-screen" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <p>Carregando plataforma de inventário LGPD...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <LoginView
        configured={configured}
        onLogin={signIn}
        onSignup={signUp}
      />
    )
  }

  // Se o usuário for comum e estiver com troca de senha pendente no 1º acesso
  if (user.role === 'user' && user.must_change_password) {
    return (
      <ForcePasswordChangeView
        user={user}
        onPasswordChanged={handlePasswordChanged}
        onLogout={signOut}
      />
    )
  }

  if (editing) {
    return (
      <InventoryFormView
        user={user}
        inventory={editing}
        onBack={() => {
          setEditing(null)
          void loadInventories()
        }}
        onSave={saveInventory}
        onDelete={deleteInventory}
      />
    )
  }

  return (
    <DashboardView
      user={user}
      inventories={inventories}
      onNew={() =>
        setEditing({
          id: 'draft-' + crypto.randomUUID(),
          title: '',
          reference_id: '',
          status: 'rascunho',
          updated_at: new Date().toISOString(),
          form_data: {
            ...initialForm(),
            created_at: new Date().toISOString().slice(0, 10)
          }
        })
      }
      onEdit={setEditing}
      onDelete={deleteInventory}
      onLogout={signOut}
      onExport={handleExport}
      onCreateUser={handleCreateUser}
    />
  )
}

createRoot(document.getElementById('root')!).render(<App />)

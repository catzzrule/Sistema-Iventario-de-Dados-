import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configured, supabase } from './supabase'
import { Inventory, UserProfile, Role, AppNotification, ManagedProfile } from './types/inventory'
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

function isManagerProfile(profile: UserProfile | null): boolean {
  return (
    profile?.role === 'admin' ||
    profile?.role === 'master' ||
    profile?.email?.toLowerCase() === 'catzzrule65@gmail.com'
  )
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [allUsers, setAllUsers] = useState<ManagedProfile[]>([])
  const [editing, setEditing] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    void loadSession()

    if (!supabase) return
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        setPasswordRecovery(true)
        void loadProfile(session.user.id, session.user.email || '')
        setLoading(false)
      }
    })
    return () => subscription.subscription.unsubscribe()
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
            email: cleanEmail,
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

    const profile: UserProfile = {
      id,
      email: cleanEmail,
      role,
      full_name: fullName,
      unit,
      must_change_password: mustChangePassword
    }
    setUser(profile)
    await loadInventories()
    await loadNotifications(profile)
    if (isManagerProfile(profile)) {
      await loadAllUsers()
    }
  }

  async function loadAllUsers() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, unit, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Notice loading users:', error)
      return
    }
    setAllUsers((data || []) as ManagedProfile[])
  }

  async function loadInventories() {
    if (!supabase) return
    const { data } = await supabase
      .from('inventories')
      .select('*')
      .order('updated_at', { ascending: false })

    setInventories((data || []) as Inventory[])
  }

  async function loadNotifications(profile: UserProfile) {
    if (!supabase) return
    let query = supabase
      .from('notifications')
      .select('*, inventories(title)')
      .order('created_at', { ascending: false })

    query = isManagerProfile(profile)
      ? query.or(`recipient_scope.eq.managers,and(recipient_scope.eq.user,recipient_id.eq.${profile.id})`)
      : query.eq('recipient_scope', 'user').eq('recipient_id', profile.id)

    const { data, error } = await query
    if (error) {
      console.warn('Notice loading notifications:', error)
      return
    }

    setNotifications(
      (data || []).map((row: any) => ({
        ...row,
        inventory_title: row.inventories?.title
      }))
    )
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
    setPasswordRecovery(false)
  }

  async function saveInventory(next: Inventory) {
    const payload = {
      title: next.title,
      reference_id: next.reference_id,
      status: next.status,
      form_data: next.form_data
    }

    if (supabase) {
      const previous = inventories.find(i => i.id === next.id)
      const wasJustSubmitted = next.status === 'concluido' && previous?.status !== 'concluido'

      const { data, error } = next.id.startsWith('draft-')
        ? await supabase.from('inventories').insert(payload).select().single()
        : await supabase.from('inventories').update(payload).eq('id', next.id).select().single()

      if (error) throw error
      setEditing(data as Inventory)
      await loadInventories()

      if (wasJustSubmitted && user) {
        const saved = data as Inventory
        try {
          await supabase.from('notifications').insert({
            inventory_id: saved.id,
            sender_id: user.id,
            recipient_scope: 'managers',
            type: 'submitted'
          })
          await loadNotifications(user)
        } catch (err) {
          console.warn('Notice creating submission notification:', err)
        }
      }
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
    setPasswordRecovery(false)
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
            email: params.email.toLowerCase().trim(),
            must_change_password: mustChange
          })
        } catch (err) {
          console.warn('Profile upsert notice:', err)
        }
      }
      await loadAllUsers()
    }

    return { tempPassword }
  }

  async function handleUpdateProfile(updates: { full_name: string; unit: string }) {
    if (!user) return
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: updates.full_name, unit: updates.unit })
        .eq('id', user.id)
      if (error) throw error
    }
    setUser(prev => (prev ? { ...prev, full_name: updates.full_name, unit: updates.unit } : null))
  }

  async function handleUpdateOwnPassword(newPassword: string) {
    if (!supabase) return
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
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

  async function handleReturnInventory(inventory: Inventory, message: string) {
    if (!supabase || !user) return
    const { error } = await supabase
      .from('inventories')
      .update({ status: 'rascunho' })
      .eq('id', inventory.id)
    if (error) throw error

    try {
      await supabase.from('notifications').insert({
        inventory_id: inventory.id,
        sender_id: user.id,
        recipient_id: inventory.owner_id,
        recipient_scope: 'user',
        type: 'returned',
        message
      })
    } catch (err) {
      console.warn('Notice creating return notification:', err)
    }

    await loadInventories()
    await loadNotifications(user)
  }

  async function handleMarkNotificationRead(id: string) {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    if (!supabase) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch (err) {
      console.warn('Notice marking notification read:', err)
    }
  }

  if (loading) {
    return (
      <main className="loading-screen" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <p>Carregando plataforma de inventário LGPD...</p>
      </main>
    )
  }

  // Usuário clicou no link de "Esqueci a senha" recebido por e-mail
  if (passwordRecovery) {
    if (!user) {
      return (
        <main className="loading-screen" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
          <p>Carregando plataforma de inventário LGPD...</p>
        </main>
      )
    }
    return (
      <ForcePasswordChangeView
        user={user}
        onPasswordChanged={handlePasswordChanged}
        onLogout={signOut}
        mode="recovery"
      />
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
      notifications={notifications}
      allUsers={allUsers}
      onMarkNotificationRead={handleMarkNotificationRead}
      onReturnInventory={handleReturnInventory}
      onUpdateProfile={handleUpdateProfile}
      onUpdatePassword={handleUpdateOwnPassword}
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

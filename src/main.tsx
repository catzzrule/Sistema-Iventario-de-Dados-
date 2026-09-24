import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configured, createIsolatedAuthClient, supabase } from './supabase'
import {
  Inventory,
  UserProfile,
  Role,
  AppNotification,
  ManagedProfile,
  ManagedUserUpdate,
  Cycle,
  DataSource,
  Sharing,
  UnitDeclaration,
  Unit,
  AuditLogEntry
} from './types/inventory'
import { initialForm } from './utils/lgpdRisk'
import { exportInventoriesToCsv } from './utils/exportCsv'
import { isManagerRole, isMasterRole, normalizeRole, ROLE_LABELS } from './utils/roles'
import { LoginView } from './components/auth/LoginView'
import { ForcePasswordChangeView } from './components/auth/ForcePasswordChangeView'
import { DashboardView } from './components/dashboard/DashboardView'
import { InventoryFormView } from './components/inventory/InventoryFormView'
import './styles.css'

// Só usado no modo demonstração local (sem Supabase configurado). Com o
// Supabase, o perfil vem SEMPRE da tabela profiles — nunca do e-mail.
function demoRoleForEmail(email: string): Role {
  const clean = (email || '').toLowerCase()
  if (clean.includes('master')) return 'master'
  if (clean.includes('gestor') || clean.includes('admin')) return 'gestor'
  return 'ponto_focal'
}

const isManagerProfile = (profile: UserProfile | null) => isManagerRole(profile?.role)

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [allUsers, setAllUsers] = useState<ManagedProfile[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [sharings, setSharings] = useState<Sharing[]>([])
  const [unitDeclarations, setUnitDeclarations] = useState<UnitDeclaration[]>([])
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
    let role: Role = 'ponto_focal'
    let fullName = ''
    let unit = ''
    let unitId: string | null = null

    // Check if password has already been changed in localStorage fallback
    const localAlreadyChanged =
      localStorage.getItem('lgpd_pwd_changed_' + cleanEmail) === 'true' ||
      localStorage.getItem('lgpd_pwd_changed_' + id) === 'true'

    let mustChangePassword = !localAlreadyChanged

    if (supabase) {
      try {
        // Also check supabase session user metadata
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser?.user_metadata?.must_change_password === false) {
          mustChangePassword = false
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, must_change_password, unit, unit_id')
          .eq('id', id)
          .maybeSingle()

        if (profile) {
          role = normalizeRole(profile.role)
          if (profile.full_name) fullName = profile.full_name
          if (profile.unit) unit = profile.unit
          unitId = profile.unit_id ?? null
          // O perfil no banco é a fonte da verdade (permite ao Master exigir a troca).
          mustChangePassword = profile.must_change_password === true
        } else {
          // Perfil ausente (conta criada antes do trigger de cadastro): cria
          // como Ponto Focal. O banco ignora qualquer outro papel vindo daqui.
          await supabase.from('profiles').insert({
            id,
            email: cleanEmail,
            must_change_password: true
          })
        }
      } catch (err) {
        console.warn('Notice loading profile:', err)
      }
    }

    // Gestor e Master nunca têm troca de senha forçada
    if (isManagerRole(role)) {
      mustChangePassword = false
    }

    const profile: UserProfile = {
      id,
      email: cleanEmail,
      role,
      full_name: fullName,
      unit,
      unit_id: unitId,
      must_change_password: mustChangePassword
    }
    setUser(profile)
    await loadInventories()
    await loadNotifications(profile)
    await loadCurrentCycle()
    await loadDataSources()
    await loadSharings()
    await loadUnitDeclarations()
    await loadUnits()
    if (isManagerProfile(profile)) {
      await Promise.all([loadAllUsers(), loadCycles(), loadAuditLog()])
    }
  }

  async function loadUnits() {
    if (!supabase) return
    const { data, error } = await supabase.from('units').select('*').order('name')
    if (error) {
      console.warn('Notice loading units:', error)
      return
    }
    setUnits((data || []) as Unit[])
  }

  async function loadCycles() {
    if (!supabase) return
    const { data, error } = await supabase.from('cycles').select('*').order('year', { ascending: false })
    if (error) {
      console.warn('Notice loading cycles:', error)
      return
    }
    setCycles((data || []) as Cycle[])
  }

  async function loadAuditLog() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      console.warn('Notice loading audit log:', error)
      return
    }
    setAuditLog((data || []) as AuditLogEntry[])
  }

  async function refreshReportData() {
    await Promise.all([loadInventories(), loadUnitDeclarations(), loadUnits(), loadCycles(), loadAuditLog()])
  }

  // Resolve o nome digitado para uma unidade existente (sem diferenciar
  // maiúsculas) ou cria uma nova. Só o Master tem permissão de criar (RLS).
  async function resolveUnitId(unitName: string): Promise<string | null> {
    const name = unitName.trim()
    if (!supabase || !name) return null
    const existing = units.find(u => u.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id

    const { data, error } = await supabase.from('units').insert({ name }).select().single()
    if (error) {
      const { data: found } = await supabase.from('units').select('*').ilike('name', name).maybeSingle()
      if (found) return (found as Unit).id
      throw error
    }
    await loadUnits()
    return (data as Unit).id
  }

  async function loadCurrentCycle() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'aberto')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('Notice loading cycle:', error)
      return
    }
    setCycle((data as Cycle) || null)
  }

  async function loadDataSources() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Notice loading data sources:', error)
      return
    }
    setDataSources((data || []) as DataSource[])
  }

  async function loadSharings() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('sharings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Notice loading sharings:', error)
      return
    }
    setSharings((data || []) as Sharing[])
  }

  async function handleCreateDataSource(params: { name: string; type: DataSource['type']; criticality: DataSource['criticality'] }) {
    if (!supabase || !user?.unit_id || !cycle) throw new Error('Sua unidade ainda não foi definida. Peça ao Master para vincular seu usuário a uma unidade.')
    const { error } = await supabase.from('data_sources').insert({
      unit_id: user.unit_id,
      cycle_id: cycle.id,
      name: params.name,
      type: params.type,
      criticality: params.criticality,
      created_by: user.id
    })
    if (error) throw error
    await loadDataSources()
  }

  async function handleCreateSharing(params: { recipient_name: string; legal_instrument: string; operation_id: string | null }) {
    if (!supabase || !user?.unit_id || !cycle) throw new Error('Sua unidade ainda não foi definida. Peça ao Master para vincular seu usuário a uma unidade.')
    const { error } = await supabase.from('sharings').insert({
      unit_id: user.unit_id,
      cycle_id: cycle.id,
      operation_id: params.operation_id,
      recipient_name: params.recipient_name,
      legal_instrument: params.legal_instrument || null,
      created_by: user.id
    })
    if (error) throw error
    await loadSharings()
  }

  async function handleCloseItem(
    kind: 'inventory' | 'data_source' | 'sharing',
    id: string,
    reason: string,
    destination: string
  ) {
    if (!supabase) return
    const table = kind === 'inventory' ? 'inventories' : kind === 'data_source' ? 'data_sources' : 'sharings'
    const { error } = await supabase
      .from(table)
      .update({ item_status: 'encerrado', closure_reason: reason, closure_destination: destination })
      .eq('id', id)
    if (error) throw error

    if (kind === 'inventory') await loadInventories()
    else if (kind === 'data_source') await loadDataSources()
    else await loadSharings()
  }

  async function loadUnitDeclarations() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('unit_declarations')
      .select('*')
      .order('submitted_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.warn('Notice loading unit declarations:', error)
      return
    }
    setUnitDeclarations((data || []) as UnitDeclaration[])
  }

  async function logAudit(
    action: string,
    entityType: string,
    entityId: string | null,
    detail: string,
    unitId: string | null = user?.unit_id ?? null
  ) {
    if (!supabase || !user) return
    try {
      const { error } = await supabase.from('audit_log').insert({
        unit_id: unitId,
        cycle_id: cycle?.id,
        actor_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        detail
      })
      if (error) console.warn('Notice writing audit log:', error)
    } catch (err) {
      console.warn('Notice writing audit log:', err)
    }
  }

  async function handleSubmitDeclaration() {
    if (!supabase || !user?.unit_id || !cycle) {
      throw new Error('Sua unidade ainda não foi definida. Peça ao Master para vincular seu usuário a uma unidade.')
    }

    const existing = unitDeclarations.find(d => d.unit_id === user.unit_id && d.cycle_id === cycle.id)
    const payload = {
      unit_id: user.unit_id,
      cycle_id: cycle.id,
      status: 'em_preenchimento' as const,
      submitted_at: new Date().toISOString(),
      submitted_by: user.id
    }

    const { data, error } = existing
      ? await supabase.from('unit_declarations').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('unit_declarations').insert(payload).select().single()
    if (error) throw error

    await logAudit('submitted', 'unit_declaration', (data as UnitDeclaration).id, 'Declaração enviada para aprovação do gestor.', user.unit_id)
    await loadUnitDeclarations()
  }

  async function handleApproveDeclaration(declaration: UnitDeclaration) {
    if (!supabase || !user) return
    if (!isManagerProfile(user)) throw new Error('Somente o Gestor ou o Master podem aprovar a declaração.')
    const { error } = await supabase
      .from('unit_declarations')
      .update({ status: 'em_homologacao', approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', declaration.id)
    if (error) throw error

    if (declaration.submitted_by) {
      try {
        await supabase.from('notifications').insert({
          sender_id: user.id,
          recipient_id: declaration.submitted_by,
          recipient_scope: 'user',
          type: 'approved',
          message: 'Sua declaração foi aprovada pelo Gestor.'
        })
      } catch (err) {
        console.warn('Notice creating approval notification:', err)
      }
    }

    await logAudit('approved', 'unit_declaration', declaration.id, 'Declaração aprovada pelo Gestor.', declaration.unit_id)
    await loadAuditLog()
    await loadUnitDeclarations()
  }

  async function handleReturnDeclaration(declaration: UnitDeclaration, observation: string) {
    if (!supabase || !user) return
    if (!isManagerProfile(user)) throw new Error('Somente o Gestor ou o Master podem devolver a declaração.')
    const { error } = await supabase
      .from('unit_declarations')
      .update({ submitted_at: null, submitted_by: null })
      .eq('id', declaration.id)
    if (error) throw error

    if (declaration.submitted_by) {
      try {
        await supabase.from('notifications').insert({
          sender_id: user.id,
          recipient_id: declaration.submitted_by,
          recipient_scope: 'user',
          type: 'returned',
          message: observation
        })
      } catch (err) {
        console.warn('Notice creating return notification:', err)
      }
    }

    await logAudit('returned', 'unit_declaration', declaration.id, observation, declaration.unit_id)
    await loadAuditLog()
    await loadUnitDeclarations()
  }

  async function loadAllUsers() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, unit, unit_id, role, created_at')
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
      const role = demoRoleForEmail(cleanEmail)
      const alreadyChanged = localStorage.getItem('lgpd_pwd_changed_' + cleanEmail) === 'true'

      setUser({
        email: cleanEmail,
        role,
        full_name: '',
        unit: '',
        must_change_password: role === 'ponto_focal' && !alreadyChanged
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
    // O perfil é criado pelo trigger do banco sempre como Ponto Focal. Quem
    // se cadastra sozinho escolhe a própria senha, então não é forçado a trocá-la.
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { must_change_password: false } }
    })
    if (error) throw error
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
    if (!isMasterRole(user?.role)) {
      throw new Error('Somente o Master pode cadastrar usuários.')
    }
    const tempPassword = params.provisionalPassword || `Lgpd@${Math.random().toString(36).slice(-6)}!`
    const mustChange = params.role === 'ponto_focal' // só Ponto Focal troca a senha no 1º acesso
    const email = params.email.toLowerCase().trim()

    // Clear any past flag for this email so they are prompted on first login
    localStorage.removeItem('lgpd_pwd_changed_' + email)

    if (supabase) {
      const signupClient = createIsolatedAuthClient()
      if (!signupClient) throw new Error('Supabase não configurado.')

      const { data, error } = await signupClient.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { full_name: params.fullName, must_change_password: mustChange } }
      })
      if (error) throw error
      if (!data.user || data.user.identities?.length === 0) {
        throw new Error('Já existe uma conta cadastrada com este e-mail.')
      }

      // O perfil nasce Ponto Focal (trigger do banco); o Master ajusta o papel.
      const unitId = await resolveUnitId(params.unit)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: params.role,
          full_name: params.fullName,
          unit: params.unit.trim() || null,
          unit_id: unitId,
          email,
          must_change_password: mustChange
        })
        .eq('id', data.user.id)
      if (profileError) throw profileError

      await logAudit('user_created', 'profile', data.user.id, `Usuário ${email} cadastrado como ${ROLE_LABELS[params.role]}.`, unitId)
      await loadAllUsers()
    }

    return { tempPassword }
  }

  async function handleUpdateProfile(updates: { full_name: string; unit: string }) {
    if (!user) return
    // Unidade define quais dados a pessoa enxerga, então só o Master altera
    // (o banco também bloqueia). Os demais atualizam apenas o nome.
    const master = isMasterRole(user.role)
    const unitId = master ? await resolveUnitId(updates.unit) : user.unit_id ?? null
    const unit = master ? updates.unit.trim() : user.unit || ''

    if (supabase) {
      const payload = master
        ? { full_name: updates.full_name, unit: unit || null, unit_id: unitId }
        : { full_name: updates.full_name }
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error
    }
    setUser(prev => (prev ? { ...prev, full_name: updates.full_name, unit, unit_id: unitId } : null))
  }

  async function handleMasterUpdateUser(targetId: string, updates: ManagedUserUpdate) {
    if (!supabase || !isMasterRole(user?.role)) throw new Error('Somente o Master pode alterar usuários.')
    if (targetId === user?.id && updates.role !== user.role) {
      throw new Error('Você não pode alterar o seu próprio perfil de acesso.')
    }
    const unitId = await resolveUnitId(updates.unit)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        role: updates.role,
        unit: updates.unit.trim() || null,
        unit_id: unitId
      })
      .eq('id', targetId)
    if (error) throw error

    await logAudit('user_updated', 'profile', targetId, `Perfil alterado para ${ROLE_LABELS[updates.role]}.`, unitId)
    await loadAllUsers()
  }

  async function handleSendPasswordReset(email: string) {
    if (!supabase || !isMasterRole(user?.role)) throw new Error('Somente o Master pode redefinir senhas.')
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  async function handleForcePasswordChange(targetId: string) {
    if (!supabase || !isMasterRole(user?.role)) throw new Error('Somente o Master pode exigir troca de senha.')
    const { error } = await supabase.from('profiles').update({ must_change_password: true }).eq('id', targetId)
    if (error) throw error
    await loadAllUsers()
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
    if (!supabase || !user || !isManagerProfile(user)) return
    const { data: updated, error } = await supabase
      .from('inventories')
      .update({ status: 'rascunho' })
      .eq('id', inventory.id)
      .select('id')
    if (error) throw error
    // Sem linha atualizada = a RLS negou (inventário de outra unidade).
    if (!updated?.length) throw new Error('Você não tem permissão para devolver este inventário.')
    await logAudit('inventory_returned', 'inventory', inventory.id, message, inventory.unit_id ?? null)

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

  // Se o Ponto Focal estiver com troca de senha pendente (1º acesso ou exigida pelo Master)
  if (user.role === 'ponto_focal' && user.must_change_password) {
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
      cycle={cycle}
      dataSources={dataSources}
      sharings={sharings}
      unitDeclarations={unitDeclarations}
      units={units}
      cycles={cycles}
      auditLog={auditLog}
      onRefreshReports={refreshReportData}
      onUpdateUser={handleMasterUpdateUser}
      onSendPasswordReset={handleSendPasswordReset}
      onForcePasswordChange={handleForcePasswordChange}
      onMarkNotificationRead={handleMarkNotificationRead}
      onReturnInventory={handleReturnInventory}
      onUpdateProfile={handleUpdateProfile}
      onUpdatePassword={handleUpdateOwnPassword}
      onCreateDataSource={handleCreateDataSource}
      onCreateSharing={handleCreateSharing}
      onCloseItem={handleCloseItem}
      onSubmitDeclaration={handleSubmitDeclaration}
      onApproveDeclaration={handleApproveDeclaration}
      onReturnDeclaration={handleReturnDeclaration}
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
      onCreateUser={isMasterRole(user.role) ? handleCreateUser : undefined}
    />
  )
}

createRoot(document.getElementById('root')!).render(<App />)

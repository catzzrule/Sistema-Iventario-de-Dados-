export type Role = 'admin' | 'user' | 'master'

export type TableRow = {
  institution: string
  data: string
  purpose: string
}

export type FormData = {
  unit?: string
  system_name?: string
  system_development?: string
  system_architecture?: string
  system_hosting?: string
  system_start_date?: string
  created_at?: string
  updated_on?: string
  controller_name?: string
  controller_email?: string
  controller_phone?: string
  dpo_name?: string
  dpo_email?: string
  operator_name?: string
  lifecycle?: string[]
  flow?: string
  geography?: string
  data_source?: string
  legal_basis?: string
  purpose?: string
  legal_provision?: string
  data_categories?: string[]
  retention_period?: string
  database?: string
  sensitive_categories?: string[]
  frequency?: string
  data_volume?: string
  data_subjects?: string
  vulnerable_groups?: string[]
  sharing?: TableRow[]
  security?: string
  international_transfer?: string
  contracts?: string
  [key: string]: unknown
}

export type Inventory = {
  id: string
  owner_id?: string
  title: string
  reference_id: string
  updated_at: string
  status: 'rascunho' | 'concluido' | string
  form_data: FormData
}

export type NotificationType = 'submitted' | 'returned'

export type AppNotification = {
  id: string
  inventory_id: string | null
  sender_id: string
  recipient_id: string | null
  recipient_scope: 'user' | 'managers'
  type: NotificationType
  message: string | null
  read: boolean
  created_at: string
  inventory_title?: string
}

export type RiskLevel = 'alto' | 'medio' | 'baixo'

export type RiskItem = {
  level: RiskLevel
  text: string
}

export type UserProfile = {
  id?: string
  email: string
  role: Role
  full_name?: string
  must_change_password?: boolean
  unit?: string
}

export type ManagedProfile = {
  id: string
  email: string | null
  full_name: string | null
  unit: string | null
  role: Role
  created_at: string
}

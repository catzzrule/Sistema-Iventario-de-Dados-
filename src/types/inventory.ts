export type Role = 'admin' | 'user' | 'master' | 'encarregado'

export type ItemStatus = 'mantido' | 'alterado' | 'encerrado' | 'novo'

export type Unit = {
  id: string
  name: string
  sigla: string | null
  created_at: string
}

export type Cycle = {
  id: string
  year: number
  label: string
  deadline: string | null
  status: 'aberto' | 'encerrado'
  created_at: string
}

export type UnitDeclarationStatus = 'nao_iniciada' | 'em_preenchimento' | 'em_homologacao' | 'homologada'

export type UnitDeclaration = {
  id: string
  unit_id: string
  cycle_id: string
  status: UnitDeclarationStatus
  submitted_at: string | null
  submitted_by: string | null
  approved_at: string | null
  approved_by: string | null
  homologated_at: string | null
  homologated_by: string | null
}

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
  unit_id?: string | null
  cycle_id?: string | null
  item_status?: ItemStatus
  change_description?: string | null
  closure_reason?: string | null
  closure_destination?: string | null
  previous_version_id?: string | null
  title: string
  reference_id: string
  updated_at: string
  status: 'rascunho' | 'concluido' | string
  form_data: FormData
}

export type DataSourceType = 'banco_de_dados' | 'planilha' | 'arquivo_fisico' | 'outro'
export type Criticality = 'alta' | 'media' | 'baixa'

export type DataSource = {
  id: string
  unit_id: string
  cycle_id: string
  name: string
  type: DataSourceType
  criticality: Criticality
  item_status: ItemStatus
  change_description: string | null
  closure_reason: string | null
  closure_destination: string | null
  previous_version_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Sharing = {
  id: string
  unit_id: string
  cycle_id: string
  operation_id: string | null
  recipient_name: string
  legal_instrument: string | null
  item_status: ItemStatus
  change_description: string | null
  closure_reason: string | null
  closure_destination: string | null
  previous_version_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DataSourceColumn = {
  id: string
  data_source_id: string
  column_name: string
  classification: string | null
  classified: boolean
  classified_by: string | null
  classified_at: string | null
  created_by: string | null
  created_at: string
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
  unit_id?: string | null
}

export type ManagedProfile = {
  id: string
  email: string | null
  full_name: string | null
  unit: string | null
  unit_id?: string | null
  role: Role
  created_at: string
}

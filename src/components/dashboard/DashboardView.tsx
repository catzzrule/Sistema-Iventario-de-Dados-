import React, { useState, useMemo } from 'react'
import { Inventory, UserProfile, Role } from '../../types/inventory'
import { getInputValue, getHighestRisk } from '../../utils/lgpdRisk'
import { StatCard } from './StatCard'
import { RiskBadge } from '../common/RiskBadge'
import { UserManagementModal } from '../auth/UserManagementModal'
import {
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  FileCheck2,
  FileClock,
  Plus,
  Download,
  LogOut,
  Search,
  SlidersHorizontal,
  User,
  ShieldAlert,
  Inbox,
  Sparkles,
  Layers,
  ArrowUpRight,
  Trash2,
  Building2,
  FileSpreadsheet,
  UserPlus
} from 'lucide-react'

interface DashboardViewProps {
  user: UserProfile
  inventories: Inventory[]
  onNew: () => void
  onEdit: (inventory: Inventory) => void
  onDelete?: (id: string) => Promise<void>
  onLogout: () => void
  onExport: (unitFilter?: string) => void
  onCreateUser?: (params: {
    email: string
    fullName: string
    unit: string
    role: Role
    provisionalPassword?: string
  }) => Promise<{ tempPassword?: string }>
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  inventories,
  onNew,
  onEdit,
  onDelete,
  onLogout,
  onExport,
  onCreateUser
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'concluido' | 'rascunho'>('todos')
  const [riskFilter, setRiskFilter] = useState<'todos' | 'alto' | 'medio' | 'baixo'>('todos')
  const [unitFilter, setUnitFilter] = useState<string>('todas')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportUnitSelected, setExportUnitSelected] = useState<string>('todas')
  const [userModalOpen, setUserModalOpen] = useState(false)

  // Distinct units list for filtering and extraction
  const distinctUnits = useMemo(() => {
    const set = new Set<string>()
    inventories.forEach(i => {
      const u = getInputValue(i.form_data, 'unit').trim()
      if (u) set.add(u)
    })
    return Array.from(set).sort()
  }, [inventories])

  // Stats calculation
  const totalCount = inventories.length
  const highRiskCount = useMemo(
    () => inventories.filter(i => getHighestRisk(i.form_data) === 'alto').length,
    [inventories]
  )
  const completedCount = useMemo(
    () => inventories.filter(i => i.status === 'concluido').length,
    [inventories]
  )
  const draftCount = useMemo(
    () => inventories.filter(i => i.status !== 'concluido').length,
    [inventories]
  )

  // Filtered list
  const filteredInventories = useMemo(() => {
    return inventories.filter(item => {
      const title = (item.title || '').toLowerCase()
      const ref = (item.reference_id || '').toLowerCase()
      const system = getInputValue(item.form_data, 'system_name').toLowerCase()
      const unit = getInputValue(item.form_data, 'unit').toLowerCase()
      const purpose = getInputValue(item.form_data, 'purpose').toLowerCase()

      const matchesSearch =
        !searchTerm ||
        title.includes(searchTerm.toLowerCase()) ||
        ref.includes(searchTerm.toLowerCase()) ||
        system.includes(searchTerm.toLowerCase()) ||
        unit.includes(searchTerm.toLowerCase()) ||
        purpose.includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'todos'
          ? true
          : statusFilter === 'concluido'
          ? item.status === 'concluido'
          : item.status !== 'concluido'

      const highestRisk = getHighestRisk(item.form_data)
      const matchesRisk = riskFilter === 'todos' ? true : highestRisk === riskFilter

      const matchesUnit =
        unitFilter === 'todas'
          ? true
          : (getInputValue(item.form_data, 'unit') || 'Não informada').toLowerCase() === unitFilter.toLowerCase()

      return matchesSearch && matchesStatus && matchesRisk && matchesUnit
    })
  }, [inventories, searchTerm, statusFilter, riskFilter, unitFilter])

  const handleDeleteItem = async (e: React.MouseEvent, item: Inventory) => {
    e.stopPropagation()
    if (!onDelete) return
    const confirmed = window.confirm(
      `Deseja realmente apagar o inventário do processo "${item.title || 'Sem título'}" (${item.reference_id || 'ID N/A'})?\n\nEsta ação é irreversível.`
    )
    if (confirmed) {
      await onDelete(item.id)
    }
  }

  const handleExportConfirm = () => {
    onExport(exportUnitSelected)
    setExportModalOpen(false)
  }

  const isManager =
    user?.role === 'admin' ||
    user?.role === 'master' ||
    user?.email?.toLowerCase() === 'catzzrule65@gmail.com'

  return (
    <div className="dashboard-layout">
      {/* Ambient background glows */}
      <div className="ambient-glow glow-1" aria-hidden="true" />
      <div className="ambient-glow glow-2" aria-hidden="true" />

      {/* Navigation Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo shadow-emerald">
            <ShieldCheck size={26} />
          </div>
          <div>
            <span className="brand-title">Inventário LGPD</span>
            <span className="brand-subtitle">Plataforma de Governança Governamental</span>
          </div>
        </div>

        <div className="header-actions">
          {isManager && onCreateUser && (
            <button
              type="button"
              onClick={() => setUserModalOpen(true)}
              className="btn-secondary btn-sm"
              title="Cadastrar novos usuários e enviar senha provisória (TI)"
            >
              <UserPlus size={16} />
              <span>Usuários (TI)</span>
            </button>
          )}

          <div className="user-pill">
            <div className="user-avatar">
              <User size={16} />
            </div>
            <div className="user-info">
              <span className="user-email">{user.email}</span>
              <span className={`user-role role-${user.role}`}>
                {user.role === 'admin' ? 'Administrador (DPO / Gestor)' : user.role === 'master' ? 'Master (TI)' : 'Operador de Dados'}
              </span>
            </div>
          </div>

          <button onClick={onLogout} className="btn-icon" title="Sair do sistema" aria-label="Sair do sistema">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="dashboard-content">
        {/* Hero Welcome Banner */}
        <section className="dashboard-hero-banner">
          <div className="hero-banner-content">
            <div className="hero-badge-chip">
              <Sparkles size={14} className="sparkle-icon" />
              <span>PAINEL PRINCIPAL DE GOVERNANÇA LGPD</span>
            </div>

            <h1 className="hero-banner-title">
              Mapeamento de Processos <br />
              <span className="gradient-text">& Tratamento de Dados</span>
            </h1>

            <p className="hero-banner-desc">
              Gerencie inventários de dados pessoais, monitore processos em tempo real e gere relatórios consolidados por Unidade em conformidade com as diretrizes da ANPD e SGD/MGI.
            </p>

            <div className="hero-quick-stats">
              <div className="quick-stat-item">
                <span className="quick-stat-val">{totalCount}</span>
                <span className="quick-stat-lbl">Processos Ativos</span>
              </div>
              {isManager && (
                <>
                  <div className="quick-stat-divider" />
                  <div className="quick-stat-item">
                    <span className="quick-stat-val val-warning">{highRiskCount}</span>
                    <span className="quick-stat-lbl">Risco Alto</span>
                  </div>
                </>
              )}
              <div className="quick-stat-divider" />
              <div className="quick-stat-item">
                <span className="quick-stat-val val-success">{completedCount}</span>
                <span className="quick-stat-lbl">Concluídos</span>
              </div>
            </div>
          </div>

          <div className="hero-banner-actions">
            <button
              type="button"
              onClick={onNew}
              className="btn-primary btn-hero-cta shadow-emerald"
              id="btn-novo-inventario"
            >
              <Plus size={20} />
              <span>Novo Inventário de Processo</span>
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="btn-secondary btn-hero-secondary"
                title="Extrair planilha consolidada ou separada por unidade administrativa"
              >
                <Download size={18} />
                <span>Exportar Planilha (.CSV)</span>
              </button>
            )}
          </div>
        </section>

        {isManager && (
          <div className="admin-banner-enhanced">
            <div className="banner-icon-badge">
              <ShieldAlert size={20} />
            </div>
            <div>
              <strong>Modo Gestor / Encarregado (DPO / TI) Ativo</strong>
              <p>
                Você tem permissão para auditar todos os processos, acompanhar matrizes de risco, cadastrar novos usuários com senha provisória (TI), receber alertas específicos de titulares vulneráveis (Art. 14) e extrair planilhas por Unidade Administrativa.
              </p>
            </div>
          </div>
        )}

        {/* Modal de Gestão de Usuários (TI) */}
        {onCreateUser && (
          <UserManagementModal
            isOpen={userModalOpen}
            onClose={() => setUserModalOpen(false)}
            onCreateUser={onCreateUser}
          />
        )}

        {/* Modal de Extração por Unidade (Administrador) */}
        {exportModalOpen && (
          <div className="modal-backdrop-overlay" onClick={() => setExportModalOpen(false)}>
            <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon-badge">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3>Exportação de Planilha LGPD</h3>
                  <p>Selecione a Unidade Administrativa desejada para extração das informações:</p>
                </div>
              </div>

              <div className="modal-body margin-top">
                <div className="form-field">
                  <label htmlFor="export-unit-select">Filtrar por Unidade:</label>
                  <select
                    id="export-unit-select"
                    value={exportUnitSelected}
                    onChange={e => setExportUnitSelected(e.target.value)}
                    className="custom-select-large"
                  >
                    <option value="todas">📊 Todas as Unidades (Relatório Consolidado Completo - {inventories.length} processos)</option>
                    {distinctUnits.map(unit => {
                      const count = inventories.filter(
                        i => (getInputValue(i.form_data, 'unit') || '').toLowerCase() === unit.toLowerCase()
                      ).length
                      return (
                        <option key={unit} value={unit}>
                          🏢 Unidade: {unit} ({count} processo{count > 1 ? 's' : ''})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="export-notice-box margin-top-sm">
                  <p>
                    A planilha exportada é formatada para Microsoft Excel e Google Planilhas (CSV UTF-8 BOM), contendo as 28 colunas padronizadas do Guia 3 SGD/MGI.
                  </p>
                </div>
              </div>

              <div className="modal-footer margin-top">
                <button
                  type="button"
                  onClick={() => setExportModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExportConfirm}
                  className="btn-primary btn-sm shadow-emerald"
                >
                  <Download size={16} />
                  <span>Baixar Planilha</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistical Overview Cards */}
        <section className="stats-grid">
          <StatCard
            title="Total Registrado"
            value={totalCount}
            description="Processos mapeados"
            icon={<ClipboardList size={20} />}
            variant="primary"
          />
          {isManager && (
            <StatCard
              title="Risco Alto"
              value={highRiskCount}
              description="Requerem atenção"
              icon={<AlertTriangle size={20} />}
              variant="warning"
            />
          )}
          <StatCard
            title="Concluídos"
            value={completedCount}
            description="Mapeamentos finalizados"
            icon={<FileCheck2 size={20} />}
            variant="success"
          />
          <StatCard
            title="Em Rascunho"
            value={draftCount}
            description="Preenchimento pendente"
            icon={<FileClock size={20} />}
            variant="info"
          />
        </section>

        {/* Filters and Table Section */}
        <section className="table-card glass-card">
          {/* Quick Filter Tabs Header */}
          <div className="table-filter-tabs">
            <button
              className={`filter-tab ${statusFilter === 'todos' && riskFilter === 'todos' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('todos'); setRiskFilter('todos') }}
            >
              <Layers size={15} />
              <span>Todos ({totalCount})</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'concluido' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('concluido'); setRiskFilter('todos') }}
            >
              <FileCheck2 size={15} />
              <span>Concluídos ({completedCount})</span>
            </button>
            <button
              className={`filter-tab ${statusFilter === 'rascunho' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('rascunho'); setRiskFilter('todos') }}
            >
              <FileClock size={15} />
              <span>Rascunhos ({draftCount})</span>
            </button>
            {isManager && (
              <button
                className={`filter-tab ${riskFilter === 'alto' ? 'active' : ''}`}
                onClick={() => { setRiskFilter('alto'); setStatusFilter('todos') }}
              >
                <AlertTriangle size={15} />
                <span>Risco Alto ({highRiskCount})</span>
              </button>
            )}
          </div>

          <div className="table-toolbar">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por processo, sistema, unidade, ID ou finalidade..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filters-group">
              {/* Filtro por Unidade */}
              <div className="filter-item">
                <Building2 size={15} />
                <span>Unidade:</span>
                <select
                  value={unitFilter}
                  onChange={e => setUnitFilter(e.target.value)}
                >
                  <option value="todas">Todas as Unidades</option>
                  {distinctUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div className="filter-item">
                <SlidersHorizontal size={15} />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                >
                  <option value="todos">Todos</option>
                  <option value="concluido">Concluídos</option>
                  <option value="rascunho">Rascunhos</option>
                </select>
              </div>

              {isManager && (
                <div className="filter-item">
                  <span>Risco:</span>
                  <select
                    value={riskFilter}
                    onChange={e => setRiskFilter(e.target.value as any)}
                  >
                    <option value="todos">Todos os Riscos</option>
                    <option value="alto">Alto</option>
                    <option value="medio">Médio</option>
                    <option value="baixo">Baixo</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PROCESSO / SISTEMA / UNIDADE</th>
                  <th>ID REFERÊNCIA</th>
                  <th>ÚLTIMA ATUALIZAÇÃO</th>
                  <th>STATUS</th>
                  {isManager && <th>ANÁLISE DE RISCO</th>}
                  <th className="text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventories.length > 0 ? (
                  filteredInventories.map(item => {
                    const highestRisk = getHighestRisk(item.form_data)
                    const systemName = getInputValue(item.form_data, 'system_name')
                    const unitName = getInputValue(item.form_data, 'unit')
                    const purposeName = getInputValue(item.form_data, 'purpose')
                    const vulnerableGroups = (item.form_data.vulnerable_groups as string[]) || []
                    const hasVulnerableData = Boolean(getInputValue(item.form_data, 'data_subjects') || vulnerableGroups.length > 0)

                    return (
                      <tr key={item.id} className="table-row-hover">
                        <td className="cell-main">
                          <div className="process-title-row">
                            <span className="process-title">{item.title || 'Inventário de Processo'}</span>
                            {isManager && hasVulnerableData && (
                              <span className="badge-manager-tag" title="Atenção Gestor: Dados de titulares com salvaguardas especiais (Art. 14)">
                                ⚠️ Titulares Art. 14
                              </span>
                            )}
                          </div>
                          <div className="process-sub">
                            {unitName && <span className="unit-pill"><Building2 size={12} /> {unitName}</span>}
                            {systemName && <span className="system-pill">Sistema: {systemName}</span>}
                            {!unitName && !systemName && (purposeName ? `Finalidade: ${purposeName}` : 'Sem informações complementares')}
                          </div>
                        </td>
                        <td className="cell-ref">
                          <span className="code-badge">{item.reference_id || 'N/A'}</span>
                        </td>
                        <td className="cell-date">
                          {new Date(item.updated_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <span className={`status-pill status-${item.status}`}>
                            {item.status === 'concluido' ? 'Concluído' : 'Rascunho'}
                          </span>
                        </td>
                        {isManager && (
                          <td>
                            <RiskBadge risk={highestRisk} />
                          </td>
                        )}
                        <td className="text-right">
                          <div className="row-actions-group">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              className="btn-action-open"
                              title="Abrir e editar inventário"
                            >
                              <span>Abrir</span>
                              <ArrowUpRight size={15} />
                            </button>

                            {onDelete && (
                              <button
                                type="button"
                                onClick={e => handleDeleteItem(e, item)}
                                className="btn-action-delete"
                                title="Apagar este inventário"
                                aria-label="Apagar inventário"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={isManager ? 6 : 5} className="empty-state">
                      <Inbox size={46} className="empty-icon text-muted" />
                      <h3>Nenhum inventário encontrado</h3>
                      <p>Nenhum registro corresponde aos filtros selecionados. Crie um novo inventário de processo para começar.</p>
                      <button
                        type="button"
                        onClick={onNew}
                        className="btn-primary btn-sm margin-top shadow-emerald"
                      >
                        <Plus size={16} />
                        <span>Cadastrar Inventário de Processo</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}


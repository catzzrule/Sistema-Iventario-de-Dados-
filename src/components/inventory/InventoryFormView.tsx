import React, { useState, useMemo } from 'react'
import { Inventory, FormData, TableRow, TransferRow, ContractRow, UserProfile } from '../../types/inventory'
import {
  categoryGroups,
  sensitiveCategories,
  riskReport,
  getInputValue,
  getNotApplicable,
  NOT_APPLICABLE_LABEL
} from '../../utils/lgpdRisk'
import { isManagerRole } from '../../utils/roles'
import { SharingTable } from './SharingTable'
import { TransferTable } from './TransferTable'
import { ContractsTable } from './ContractsTable'
import { RiskDrawer } from './RiskDrawer'
import { RiskBadge } from '../common/RiskBadge'
import { BorderBeam } from '@/components/ui/border-beam'
import {
  ChevronLeft,
  ShieldCheck,
  Save,
  CheckCircle,
  Building,
  UserCheck,
  Layers,
  FileText,
  Lock,
  Globe,
  FileCode,
  Database,
  Users,
  Sparkles,
  Check,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Info
} from 'lucide-react'

interface InventoryFormViewProps {
  user?: UserProfile | null
  inventory: Inventory
  onBack: () => void
  onSave: (inventory: Inventory) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const TABS = [
  { id: 'identificacao', step: '1', title: '1–2 Identificação e Agentes', icon: <Building size={16} />, desc: 'Dados do processo, unidade e responsáveis' },
  { id: 'dados', step: '2', title: '3–9 Ciclo de Vida, Dados e Finalidade', icon: <Database size={16} />, desc: 'Base legal, categorias e retenção' },
  { id: 'titulares', step: '3', title: '10–11 Titulares e Compartilhamento', icon: <Users size={16} />, desc: 'Grupo de titulares e terceiros' },
  { id: 'seguranca', step: '4', title: '12–14 Segurança e Contratos', icon: <ShieldCheck size={16} />, desc: 'Controles, transferência e contratos' }
]

export const InventoryFormView: React.FC<InventoryFormViewProps> = ({
  user,
  inventory,
  onBack,
  onSave,
  onDelete
}) => {
  const [item, setItem] = useState<Inventory>(inventory)
  const [activeTab, setActiveTab] = useState('identificacao')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submittedAttempt, setSubmittedAttempt] = useState(false)
  const [saveError, setSaveError] = useState('')

  const risks = useMemo(() => riskReport(item.form_data), [item.form_data])

  const updateField = (key: string, value: any) => {
    setItem(prev => {
      const isTitle = key === 'title'
      const isRef = key === 'reference_id'
      return {
        ...prev,
        title: isTitle ? String(value) : prev.title,
        reference_id: isRef ? String(value) : prev.reference_id,
        form_data: {
          ...prev.form_data,
          [key]: value
        }
      }
    })
  }

  const toggleArrayItem = (key: string, value: string) => {
    const current = (item.form_data[key] as string[]) || []
    const updated = current.includes(value)
      ? current.filter(x => x !== value)
      : [...current, value]
    updateField(key, updated)
  }


  // "Não se aplica": a chave do campo fica registrada em form_data.not_applicable.
  // O campo deixa de ser obrigatório e o valor digitado é limpo, para não
  // misturar "não se aplica" com um valor preenchido.
  const isNA = (key: string) => getNotApplicable(item.form_data).includes(key)

  // Campos de tabela que também têm um formato antigo (texto livre) a limpar.
  const NA_LEGACY_KEYS: Record<string, string> = {
    international_transfers: 'international_transfer',
    contracts_list: 'contracts'
  }

  const toggleNA = (key: string, emptyValue: unknown = '') => {
    setItem(prev => {
      const current = getNotApplicable(prev.form_data)
      const turningOn = !current.includes(key)
      const form_data: FormData = {
        ...prev.form_data,
        not_applicable: turningOn ? [...current, key] : current.filter(k => k !== key)
      }
      if (turningOn && key !== 'reference_id') {
        form_data[key] = emptyValue
        if (NA_LEGACY_KEYS[key]) form_data[NA_LEGACY_KEYS[key]] = ''
      }
      return {
        ...prev,
        reference_id: turningOn && key === 'reference_id' ? '' : prev.reference_id,
        form_data
      }
    })
  }

  const naToggle = (key: string, emptyValue: unknown = '') => (
    <label className={`na-toggle ${isNA(key) ? 'active' : ''}`}>
      <input type="checkbox" checked={isNA(key)} onChange={() => toggleNA(key, emptyValue)} />
      <span>Não se aplica</span>
    </label>
  )

  const textValue = (key: string) => (isNA(key) ? NOT_APPLICABLE_LABEL : getInputValue(item.form_data, key))

  // Validation rules for concluding/submitting
  const validationErrors = useMemo(() => {
    const d = item.form_data
    const errors: { tab: string; field: string; message: string }[] = []
    const na = getNotApplicable(d)
    // Obrigatório = sem valor E sem "Não se aplica" (mesma regra do banco).
    const missing = (key: string) => !na.includes(key) && !getInputValue(d, key).trim()

    // Tab 1 (All fields mandatory)
    if (missing('system_name')) {
      errors.push({ tab: 'identificacao', field: 'system_name', message: '1.1 Sistema / Plataforma é obrigatório' })
    }
    if (!item.title.trim()) {
      errors.push({ tab: 'identificacao', field: 'title', message: '1.2 Nome do Serviço / Processo é obrigatório' })
    }
    if (!na.includes('reference_id') && !item.reference_id.trim()) {
      errors.push({ tab: 'identificacao', field: 'reference_id', message: '1.3 Nº de Referência / ID é obrigatório' })
    }
    if (missing('created_at')) {
      errors.push({ tab: 'identificacao', field: 'created_at', message: '1.4 Data de criação do mapeamento é obrigatória' })
    }
    if (missing('unit')) {
      errors.push({ tab: 'identificacao', field: 'unit', message: '1.5 Unidade / Departamento é obrigatório' })
    }
    if (missing('controller_name')) {
      errors.push({ tab: 'identificacao', field: 'controller_name', message: '2.1 Controlador (Nome / Órgão) é obrigatório' })
    }
    if (missing('controller_email')) {
      errors.push({ tab: 'identificacao', field: 'controller_email', message: 'E-mail do Controlador é obrigatório' })
    }
    if (missing('controller_phone')) {
      errors.push({ tab: 'identificacao', field: 'controller_phone', message: 'Telefone do Controlador é obrigatório' })
    }
    if (missing('dpo_name')) {
      errors.push({ tab: 'identificacao', field: 'dpo_name', message: '2.2 Encarregado (DPO - Nome) é obrigatório' })
    }
    if (missing('dpo_email')) {
      errors.push({ tab: 'identificacao', field: 'dpo_email', message: 'E-mail do Encarregado é obrigatório' })
    }
    if (missing('operator_name')) {
      errors.push({ tab: 'identificacao', field: 'operator_name', message: '2.3 Operador (Razão Social / Nome) é obrigatório' })
    }

    // Tab 2 (Required essential governance fields)
    const lifecycle = (d.lifecycle as string[]) || []
    if (!lifecycle.length) {
      errors.push({ tab: 'dados', field: 'lifecycle', message: '3. Fases do Ciclo de Vida: selecione ao menos uma etapa' })
    }
    if (missing('flow')) {
      errors.push({ tab: 'dados', field: 'flow', message: '4.1 Descrição do fluxo de tratamento é obrigatória' })
    }
    if (missing('geography')) {
      errors.push({ tab: 'dados', field: 'geography', message: '5.1 Abrangência geográfica é obrigatória' })
    }
    if (missing('data_source')) {
      errors.push({ tab: 'dados', field: 'data_source', message: '5.2 Fonte de coleta dos dados é obrigatória' })
    }
    if (missing('legal_basis')) {
      errors.push({ tab: 'dados', field: 'legal_basis', message: '6.1 Hipótese legal (Base Legal) é obrigatória' })
    }
    if (missing('purpose')) {
      errors.push({ tab: 'dados', field: 'purpose', message: '6.2 Finalidade específica do tratamento é obrigatória' })
    }
    const categories = (d.data_categories as string[]) || []
    if (!categories.length) {
      errors.push({ tab: 'dados', field: 'data_categories', message: '7. Categorias de Dados: selecione ao menos uma categoria' })
    }
    if (missing('retention_period')) {
      errors.push({ tab: 'dados', field: 'retention_period', message: '7. Tempo / Prazo de retenção é obrigatório' })
    }

    // Tab 3
    if (missing('data_subjects')) {
      errors.push({ tab: 'titulares', field: 'data_subjects', message: '10.1 Descrição dos grupos de titulares é obrigatória' })
    }

    // Tab 4
    if (!na.includes('security') && getInputValue(d, 'security').trim().length < 15) {
      errors.push({ tab: 'seguranca', field: 'security', message: '12.1 Medidas de segurança devem ser detalhadas (mín. 15 caracteres)' })
    }

    return errors
  }, [item])

  const isFieldInvalid = (fieldName: string) => {
    return submittedAttempt && validationErrors.some(e => e.field === fieldName)
  }

  async function handleSave(status?: string) {
    if (status === 'concluido') {
      setSubmittedAttempt(true)
      if (validationErrors.length > 0) {
        // Automatically switch to the tab that has the first error
        setActiveTab(validationErrors[0].tab)
        return
      }
    }

    setSaving(true)
    setSaveError('')
    try {
      const nextStatus = status || item.status || 'rascunho'
      await onSave({
        ...item,
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      if (nextStatus === 'concluido') {
        onBack()
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar o inventário.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    const confirmed = window.confirm('Tem certeza que deseja apagar este inventário de processo? Esta ação não pode ser desfeita.')
    if (!confirmed) return

    setDeleting(true)
    try {
      await onDelete(item.id)
      onBack()
    } finally {
      setDeleting(false)
    }
  }

  // Section 10 data verification for manager alert
  const hasSection10Data = useMemo(() => {
    const subjects = getInputValue(item.form_data, 'data_subjects').trim()
    const vulnerable = (item.form_data.vulnerable_groups as string[]) || []
    return Boolean(subjects || vulnerable.length > 0)
  }, [item.form_data])

  const isManager = isManagerRole(user?.role)

  return (
    <div className="form-page-layout">
      {/* Ambient background glow elements */}
      <div className="ambient-glow glow-1" aria-hidden="true" />
      <div className="ambient-glow glow-2" aria-hidden="true" />

      {/* Top Header */}
      <header className="app-header compact">
        <div className="header-brand">
          <div className="brand-logo shadow-emerald">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="brand-title">Inventário LGPD</span>
            <span className="brand-subtitle">Formulário de Mapeamento Governamental</span>
          </div>
        </div>

        <div className="header-actions">
          {onDelete && !item.id.startsWith('draft-') && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger-outline btn-sm"
              title="Excluir este inventário"
            >
              <Trash2 size={16} />
              <span>{deleting ? 'Apagando...' : 'Apagar Inventário'}</span>
            </button>
          )}

          <button onClick={onBack} className="btn-secondary btn-sm btn-hover-effect">
            <ChevronLeft size={16} />
            <span>Voltar ao Painel</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="form-container">
        {/* Title Header */}
        <section className="form-header">
          <div>
            <div className="eyebrow-tag flex-center-gap">
              <Sparkles size={13} className="sparkle-icon" />
              <span>GUIA 3 SGD/MGI — INVENTÁRIO DE DADOS</span>
            </div>
            <h1 className="form-page-title">
              {item.title ? item.title : 'Novo Inventário de Processo'}
            </h1>
            <p className="form-page-subtitle">
              Preencha os campos obrigatórios (*) ou marque "Não se aplica" quando o campo não fizer sentido para este processo.
            </p>
          </div>
          <div className="flex-center-gap">
            <span className={`status-pill status-${item.status} animated-pulse-pill`}>
              {item.status === 'concluido' ? 'Concluído' : 'Rascunho'}
            </span>
          </div>
        </section>

        {/* Validation Alert Notification if user tried to submit with errors */}
        {submittedAttempt && validationErrors.length > 0 && (
          <div className="validation-alert-banner">
            <div className="alert-header">
              <AlertTriangle size={20} className="alert-icon-warning" />
              <strong>Não é possível enviar: Existem {validationErrors.length} campos obrigatórios pendentes</strong>
            </div>
            <p className="alert-desc">
              Cada campo obrigatório (*) precisa ser preenchido ou marcado como "Não se aplica" para enviar o relatório.
            </p>
            <ul className="validation-error-list">
              {validationErrors.slice(0, 5).map((err, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    className="btn-link-error"
                    onClick={() => setActiveTab(err.tab)}
                  >
                    • {err.message} (Clique para ir)
                  </button>
                </li>
              ))}
              {validationErrors.length > 5 && (
                <li className="text-muted">... e mais {validationErrors.length - 5} campo(s).</li>
              )}
            </ul>
          </div>
        )}

        {saveError && (
          <div className="validation-alert-banner" role="alert">
            <div className="alert-header">
              <AlertTriangle size={20} className="alert-icon-warning" />
              <strong>Não foi possível salvar</strong>
            </div>
            <p className="alert-desc">{saveError}</p>
          </div>
        )}

        {/* Enhanced Stepper / Tabs */}
        <nav className="stepper-nav-enhanced">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id
            const tabErrors = submittedAttempt
              ? validationErrors.filter(e => e.tab === tab.id).length
              : 0

            return (
              <button
                key={tab.id}
                type="button"
                className={`stepper-tab-card ${isActive ? 'active' : ''} ${tabErrors > 0 ? 'has-errors' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="tab-card-header">
                  <div className={`tab-step-badge ${tabErrors > 0 ? 'badge-error' : ''}`}>
                    {tabErrors > 0 ? (
                      <AlertTriangle size={13} />
                    ) : isActive ? (
                      <Sparkles size={12} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="tab-card-icon">{tab.icon}</div>
                </div>

                <div className="tab-card-text">
                  <span className="tab-card-title">{tab.title}</span>
                  <span className="tab-card-desc">
                    {tabErrors > 0 ? `${tabErrors} pendência(s)` : tab.desc}
                  </span>
                </div>

                {isActive && <div className="tab-active-indicator" />}
              </button>
            )
          })}
        </nav>

        {/* Grid Layout (Form Content + Sidebar Drawer) */}
        <div className={`form-main-grid ${!isManager ? 'no-sidebar' : ''}`}>
          <section className="form-card-main glass-card relative overflow-hidden">
            <BorderBeam
              size={300}
              duration={15}
              delay={0}
              colorFrom="#059669"
              colorTo="#10b981"
              borderWidth={1.5}
              squircle={false}
            />

            {/* TAB 1: IDENTIFICAÇÃO E AGENTES (TODOS OBRIGATÓRIOS) */}
            {activeTab === 'identificacao' && (
              <div key="tab-1" className="tab-content animate-slide-fade">
                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Building size={18} /></div>
                    <div>
                      <h2>1 — Identificação do Serviço ou Processo de Negócio</h2>
                      <span className="section-badge-required">Campos obrigatórios * — preencha ou marque "Não se aplica"</span>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className={`form-field full-width ${isFieldInvalid('system_name') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="system_name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          1.1 — Nome do sistema / Plataforma *
                          <span title="Nome pelo qual o sistema é conhecido na unidade que o administra."><Info size={14} className="text-muted cursor-help" /></span>
                        </label>
                        {naToggle('system_name')}
                      </div>
                      <input
                        id="system_name"
                        disabled={isNA('system_name')}
                        type="text"
                        required={!isNA('system_name')}
                        value={textValue('system_name')}
                        onChange={e => updateField('system_name', e.target.value)}
                        placeholder="Ex.: CitSmart, TouchIP, Sistema RH, CRM ou Servidor Local"
                      />
                      {isFieldInvalid('system_name') && (
                        <span className="error-hint">Campo obrigatório</span>
                      )}
                    </div>

                    <div className={`form-field ${isFieldInvalid('system_development') ? 'field-error' : ''}`}>
                      <label htmlFor="system_development" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        1.1a — Sistema (Desenvolvimento)
                        <span title="Classificação do sistema quanto ao desenvolvimento."><Info size={14} className="text-muted cursor-help" /></span>
                      </label>
                      <select
                        id="system_development"
                        value={getInputValue(item.form_data, 'system_development')}
                        onChange={e => updateField('system_development', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Desenvolvido pela CGTI">1. Desenvolvido pela CGTI</option>
                        <option value="Desenvolvido pela própria área">2. Desenvolvido pela própria área</option>
                        <option value="Desenvolvido por ator externo ao MEsp">3. Desenvolvido por ator externo ao MEsp</option>
                        <option value="Ready to Use Software (RUSP)">4. Ready to Use Software (RUSP)</option>
                      </select>
                    </div>

                    <div className={`form-field ${isFieldInvalid('system_architecture') ? 'field-error' : ''}`}>
                      <label htmlFor="system_architecture" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        1.1b — Sistema (Arquitetura)
                        <span title="Classificação do sistema quanto à arquitetura do software."><Info size={14} className="text-muted cursor-help" /></span>
                      </label>
                      <select
                        id="system_architecture"
                        value={getInputValue(item.form_data, 'system_architecture')}
                        onChange={e => updateField('system_architecture', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Desktop (executa integralmente na própria máquina do usuário)">1. Desktop (executa integralmente na própria máquina do usuário)</option>
                        <option value="Cliente/servidor (Web)">2. Cliente/servidor (Web)</option>
                        <option value="Cliente/servidor (não Web)">3. Cliente/servidor (não Web)</option>
                      </select>
                    </div>

                    <div className={`form-field ${isFieldInvalid('system_hosting') ? 'field-error' : ''}`}>
                      <label htmlFor="system_hosting" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        1.1c — Sistema (Hospedagem)
                        <span title="Classificação do sistema quanto ao local em que o sistema está hospedado."><Info size={14} className="text-muted cursor-help" /></span>
                      </label>
                      <select
                        id="system_hosting"
                        value={getInputValue(item.form_data, 'system_hosting')}
                        onChange={e => updateField('system_hosting', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Hospedado na Dataprev">1. Hospedado na Dataprev</option>
                        <option value="Hospedado no Serpro">2. Hospedado no Serpro</option>
                        <option value="Hospedado em outro local (externo ao MEsp)">3. Hospedado em outro local (externo ao MEsp)</option>
                        <option value="Hospedado em outro local (interno ao MEsp)">4. Hospedado em outro local (interno ao MEsp)</option>
                      </select>
                    </div>

                    <div className={`form-field ${isFieldInvalid('system_start_date') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="system_start_date" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          1.1d — Data de início do funcionamento
                          <span title="Data da entrada em operação do sistema."><Info size={14} className="text-muted cursor-help" /></span>
                        </label>
                        {naToggle('system_start_date')}
                      </div>
                      <input
                        id="system_start_date"
                        disabled={isNA('system_start_date')}
                        type={isNA('system_start_date') ? 'text' : 'date'}
                        value={textValue('system_start_date')}
                        onChange={e => updateField('system_start_date', e.target.value)}
                      />
                    </div>

                    <div className={`form-field full-width ${isFieldInvalid('title') ? 'field-error' : ''}`}>
                      <label htmlFor="title">1.2 — Nome do Serviço / Processo de Negócio *</label>
                      <input
                        id="title"
                        type="text"
                        required
                        value={item.title}
                        onChange={e => updateField('title', e.target.value)}
                        placeholder="Ex.: Gestão da Folha de Pagamento dos Servidores"
                      />
                      {isFieldInvalid('title') && (
                        <span className="error-hint">Campo obrigatório</span>
                      )}
                    </div>

                    <div className={`form-field ${isFieldInvalid('reference_id') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="reference_id">1.3 — Nº de Referência / Código ID *</label>
                        {naToggle('reference_id')}
                      </div>
                      <input
                        id="reference_id"
                        disabled={isNA('reference_id')}
                        type="text"
                        required={!isNA('reference_id')}
                        value={isNA('reference_id') ? NOT_APPLICABLE_LABEL : item.reference_id}
                        onChange={e => updateField('reference_id', e.target.value)}
                        placeholder="Ex.: PROC-2026-084"
                      />
                      {isFieldInvalid('reference_id') && (
                        <span className="error-hint">Campo obrigatório</span>
                      )}
                    </div>

                    <div className={`form-field ${isFieldInvalid('created_at') ? 'field-error' : ''}`}>
                      <label htmlFor="created_at">1.4 — Data de criação do mapeamento *</label>
                      <input
                        id="created_at"
                        type="date"
                        required
                        value={getInputValue(item.form_data, 'created_at')}
                        onChange={e => updateField('created_at', e.target.value)}
                      />
                      {isFieldInvalid('created_at') && (
                        <span className="error-hint">Campo obrigatório</span>
                      )}
                    </div>

                    <div className={`form-field full-width ${isFieldInvalid('unit') ? 'field-error' : ''}`}>
                      <label htmlFor="unit">1.5 — Unidade Administrativa / Setor / Departamento *</label>
                      <input
                        id="unit"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'unit')}
                        onChange={e => updateField('unit', e.target.value)}
                        placeholder="Ex.: Secretaria de Administração, Diretoria de TI, Gabinete, Recursos Humanos..."
                      />
                      {isFieldInvalid('unit') && (
                        <span className="error-hint">Campo obrigatório — Utilizado para agrupamento e extração de planilhas</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><UserCheck size={18} /></div>
                    <div>
                      <h2>2 — Agentes de Tratamento e Encarregado (DPO)</h2>
                      <span className="section-badge-required">Campos obrigatórios * — preencha ou marque "Não se aplica"</span>
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className={`form-field ${isFieldInvalid('controller_name') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="controller_name">2.1 — Controlador (Nome / Órgão) *</label>
                        {naToggle('controller_name')}
                      </div>
                      <input
                        id="controller_name"
                        disabled={isNA('controller_name')}
                        type="text"
                        required={!isNA('controller_name')}
                        value={textValue('controller_name')}
                        onChange={e => updateField('controller_name', e.target.value)}
                        placeholder="Ex.: Ministério / Empresa X"
                      />
                      {isFieldInvalid('controller_name') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('controller_email') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="controller_email">E-mail do Controlador *</label>
                        {naToggle('controller_email')}
                      </div>
                      <input
                        id="controller_email"
                        disabled={isNA('controller_email')}
                        type="email"
                        required={!isNA('controller_email')}
                        value={textValue('controller_email')}
                        onChange={e => updateField('controller_email', e.target.value)}
                        placeholder="controlador@orgao.gov.br"
                      />
                      {isFieldInvalid('controller_email') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('controller_phone') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="controller_phone">Telefone do Controlador *</label>
                        {naToggle('controller_phone')}
                      </div>
                      <input
                        id="controller_phone"
                        disabled={isNA('controller_phone')}
                        type="text"
                        required={!isNA('controller_phone')}
                        value={textValue('controller_phone')}
                        onChange={e => updateField('controller_phone', e.target.value)}
                        placeholder="(61) 99999-0000"
                      />
                      {isFieldInvalid('controller_phone') && <span className="error-hint">Obrigatório</span>}
                    </div>
                  </div>

                  <div className="form-grid-3 margin-top">
                    <div className={`form-field ${isFieldInvalid('dpo_name') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="dpo_name">2.2 — Encarregado (DPO - Nome) *</label>
                        {naToggle('dpo_name')}
                      </div>
                      <input
                        id="dpo_name"
                        disabled={isNA('dpo_name')}
                        type="text"
                        required={!isNA('dpo_name')}
                        value={textValue('dpo_name')}
                        onChange={e => updateField('dpo_name', e.target.value)}
                        placeholder="Nome do Encarregado de Dados"
                      />
                      {isFieldInvalid('dpo_name') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('dpo_email') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="dpo_email">E-mail do Encarregado *</label>
                        {naToggle('dpo_email')}
                      </div>
                      <input
                        id="dpo_email"
                        disabled={isNA('dpo_email')}
                        type="email"
                        required={!isNA('dpo_email')}
                        value={textValue('dpo_email')}
                        onChange={e => updateField('dpo_email', e.target.value)}
                        placeholder="dpo@orgao.gov.br"
                      />
                      {isFieldInvalid('dpo_email') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('operator_name') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="operator_name">2.3 — Operador (Razão Social / Nome) *</label>
                        {naToggle('operator_name')}
                      </div>
                      <input
                        id="operator_name"
                        disabled={isNA('operator_name')}
                        type="text"
                        required={!isNA('operator_name')}
                        value={textValue('operator_name')}
                        onChange={e => updateField('operator_name', e.target.value)}
                        placeholder="Ex.: Empresa prestadora de TI contratada"
                      />
                      {isFieldInvalid('operator_name') && <span className="error-hint">Obrigatório</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DADOS E FINALIDADE */}
            {activeTab === 'dados' && (
              <div key="tab-2" className="tab-content animate-slide-fade">
                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Layers size={18} /></div>
                    <h2>3 — Fases do Ciclo de Vida do Tratamento *</h2>
                  </div>
                  <p className="help-text">Selecione todas as etapas em que os dados passam nesta atividade:</p>
                  <div className={`chips-container ${isFieldInvalid('lifecycle') ? 'field-error-container' : ''}`}>
                    {['Coleta', 'Retenção', 'Processamento', 'Compartilhamento', 'Eliminação'].map(opt => {
                      const active = ((item.form_data.lifecycle as string[]) || []).includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`chip ${active ? 'chip-active' : ''}`}
                          onClick={() => toggleArrayItem('lifecycle', opt)}
                        >
                          {active && <Check size={13} className="chip-check-icon" />}
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                  {isFieldInvalid('lifecycle') && <span className="error-hint">Selecione ao menos uma fase</span>}

                  <div className="form-field full-width margin-top">
                    <div className="field-label-row">
                      <label htmlFor="lifecycle_description">3.1 — Em qual fase do ciclo de vida o Operador atua</label>
                      {naToggle('lifecycle_description')}
                    </div>
                    <textarea
                      id="lifecycle_description"
                      disabled={isNA('lifecycle_description')}
                      rows={2}
                      value={textValue('lifecycle_description')}
                      onChange={e => updateField('lifecycle_description', e.target.value)}
                      placeholder="Ex.: O Operador atua na fase de Processamento, executando o cálculo do benefício a partir dos dados coletados pela área de RH."
                    />
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>4 — Descrição do Fluxo e Forma de Tratamento *</h2>
                  </div>
                  <div className={`form-field full-width ${isFieldInvalid('flow') ? 'field-error' : ''}`}>
                    <div className="field-label-row">
                      <label htmlFor="flow">4.1 — Descrição do fluxo de tratamento de dados pessoais *</label>
                      {naToggle('flow')}
                    </div>
                    <textarea
                      id="flow"
                      disabled={isNA('flow')}
                      rows={3}
                      required={!isNA('flow')}
                      value={textValue('flow')}
                      onChange={e => updateField('flow', e.target.value)}
                      placeholder="Detalhamento desde a entrada/recebimento do dado, locais de armazenamento, sistemas envolvidos até o descarte seguro."
                    />
                    {isFieldInvalid('flow') && <span className="error-hint">Campo obrigatório</span>}
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>5 — Escopo, Fonte e Abrangência Geográfica *</h2>
                  </div>
                  <div className="form-grid-2">
                    <div className={`form-field ${isFieldInvalid('geography') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="geography">5.1 — Abrangência geográfica do tratamento *</label>
                        {naToggle('geography')}
                      </div>
                      <input
                        id="geography"
                        disabled={isNA('geography')}
                        type="text"
                        required={!isNA('geography')}
                        value={textValue('geography')}
                        onChange={e => updateField('geography', e.target.value)}
                        placeholder="Ex.: Nacional, Estadual ou Municipal"
                      />
                      {isFieldInvalid('geography') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className={`form-field ${isFieldInvalid('data_source') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="data_source">5.2 — Fonte de coleta dos dados *</label>
                        {naToggle('data_source')}
                      </div>
                      <input
                        id="data_source"
                        disabled={isNA('data_source')}
                        type="text"
                        required={!isNA('data_source')}
                        value={textValue('data_source')}
                        onChange={e => updateField('data_source', e.target.value)}
                        placeholder="Ex.: Coleta direta pelo formulário web, API externa..."
                      />
                      {isFieldInvalid('data_source') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>6 — Finalidade e Hipótese Legal (Art. 7º LGPD) *</h2>
                  </div>
                  <div className="form-grid-2">
                    <div className={`form-field full-width ${isFieldInvalid('legal_basis') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="legal_basis">6.1 — Hipótese legal de tratamento (Base Legal) *</label>
                        {naToggle('legal_basis')}
                      </div>
                      <input
                        id="legal_basis"
                        disabled={isNA('legal_basis')}
                        type="text"
                        required={!isNA('legal_basis')}
                        value={textValue('legal_basis')}
                        onChange={e => updateField('legal_basis', e.target.value)}
                        placeholder="Ex.: Cumprimento de obrigação legal (Art. 7º, II) ou Execução de políticas públicas (Art. 7º, III)"
                      />
                      {isFieldInvalid('legal_basis') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className={`form-field full-width ${isFieldInvalid('purpose') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="purpose">6.2 — Finalidade específica do tratamento *</label>
                        {naToggle('purpose')}
                      </div>
                      <textarea
                        id="purpose"
                        disabled={isNA('purpose')}
                        rows={2}
                        required={!isNA('purpose')}
                        value={textValue('purpose')}
                        onChange={e => updateField('purpose', e.target.value)}
                        placeholder="Descreva a razão de ser da coleta desse dado pessoal para o processo..."
                      />
                      {isFieldInvalid('purpose') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className="form-field full-width">
                      <div className="field-label-row">
                        <label htmlFor="legal_provision">6.3 — Previsão legal</label>
                        {naToggle('legal_provision')}
                      </div>
                      <textarea
                        id="legal_provision"
                        disabled={isNA('legal_provision')}
                        rows={2}
                        value={textValue('legal_provision')}
                        onChange={e => updateField('legal_provision', e.target.value)}
                        placeholder="Ex.: Lei nº 8.112/1990, Decreto nº 9.991/2019, art. 15 da Portaria XX/2020..."
                      />
                    </div>
                    <div className="form-field full-width">
                      <div className="field-label-row">
                        <label htmlFor="expected_results">6.4 — Resultados pretendidos para o titular de dados</label>
                        {naToggle('expected_results')}
                      </div>
                      <textarea
                        id="expected_results"
                        disabled={isNA('expected_results')}
                        rows={2}
                        value={textValue('expected_results')}
                        onChange={e => updateField('expected_results', e.target.value)}
                        placeholder="Ex.: Recebimento do benefício, emissão do documento, acesso ao serviço solicitado..."
                      />
                    </div>
                    <div className="form-field full-width">
                      <div className="field-label-row">
                        <label htmlFor="expected_benefits">6.5 — Benefícios esperados para o órgão, entidade ou sociedade</label>
                        {naToggle('expected_benefits')}
                      </div>
                      <textarea
                        id="expected_benefits"
                        disabled={isNA('expected_benefits')}
                        rows={2}
                        value={textValue('expected_benefits')}
                        onChange={e => updateField('expected_benefits', e.target.value)}
                        placeholder="Ex.: Melhoria na gestão do programa, redução de fraudes, cumprimento de política pública..."
                      />
                    </div>
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Layers size={18} /></div>
                    <h2>7 — Categorias de Dados Pessoais Tradicionais *</h2>
                  </div>
                  {categoryGroups.map((group, idx) => (
                    <div key={idx} className="chips-group">
                      {group.map(cat => {
                        const active = ((item.form_data.data_categories as string[]) || []).includes(cat)
                        return (
                          <button
                            key={cat}
                            type="button"
                            className={`chip ${active ? 'chip-active' : ''}`}
                            onClick={() => toggleArrayItem('data_categories', cat)}
                          >
                            {active && <Check size={13} className="chip-check-icon" />}
                            <span>{cat}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  {isFieldInvalid('data_categories') && <span className="error-hint">Selecione ao menos uma categoria</span>}

                  <div className="form-field full-width margin-top">
                    <div className="field-label-row">
                      <label htmlFor="data_categories_description">Descrição dos dados coletados nessas categorias</label>
                      {naToggle('data_categories_description')}
                    </div>
                    <textarea
                      id="data_categories_description"
                      disabled={isNA('data_categories_description')}
                      rows={2}
                      value={textValue('data_categories_description')}
                      onChange={e => updateField('data_categories_description', e.target.value)}
                      placeholder="Ex.: Nome completo, CPF, data de nascimento e endereço residencial dos servidores ativos."
                    />
                  </div>

                  <div className="form-grid-2 margin-top">
                    <div className={`form-field ${isFieldInvalid('retention_period') ? 'field-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="retention_period">Tempo / Prazo de retenção dos dados *</label>
                        {naToggle('retention_period')}
                      </div>
                      <input
                        id="retention_period"
                        disabled={isNA('retention_period')}
                        type="text"
                        required={!isNA('retention_period')}
                        value={textValue('retention_period')}
                        onChange={e => updateField('retention_period', e.target.value)}
                        placeholder="Ex.: 5 anos após o término do vínculo contrato"
                      />
                      {isFieldInvalid('retention_period') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className="form-field">
                      <div className="field-label-row">
                        <label htmlFor="database">Nome do Banco de Dados / Tabela</label>
                        {naToggle('database')}
                      </div>
                      <input
                        id="database"
                        disabled={isNA('database')}
                        type="text"
                        value={textValue('database')}
                        onChange={e => updateField('database', e.target.value)}
                        placeholder="Ex.: db_servidores.tb_cadastro"
                      />
                    </div>
                  </div>
                </div>

                <div className="section-block alert-section">
                  <div className="section-title">
                    <div className="title-icon-badge badge-warning"><ShieldCheck size={18} /></div>
                    <h2>8 — Categorias de Dados Pessoais Sensíveis (Art. 5º, II da LGPD)</h2>
                  </div>
                  <p className="help-text">Marque se este processo envolve qualquer um dos dados abaixo:</p>
                  <div className="chips-container">
                    {sensitiveCategories.map(sCat => {
                      const active = ((item.form_data.sensitive_categories as string[]) || []).includes(sCat)
                      return (
                        <button
                          key={sCat}
                          type="button"
                          className={`chip chip-sensitive ${active ? 'chip-sensitive-active' : ''}`}
                          onClick={() => toggleArrayItem('sensitive_categories', sCat)}
                        >
                          {active && <Check size={13} className="chip-check-icon" />}
                          <span>{sCat}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="form-field full-width margin-top">
                    <div className="field-label-row">
                      <label htmlFor="sensitive_categories_description">Descrição dos dados sensíveis coletados</label>
                      {naToggle('sensitive_categories_description')}
                    </div>
                    <textarea
                      id="sensitive_categories_description"
                      disabled={isNA('sensitive_categories_description')}
                      rows={2}
                      value={textValue('sensitive_categories_description')}
                      onChange={e => updateField('sensitive_categories_description', e.target.value)}
                      placeholder="Ex.: Laudo médico de aptidão física, exigido apenas para o cargo de agente de segurança."
                    />
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>9 — Frequência e Estimativa de Volume</h2>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-field">
                      <div className="field-label-row">
                        <label htmlFor="frequency">9.1 — Frequência do tratamento</label>
                        {naToggle('frequency')}
                      </div>
                      <input
                        id="frequency"
                        disabled={isNA('frequency')}
                        type="text"
                        value={textValue('frequency')}
                        onChange={e => updateField('frequency', e.target.value)}
                        placeholder="Ex.: Contínua, Mensal, Anual, Sob demanda"
                      />
                    </div>
                    <div className="form-field">
                      <div className="field-label-row">
                        <label htmlFor="data_volume">9.2 — Quantidade aproximada de titulares</label>
                        {naToggle('data_volume')}
                      </div>
                      <input
                        id="data_volume"
                        disabled={isNA('data_volume')}
                        type="text"
                        value={textValue('data_volume')}
                        onChange={e => updateField('data_volume', e.target.value)}
                        placeholder="Ex.: ~5.000 usuários ativos"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TITULARES E COMPARTILHAMENTO (COM ALERTA EXCLUSIVO PARA O GESTOR NO CAMPO 10) */}
            {activeTab === 'titulares' && (
              <div key="tab-3" className="tab-content animate-slide-fade">
                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Users size={18} /></div>
                    <h2>10 — Categorias dos Titulares de Dados Pessoais</h2>
                  </div>

                  {/* ALERTA EXCLUSIVO PARA O GESTOR QUANDO HÁ PREENCHIMENTO DO CAMPO 10 */}
                  {isManager && hasSection10Data && (
                    <div className="manager-risk-alert-box animate-pulse-subtle">
                      <div className="manager-alert-header">
                        <ShieldAlert size={22} className="text-warning-bold" />
                        <div>
                          <strong>ALERTA EXCLUSIVO PARA O GESTOR / DPO (Art. 14 LGPD)</strong>
                          <p>
                            Atenção Gestor: Foram inseridos dados de titulares / grupos especiais no campo 10.
                            Certifique-se de validar se há base legal com salvaguardas reforçadas, verificação de melhor interesse e realização de Relatório de Impacto à Proteção de Dados (RIPD/DPIA).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`form-field full-width ${isFieldInvalid('data_subjects') ? 'field-error' : ''}`}>
                    <div className="field-label-row">
                      <label htmlFor="data_subjects">10.1 — Descrição dos grupos de titulares *</label>
                      {naToggle('data_subjects')}
                    </div>
                    <textarea
                      id="data_subjects"
                      disabled={isNA('data_subjects')}
                      rows={3}
                      required={!isNA('data_subjects')}
                      value={textValue('data_subjects')}
                      onChange={e => updateField('data_subjects', e.target.value)}
                      placeholder="Ex.: Servidores públicos ativos, inativos, pensionistas, cidadãos solicitantes e dependentes declarados."
                    />
                    {isFieldInvalid('data_subjects') && <span className="error-hint">Campo obrigatório</span>}
                  </div>

                  <div className="margin-top">
                    <label className="checkbox-field custom-checkbox">
                      <input
                        type="checkbox"
                        checked={((item.form_data.vulnerable_groups as string[]) || []).includes('criancas')}
                        onChange={() => toggleArrayItem('vulnerable_groups', 'criancas')}
                      />
                      <span>10.3 — Trata dados de crianças e adolescentes (Art. 14 da LGPD)</span>
                    </label>

                    <label className="checkbox-field custom-checkbox margin-top-sm">
                      <input
                        type="checkbox"
                        checked={((item.form_data.vulnerable_groups as string[]) || []).includes('vulneraveis')}
                        onChange={() => toggleArrayItem('vulnerable_groups', 'vulneraveis')}
                      />
                      <span>10.4 — Trata dados de outros grupos vulneráveis (idosos, PCDs, refugiados)</span>
                    </label>
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title section-title-with-na">
                    <div className="title-icon-badge"><Building size={18} /></div>
                    <h2>11 — Compartilhamento de Dados Pessoais</h2>
                    {naToggle('sharing', [])}
                  </div>
                  {isNA('sharing') ? (
                    <p className="na-section-note">{NOT_APPLICABLE_LABEL} — não há compartilhamento de dados pessoais neste processo.</p>
                  ) : (
                    <SharingTable
                      sharing={(item.form_data.sharing as TableRow[]) || []}
                      onChange={newList => updateField('sharing', newList)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: SEGURANÇA E CONTRATOS */}
            {activeTab === 'seguranca' && (
              <div key="tab-4" className="tab-content animate-slide-fade">
                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Lock size={18} /></div>
                    <h2>12 — Medidas de Segurança, Técnicas e Administrativas *</h2>
                  </div>
                  <div className="form-field full-width">
                    <div className="field-label-row">
                      <label htmlFor="security_type">Tipo de medida de segurança e privacidade</label>
                      {naToggle('security_type')}
                    </div>
                    <input
                      id="security_type"
                      disabled={isNA('security_type')}
                      type="text"
                      value={textValue('security_type')}
                      onChange={e => updateField('security_type', e.target.value)}
                      placeholder="Ex.: Controle de acesso, criptografia, backup, auditoria de logs"
                    />
                  </div>
                  <div className={`form-field full-width margin-top-xs ${isFieldInvalid('security') ? 'field-error' : ''}`}>
                    <div className="field-label-row">
                      <label htmlFor="security">12.1 — Descrição do(s) controle(s) de segurança aplicado(s) *</label>
                      {naToggle('security')}
                    </div>
                    <textarea
                      id="security"
                      disabled={isNA('security')}
                      rows={4}
                      required={!isNA('security')}
                      value={textValue('security')}
                      onChange={e => updateField('security', e.target.value)}
                      placeholder="Ex.: Autenticação multifator (MFA), perfis de acesso restritos por papel, criptografia SSL/TLS em trânsito e repositório, política de backup diário e logs de auditoria imutáveis."
                    />
                    {isFieldInvalid('security') && (
                      <span className="error-hint">Descreva as medidas de segurança adotadas (mín. 15 caracteres)</span>
                    )}
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title section-title-with-na">
                    <div className="title-icon-badge"><Globe size={18} /></div>
                    <h2>13 — Transferência Internacional de Dados Pessoais</h2>
                    {naToggle('international_transfers', [])}
                  </div>
                  {isNA('international_transfers') ? (
                    <p className="na-section-note">{NOT_APPLICABLE_LABEL} — não há transferência internacional de dados.</p>
                  ) : (
                  <TransferTable
                    transfers={
                      (item.form_data.international_transfers as TransferRow[]) ||
                      (getInputValue(item.form_data, 'international_transfer').trim()
                        ? [{ country: '', data: '', guarantee: getInputValue(item.form_data, 'international_transfer') }]
                        : [])
                    }
                    onChange={newList => updateField('international_transfers', newList)}
                  />
                  )}
                </div>

                <div className="section-block">
                  <div className="section-title section-title-with-na">
                    <div className="title-icon-badge"><FileCode size={18} /></div>
                    <h2>14 — Contratos de Serviços / Soluções de TI Envolvidos</h2>
                    {naToggle('contracts_list', [])}
                  </div>
                  {isNA('contracts_list') ? (
                    <p className="na-section-note">{NOT_APPLICABLE_LABEL} — não há contratos de TI envolvidos.</p>
                  ) : (
                  <ContractsTable
                    contracts={
                      (item.form_data.contracts_list as ContractRow[]) ||
                      (getInputValue(item.form_data, 'contracts').trim()
                        ? [{ number: '', object: getInputValue(item.form_data, 'contracts'), managerEmail: '' }]
                        : [])
                    }
                    onChange={newList => updateField('contracts_list', newList)}
                  />
                  )}
                </div>

                {/* Direct Risk Report Inside Security Tab (Only for Gestores) */}
                {isManager && (
                  <div className="section-block risk-details-block">
                    <div className="section-title">
                      <div className="title-icon-badge"><ShieldCheck size={18} /></div>
                      <h2>Diagnóstico Detalhado do Motor de Risco LGPD</h2>
                    </div>
                    <div className="risk-details-list">
                      {risks.map((r, i) => (
                        <div key={i} className={`risk-detail-card level-${r.level}`}>
                          <RiskBadge risk={r.level} />
                          <p>{r.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Side Drawer Component (Only for Gestores) */}
          {isManager && (
            <RiskDrawer
              risks={risks}
              status={item.status}
              lastUpdated={item.updated_at}
              onGoToSecurityTab={() => setActiveTab('seguranca')}
            />
          )}
        </div>

        {/* Sticky Action Footer */}
        <footer className="form-sticky-actions">
          <div className="footer-content">
            {onDelete && !item.id.startsWith('draft-') && (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 size={18} />
                <span>{deleting ? 'Apagando...' : 'Apagar Inventário'}</span>
              </button>
            )}

            <div className="footer-right-actions">
              <button
                type="button"
                className="btn-secondary btn-hover-effect"
                onClick={() => handleSave('rascunho')}
                disabled={saving || deleting}
              >
                <Save size={18} />
                <span>{saving ? 'Salvando...' : 'Salvar Rascunho'}</span>
              </button>

              <button
                type="button"
                className="btn-primary btn-hover-effect shadow-emerald"
                onClick={() => handleSave('concluido')}
                disabled={saving || deleting}
              >
                <CheckCircle size={18} />
                <span>{saving ? 'Gravando...' : 'Concluir & Enviar Inventário'}</span>
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

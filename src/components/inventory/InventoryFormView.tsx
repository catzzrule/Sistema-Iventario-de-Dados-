import React, { useState, useMemo } from 'react'
import { Inventory, FormData, TableRow, UserProfile } from '../../types/inventory'
import { categoryGroups, sensitiveCategories, riskReport, getInputValue } from '../../utils/lgpdRisk'
import { SharingTable } from './SharingTable'
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

  // Validation rules for concluding/submitting
  const validationErrors = useMemo(() => {
    const d = item.form_data
    const errors: { tab: string; field: string; message: string }[] = []

    // Tab 1 (All fields mandatory)
    if (!getInputValue(d, 'system_name').trim()) {
      errors.push({ tab: 'identificacao', field: 'system_name', message: '1.1 Sistema / Plataforma é obrigatório' })
    }
    if (!item.title.trim()) {
      errors.push({ tab: 'identificacao', field: 'title', message: '1.2 Nome do Serviço / Processo é obrigatório' })
    }
    if (!item.reference_id.trim()) {
      errors.push({ tab: 'identificacao', field: 'reference_id', message: '1.3 Nº de Referência / ID é obrigatório' })
    }
    if (!getInputValue(d, 'created_at').trim()) {
      errors.push({ tab: 'identificacao', field: 'created_at', message: '1.4 Data de criação do mapeamento é obrigatória' })
    }
    if (!getInputValue(d, 'unit').trim()) {
      errors.push({ tab: 'identificacao', field: 'unit', message: '1.5 Unidade / Departamento é obrigatório' })
    }
    if (!getInputValue(d, 'controller_name').trim()) {
      errors.push({ tab: 'identificacao', field: 'controller_name', message: '2.1 Controlador (Nome / Órgão) é obrigatório' })
    }
    if (!getInputValue(d, 'controller_email').trim()) {
      errors.push({ tab: 'identificacao', field: 'controller_email', message: 'E-mail do Controlador é obrigatório' })
    }
    if (!getInputValue(d, 'controller_phone').trim()) {
      errors.push({ tab: 'identificacao', field: 'controller_phone', message: 'Telefone do Controlador é obrigatório' })
    }
    if (!getInputValue(d, 'dpo_name').trim()) {
      errors.push({ tab: 'identificacao', field: 'dpo_name', message: '2.2 Encarregado (DPO - Nome) é obrigatório' })
    }
    if (!getInputValue(d, 'dpo_email').trim()) {
      errors.push({ tab: 'identificacao', field: 'dpo_email', message: 'E-mail do Encarregado é obrigatório' })
    }
    if (!getInputValue(d, 'operator_name').trim()) {
      errors.push({ tab: 'identificacao', field: 'operator_name', message: '2.3 Operador (Razão Social / Nome) é obrigatório' })
    }

    // Tab 2 (Required essential governance fields)
    const lifecycle = (d.lifecycle as string[]) || []
    if (!lifecycle.length) {
      errors.push({ tab: 'dados', field: 'lifecycle', message: '3. Fases do Ciclo de Vida: selecione ao menos uma etapa' })
    }
    if (!getInputValue(d, 'flow').trim()) {
      errors.push({ tab: 'dados', field: 'flow', message: '4.1 Descrição do fluxo de tratamento é obrigatória' })
    }
    if (!getInputValue(d, 'geography').trim()) {
      errors.push({ tab: 'dados', field: 'geography', message: '5.1 Abrangência geográfica é obrigatória' })
    }
    if (!getInputValue(d, 'data_source').trim()) {
      errors.push({ tab: 'dados', field: 'data_source', message: '5.2 Fonte de coleta dos dados é obrigatória' })
    }
    if (!getInputValue(d, 'legal_basis').trim()) {
      errors.push({ tab: 'dados', field: 'legal_basis', message: '6.1 Hipótese legal (Base Legal) é obrigatória' })
    }
    if (!getInputValue(d, 'purpose').trim()) {
      errors.push({ tab: 'dados', field: 'purpose', message: '6.2 Finalidade específica do tratamento é obrigatória' })
    }
    const categories = (d.data_categories as string[]) || []
    if (!categories.length) {
      errors.push({ tab: 'dados', field: 'data_categories', message: '7. Categorias de Dados: selecione ao menos uma categoria' })
    }
    if (!getInputValue(d, 'retention_period').trim()) {
      errors.push({ tab: 'dados', field: 'retention_period', message: '7. Tempo / Prazo de retenção é obrigatório' })
    }

    // Tab 3
    if (!getInputValue(d, 'data_subjects').trim()) {
      errors.push({ tab: 'titulares', field: 'data_subjects', message: '10.1 Descrição dos grupos de titulares é obrigatória' })
    }

    // Tab 4
    if (!getInputValue(d, 'security').trim() || getInputValue(d, 'security').trim().length < 15) {
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

  const isManager =
    user?.role === 'admin' ||
    user?.role === 'master' ||
    user?.email?.toLowerCase() === 'catzzrule65@gmail.com'

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
              Preencha todos os campos obrigatórios (*) para validar e concluir o relatório de mapeamento de dados.
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
              Todos os campos obrigatórios marcados com asterisco (*) devem ser preenchidos para enviar o relatório.
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
        <div className="form-main-grid">
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
                      <span className="section-badge-required">Todos os campos desta seção são obrigatórios *</span>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className={`form-field full-width ${isFieldInvalid('system_name') ? 'field-error' : ''}`}>
                      <label htmlFor="system_name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        1.1 — Nome do sistema / Plataforma *
                        <span title="Nome pelo qual o sistema é conhecido na unidade que o administra."><Info size={14} className="text-muted cursor-help" /></span>
                      </label>
                      <input
                        id="system_name"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'system_name')}
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
                      <label htmlFor="system_start_date" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        1.1d — Data de início do funcionamento
                        <span title="Data da entrada em operação do sistema."><Info size={14} className="text-muted cursor-help" /></span>
                      </label>
                      <input
                        id="system_start_date"
                        type="date"
                        value={getInputValue(item.form_data, 'system_start_date')}
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
                      <label htmlFor="reference_id">1.3 — Nº de Referência / Código ID *</label>
                      <input
                        id="reference_id"
                        type="text"
                        required
                        value={item.reference_id}
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
                      <span className="section-badge-required">Todos os campos desta seção são obrigatórios *</span>
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className={`form-field ${isFieldInvalid('controller_name') ? 'field-error' : ''}`}>
                      <label htmlFor="controller_name">2.1 — Controlador (Nome / Órgão) *</label>
                      <input
                        id="controller_name"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'controller_name')}
                        onChange={e => updateField('controller_name', e.target.value)}
                        placeholder="Ex.: Ministério / Empresa X"
                      />
                      {isFieldInvalid('controller_name') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('controller_email') ? 'field-error' : ''}`}>
                      <label htmlFor="controller_email">E-mail do Controlador *</label>
                      <input
                        id="controller_email"
                        type="email"
                        required
                        value={getInputValue(item.form_data, 'controller_email')}
                        onChange={e => updateField('controller_email', e.target.value)}
                        placeholder="controlador@orgao.gov.br"
                      />
                      {isFieldInvalid('controller_email') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('controller_phone') ? 'field-error' : ''}`}>
                      <label htmlFor="controller_phone">Telefone do Controlador *</label>
                      <input
                        id="controller_phone"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'controller_phone')}
                        onChange={e => updateField('controller_phone', e.target.value)}
                        placeholder="(61) 99999-0000"
                      />
                      {isFieldInvalid('controller_phone') && <span className="error-hint">Obrigatório</span>}
                    </div>
                  </div>

                  <div className="form-grid-3 margin-top">
                    <div className={`form-field ${isFieldInvalid('dpo_name') ? 'field-error' : ''}`}>
                      <label htmlFor="dpo_name">2.2 — Encarregado (DPO - Nome) *</label>
                      <input
                        id="dpo_name"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'dpo_name')}
                        onChange={e => updateField('dpo_name', e.target.value)}
                        placeholder="Nome do Encarregado de Dados"
                      />
                      {isFieldInvalid('dpo_name') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('dpo_email') ? 'field-error' : ''}`}>
                      <label htmlFor="dpo_email">E-mail do Encarregado *</label>
                      <input
                        id="dpo_email"
                        type="email"
                        required
                        value={getInputValue(item.form_data, 'dpo_email')}
                        onChange={e => updateField('dpo_email', e.target.value)}
                        placeholder="dpo@orgao.gov.br"
                      />
                      {isFieldInvalid('dpo_email') && <span className="error-hint">Obrigatório</span>}
                    </div>

                    <div className={`form-field ${isFieldInvalid('operator_name') ? 'field-error' : ''}`}>
                      <label htmlFor="operator_name">2.3 — Operador (Razão Social / Nome) *</label>
                      <input
                        id="operator_name"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'operator_name')}
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
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>4 — Descrição do Fluxo e Forma de Tratamento *</h2>
                  </div>
                  <div className={`form-field full-width ${isFieldInvalid('flow') ? 'field-error' : ''}`}>
                    <label htmlFor="flow">4.1 — Descrição do fluxo de tratamento de dados pessoais *</label>
                    <textarea
                      id="flow"
                      rows={3}
                      required
                      value={getInputValue(item.form_data, 'flow')}
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
                      <label htmlFor="geography">5.1 — Abrangência geográfica do tratamento *</label>
                      <input
                        id="geography"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'geography')}
                        onChange={e => updateField('geography', e.target.value)}
                        placeholder="Ex.: Nacional, Estadual ou Municipal"
                      />
                      {isFieldInvalid('geography') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className={`form-field ${isFieldInvalid('data_source') ? 'field-error' : ''}`}>
                      <label htmlFor="data_source">5.2 — Fonte de coleta dos dados *</label>
                      <input
                        id="data_source"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'data_source')}
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
                      <label htmlFor="legal_basis">6.1 — Hipótese legal de tratamento (Base Legal) *</label>
                      <input
                        id="legal_basis"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'legal_basis')}
                        onChange={e => updateField('legal_basis', e.target.value)}
                        placeholder="Ex.: Cumprimento de obrigação legal (Art. 7º, II) ou Execução de políticas públicas (Art. 7º, III)"
                      />
                      {isFieldInvalid('legal_basis') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className={`form-field full-width ${isFieldInvalid('purpose') ? 'field-error' : ''}`}>
                      <label htmlFor="purpose">6.2 — Finalidade específica do tratamento *</label>
                      <textarea
                        id="purpose"
                        rows={2}
                        required
                        value={getInputValue(item.form_data, 'purpose')}
                        onChange={e => updateField('purpose', e.target.value)}
                        placeholder="Descreva a razão de ser da coleta desse dado pessoal para o processo..."
                      />
                      {isFieldInvalid('purpose') && <span className="error-hint">Campo obrigatório</span>}
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

                  <div className="form-grid-2 margin-top">
                    <div className={`form-field ${isFieldInvalid('retention_period') ? 'field-error' : ''}`}>
                      <label htmlFor="retention_period">Tempo / Prazo de retenção dos dados *</label>
                      <input
                        id="retention_period"
                        type="text"
                        required
                        value={getInputValue(item.form_data, 'retention_period')}
                        onChange={e => updateField('retention_period', e.target.value)}
                        placeholder="Ex.: 5 anos após o término do vínculo contrato"
                      />
                      {isFieldInvalid('retention_period') && <span className="error-hint">Campo obrigatório</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="database">Nome do Banco de Dados / Tabela</label>
                      <input
                        id="database"
                        type="text"
                        value={getInputValue(item.form_data, 'database')}
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
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileText size={18} /></div>
                    <h2>9 — Frequência e Estimativa de Volume</h2>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label htmlFor="frequency">9.1 — Frequência do tratamento</label>
                      <input
                        id="frequency"
                        type="text"
                        value={getInputValue(item.form_data, 'frequency')}
                        onChange={e => updateField('frequency', e.target.value)}
                        placeholder="Ex.: Contínua, Mensal, Anual, Sob demanda"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="data_volume">9.2 — Quantidade aproximada de titulares</label>
                      <input
                        id="data_volume"
                        type="text"
                        value={getInputValue(item.form_data, 'data_volume')}
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
                    <label htmlFor="data_subjects">10.1 — Descrição dos grupos de titulares *</label>
                    <textarea
                      id="data_subjects"
                      rows={3}
                      required
                      value={getInputValue(item.form_data, 'data_subjects')}
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
                  <div className="section-title">
                    <div className="title-icon-badge"><Building size={18} /></div>
                    <h2>11 — Compartilhamento de Dados Pessoais</h2>
                  </div>
                  <SharingTable
                    sharing={(item.form_data.sharing as TableRow[]) || []}
                    onChange={newList => updateField('sharing', newList)}
                  />
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
                  <div className={`form-field full-width ${isFieldInvalid('security') ? 'field-error' : ''}`}>
                    <label htmlFor="security">12.1 — Tipo de medida e controles de segurança aplicados *</label>
                    <textarea
                      id="security"
                      rows={4}
                      required
                      value={getInputValue(item.form_data, 'security')}
                      onChange={e => updateField('security', e.target.value)}
                      placeholder="Ex.: Autenticação multifator (MFA), perfis de acesso restritos por papel, criptografia SSL/TLS em trânsito e repositório, política de backup diário e logs de auditoria imutáveis."
                    />
                    {isFieldInvalid('security') && (
                      <span className="error-hint">Descreva as medidas de segurança adotadas (mín. 15 caracteres)</span>
                    )}
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><Globe size={18} /></div>
                    <h2>13 — Transferência Internacional de Dados Pessoais</h2>
                  </div>
                  <div className="form-field full-width">
                    <label htmlFor="international_transfer">13.1 — Detalhes da transferência internacional</label>
                    <textarea
                      id="international_transfer"
                      rows={3}
                      value={getInputValue(item.form_data, 'international_transfer')}
                      onChange={e => updateField('international_transfer', e.target.value)}
                      placeholder="Deixe em branco se não houver transferência internacional. Se houver, descreva o país de destino, fornecedor da nuvem (AWS/Azure/GCP) e garantias contratuais."
                    />
                  </div>
                </div>

                <div className="section-block">
                  <div className="section-title">
                    <div className="title-icon-badge"><FileCode size={18} /></div>
                    <h2>14 — Contratos de Serviços / Soluções de TI Envolvidos</h2>
                  </div>
                  <div className="form-field full-width">
                    <label htmlFor="contracts">14.1 — Identificação dos contratos vigentes</label>
                    <textarea
                      id="contracts"
                      rows={3}
                      value={getInputValue(item.form_data, 'contracts')}
                      onChange={e => updateField('contracts', e.target.value)}
                      placeholder="Descreva o nº do processo SEI/Contrato, objeto contratual, vigência e contato do gestor do contrato."
                    />
                  </div>
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

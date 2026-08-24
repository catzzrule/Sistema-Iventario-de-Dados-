import React from 'react'
import { RiskItem } from '../../types/inventory'
import { RiskBadge } from '../common/RiskBadge'
import { AlertTriangle, ShieldCheck, Info } from 'lucide-react'

interface RiskDrawerProps {
  risks: RiskItem[]
  status: string
  lastUpdated: string
  onGoToSecurityTab: () => void
}

export const RiskDrawer: React.FC<RiskDrawerProps> = ({
  risks,
  status,
  lastUpdated,
  onGoToSecurityTab
}) => {
  const highRisks = risks.filter(r => r.level === 'alto')
  const mediumRisks = risks.filter(r => r.level === 'medio')

  return (
    <aside className="inventory-summary-sidebar">
      {/* Status Card */}
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <span className="sidebar-label">STATUS DO INVENTÁRIO</span>
          <span className={`status-pill status-${status}`}>{status}</span>
        </div>
        <div className="sidebar-info">
          <span className="info-label">Última atualização:</span>
          <span className="info-val">{new Date(lastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      </div>

      {/* Risk Summary Card */}
      <div className="sidebar-card risk-summary-card">
        <div className="risk-card-header">
          <AlertTriangle size={20} className="risk-header-icon" />
          <div>
            <h3>Análise de Risco LGPD</h3>
            <p>Diagnóstico automático de conformidade</p>
          </div>
        </div>

        <div className="risk-counts">
          <div className="count-badge count-high">
            <strong>{highRisks.length}</strong>
            <span>Alto(s)</span>
          </div>
          <div className="count-badge count-medium">
            <strong>{mediumRisks.length}</strong>
            <span>Médio(s)</span>
          </div>
        </div>

        <div className="risk-mini-list">
          {risks.map((item, i) => (
            <div key={i} className={`mini-risk-item level-${item.level}`}>
              <RiskBadge risk={item.level} showIcon={false} />
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onGoToSecurityTab}
          className="btn-secondary btn-block btn-sm"
        >
          <Info size={15} />
          <span>Ver Detalhes de Segurança</span>
        </button>
      </div>

      {/* ANPD Compliance Note */}
      <div className="sidebar-card note-card">
        <ShieldCheck size={18} className="note-icon" />
        <p>
          Formulário estruturado em conformidade com o <strong>Guia 3 — Inventário de Dados Pessoais</strong> da Secretaria de Governo Digital.
        </p>
      </div>
    </aside>
  )
}

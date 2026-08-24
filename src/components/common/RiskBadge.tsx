import React from 'react'
import { RiskLevel } from '../../types/inventory'
import { AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react'

interface RiskBadgeProps {
  risk: RiskLevel
  showIcon?: boolean
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, showIcon = true }) => {
  const labels: Record<RiskLevel, string> = {
    alto: 'Risco Alto',
    medio: 'Risco Médio',
    baixo: 'Risco Baixo'
  }

  const icons = {
    alto: <AlertTriangle size={13} />,
    medio: <AlertCircle size={13} />,
    baixo: <ShieldCheck size={13} />
  }

  return (
    <span className={`risk-badge risk-${risk}`}>
      {showIcon && icons[risk]}
      <span>{labels[risk]}</span>
    </span>
  )
}

import React from 'react'

interface StatCardProps {
  title: string
  value: number
  description: string
  icon: React.ReactNode
  variant?: 'primary' | 'warning' | 'success' | 'info'
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon, variant = 'primary' }) => {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-accent-bar" />
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        <div className="stat-icon-wrapper">{icon}</div>
      </div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-description">{description}</span>
      </div>
    </div>
  )
}

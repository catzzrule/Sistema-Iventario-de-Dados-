import React from 'react'
import {
  ShieldCheck,
  LayoutGrid,
  ClipboardList,
  BarChart3,
  Building2,
  BookOpen,
  Settings
} from 'lucide-react'

const managerOnlyItems = [
  { icon: <ClipboardList size={18} />, label: 'Mapeamento de processos' },
  { icon: <BarChart3 size={18} />, label: 'Relatórios' },
  { icon: <Building2 size={18} />, label: 'Unidades e sistemas' }
]

const generalItems = [
  { icon: <BookOpen size={18} />, label: 'Guia LGPD' },
  { icon: <Settings size={18} />, label: 'Configurações' }
]

interface SidebarProps {
  isManager: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({ isManager }) => {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu Principal</span>
        <button type="button" className="sidebar-nav-item active">
          <LayoutGrid size={18} />
          <span>Visão geral</span>
          <span className="sidebar-active-dot" aria-hidden="true" />
        </button>
        {isManager && managerOnlyItems.map(item => (
          <button
            type="button"
            key={item.label}
            className="sidebar-nav-item disabled"
            title="Em breve"
            disabled
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        <span className="sidebar-section-label">Administração</span>
        {generalItems.map(item => (
          <button
            type="button"
            key={item.label}
            className="sidebar-nav-item disabled"
            title="Em breve"
            disabled
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-tip-card">
        <div className="sidebar-tip-icon">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>Conformidade em dia</strong>
          <p>Mantenha os processos atualizados para garantir a governança dos dados.</p>
        </div>
      </div>
    </aside>
  )
}

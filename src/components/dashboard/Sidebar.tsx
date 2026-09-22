import React from 'react'
import {
  ShieldCheck,
  Home,
  LayoutGrid,
  FileText,
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

export type DashboardSection = 'inicio' | 'declaracao' | 'overview' | 'settings'

interface SidebarProps {
  isManager: boolean
  activeView: DashboardSection
  onNavigate: (view: DashboardSection) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isManager, activeView, onNavigate }) => {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu Principal</span>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === 'inicio' ? 'active' : ''}`}
          onClick={() => onNavigate('inicio')}
        >
          <Home size={18} />
          <span>Início</span>
          {activeView === 'inicio' && <span className="sidebar-active-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === 'declaracao' ? 'active' : ''}`}
          onClick={() => onNavigate('declaracao')}
        >
          <FileText size={18} />
          <span>Minha declaração</span>
          {activeView === 'declaracao' && <span className="sidebar-active-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => onNavigate('overview')}
        >
          <LayoutGrid size={18} />
          <span>Visão geral</span>
          {activeView === 'overview' && <span className="sidebar-active-dot" aria-hidden="true" />}
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
        <button
          type="button"
          className="sidebar-nav-item disabled"
          title="Em breve"
          disabled
        >
          <BookOpen size={18} />
          <span>Guia LGPD</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <Settings size={18} />
          <span>Configurações</span>
          {activeView === 'settings' && <span className="sidebar-active-dot" aria-hidden="true" />}
        </button>
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

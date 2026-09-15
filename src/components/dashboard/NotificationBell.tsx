import React, { useEffect, useRef, useState } from 'react'
import { Bell, Send, Undo2, Inbox } from 'lucide-react'
import { AppNotification } from '../../types/inventory'

interface NotificationBellProps {
  notifications: AppNotification[]
  onMarkRead: (id: string) => void
  onOpenNotification?: (notification: AppNotification) => void
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onMarkRead, onOpenNotification }) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleNotificationClick(n: AppNotification) {
    if (!n.read) onMarkRead(n.id)
    if (onOpenNotification) {
      onOpenNotification(n)
      setOpen(false)
    }
  }

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className="btn-icon header-bell"
        title="Notificações"
        aria-label="Notificações"
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="header-bell-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <strong>Caixa de entrada</strong>
            {unreadCount > 0 && <span className="notification-unread-count">{unreadCount} nova{unreadCount > 1 ? 's' : ''}</span>}
          </div>

          <div className="notification-panel-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Inbox size={28} />
                <p>Nenhuma notificação por aqui.</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  type="button"
                  key={n.id}
                  className={`notification-item ${n.read ? '' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={`notification-item-icon ${n.type}`}>
                    {n.type === 'submitted' ? <Send size={15} /> : <Undo2 size={15} />}
                  </div>
                  <div className="notification-item-body">
                    <p>
                      {n.type === 'submitted' ? (
                        <>Processo <strong>{n.inventory_title || 'sem título'}</strong> enviado para análise.</>
                      ) : (
                        <>Processo <strong>{n.inventory_title || 'sem título'}</strong> foi devolvido.</>
                      )}
                    </p>
                    {n.message && <p className="notification-item-message">"{n.message}"</p>}
                    <span className="notification-item-time">{formatRelative(n.created_at)}</span>
                  </div>
                  {!n.read && <span className="notification-item-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

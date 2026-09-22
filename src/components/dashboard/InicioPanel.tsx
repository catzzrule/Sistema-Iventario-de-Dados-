import React from 'react'
import { ArrowRight, Undo2 } from 'lucide-react'
import { AppNotification, Cycle, UserProfile } from '../../types/inventory'

interface InicioPanelProps {
  user: UserProfile
  cycle: Cycle | null
  totalCount: number
  completedCount: number
  notifications: AppNotification[]
  onContinue: () => void
  onOpenNotification: (notification: AppNotification) => void
}

export const InicioPanel: React.FC<InicioPanelProps> = ({
  user,
  cycle,
  totalCount,
  completedCount,
  notifications,
  onContinue,
  onOpenNotification
}) => {
  const firstName = (user.full_name || user.email).split(' ')[0]
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const pendingReturns = notifications.filter(n => n.type === 'returned' && !n.read)

  return (
    <div className="inicio-panel">
      <h1 className="inicio-greeting">Olá, {firstName}</h1>
      <p className="inicio-subtitle">
        {user.unit
          ? <>Você é o ponto focal da <strong>{user.unit}</strong> no inventário de dados pessoais{cycle ? ` de ${cycle.year}` : ''}.</>
          : <>Acompanhe aqui o andamento do seu inventário de dados pessoais{cycle ? ` — ${cycle.label}` : ''}.</>}
      </p>

      <div className="inicio-hero-grid">
        <section className="inicio-hero-card">
          <span className="inicio-eyebrow">COMECE POR AQUI</span>
          <h2>Revise seus processos {cycle ? `do ${cycle.label}` : 'declarados'}</h2>
          <p>
            {totalCount > 0
              ? `Você tem ${totalCount} processo${totalCount > 1 ? 's' : ''} registrado${totalCount > 1 ? 's' : ''}. Confirme se cada um está completo e envie os que faltam para aprovação.`
              : 'Você ainda não registrou nenhum processo. Comece cadastrando o primeiro inventário da sua unidade.'}
          </p>

          {totalCount > 0 && (
            <div className="inicio-progress">
              <div className="inicio-progress-bar">
                <div className="inicio-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="inicio-progress-label">{completedCount} de {totalCount} itens concluídos</span>
            </div>
          )}

          <button type="button" className="btn-primary shadow-emerald inicio-continue-btn" onClick={onContinue}>
            <span>{totalCount > 0 ? 'Continuar revisão' : 'Ver meus inventários'}</span>
            <ArrowRight size={17} />
          </button>
        </section>

        <aside className="inicio-steps-card">
          <span className="inicio-eyebrow">COMO FUNCIONA</span>
          <ol className="inicio-steps-list">
            <li className="inicio-step active">
              <span className="inicio-step-number">1</span>
              <div>
                <strong>VOCÊ ESTÁ AQUI</strong>
                <p>Você revisa e completa</p>
                <span className="inicio-step-desc">Confirma o que já existe e cadastra o que for novo.</span>
              </div>
            </li>
            <li className="inicio-step">
              <span className="inicio-step-number">2</span>
              <div>
                <strong>Seu gestor aprova</strong>
                <span className="inicio-step-desc">Ele recebe um aviso assim que você enviar.</span>
              </div>
            </li>
            <li className="inicio-step">
              <span className="inicio-step-number">3</span>
              <div>
                <strong>O Encarregado homologa</strong>
                <span className="inicio-step-desc">Sua declaração fica válida para o ciclo.</span>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      {pendingReturns.length > 0 && (
        <section className="inicio-followup">
          <h3>Depois disso</h3>
          {pendingReturns.map(n => (
            <div key={n.id} className="inicio-followup-card">
              <div className="inicio-followup-icon">
                <Undo2 size={18} />
              </div>
              <div className="inicio-followup-body">
                <strong>O gestor pediu um ajuste</strong>
                <p>{n.inventory_title ? <>Em <strong>{n.inventory_title}</strong>: </> : null}{n.message}</p>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => onOpenNotification(n)}>
                Corrigir
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

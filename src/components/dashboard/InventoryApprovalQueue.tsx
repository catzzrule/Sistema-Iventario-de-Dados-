import React, { useState } from 'react'
import { CheckCircle2, Eye, Inbox, Undo2 } from 'lucide-react'
import { Inventory, ManagedProfile, Unit } from '../../types/inventory'
import { getHighestRisk, getInputValue } from '../../utils/lgpdRisk'
import { RiskBadge } from '../common/RiskBadge'

// Fila de inventários enviados pelos Pontos Focais (status "concluido"),
// aguardando a decisão do Master: visualizar, aprovar ou devolver.

interface InventoryApprovalQueueProps {
  inventories: Inventory[]
  units: Unit[]
  allUsers: ManagedProfile[]
  onOpen: (inventory: Inventory) => void
  onApprove?: (inventory: Inventory) => Promise<void>
  onReturn?: (inventory: Inventory, message: string) => Promise<void>
}

export const InventoryApprovalQueue: React.FC<InventoryApprovalQueueProps> = ({
  inventories,
  units,
  allUsers,
  onOpen,
  onApprove,
  onReturn
}) => {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [returning, setReturning] = useState<Inventory | null>(null)
  const [message, setMessage] = useState('')

  const queue = [...inventories].sort((a, b) => a.updated_at.localeCompare(b.updated_at))

  const unitLabel = (inv: Inventory) =>
    units.find(u => u.id === inv.unit_id)?.name || getInputValue(inv.form_data, 'unit').trim() || 'Sem unidade'
  const ownerLabel = (inv: Inventory) => {
    const owner = allUsers.find(u => u.id === inv.owner_id)
    return owner ? owner.full_name || owner.email || 'Ponto Focal' : 'Ponto Focal'
  }

  async function approve(inv: Inventory) {
    if (!onApprove) return
    setBusyId(inv.id)
    setError('')
    try {
      await onApprove(inv)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aprovar o inventário.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmReturn() {
    if (!returning || !onReturn || !message.trim()) return
    setBusyId(returning.id)
    setError('')
    try {
      await onReturn(returning, message.trim())
      setReturning(null)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível devolver o inventário.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="table-card glass-card aprovacoes-card aprovacoes-queue">
      <div className="aprovacoes-card-header">
        <h2>Inventários aguardando aprovação</h2>
        <span className="aprovacoes-card-subtitle">
          {queue.length === 0
            ? 'Nenhum inventário na fila.'
            : `${queue.length} inventário${queue.length !== 1 ? 's' : ''} enviado${queue.length !== 1 ? 's' : ''} pelos Pontos Focais, do mais antigo para o mais recente.`}
        </span>
      </div>

      {error && <div className="alert-box alert-error aprovacoes-queue-error">{error}</div>}

      {queue.length === 0 ? (
        <div className="aprovacoes-empty-card aprovacoes-queue-empty">
          <Inbox size={28} className="text-muted" />
          <p>Assim que um Ponto Focal enviar um inventário, ele aparece aqui para sua análise.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PROCESSO</th>
                <th>ÁREA</th>
                <th>ENVIADO POR</th>
                <th>ENVIADO EM</th>
                <th>RISCO</th>
                <th className="text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(inv => (
                <tr key={inv.id} className="table-row-hover">
                  <td className="cell-main">
                    <span className="process-title">{inv.title || 'Sem título'}</span>
                    {inv.reference_id && <span className="code-badge aprovacoes-queue-ref">{inv.reference_id}</span>}
                  </td>
                  <td>{unitLabel(inv)}</td>
                  <td>{ownerLabel(inv)}</td>
                  <td className="cell-date">{new Date(inv.updated_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <RiskBadge risk={getHighestRisk(inv.form_data)} />
                  </td>
                  <td className="text-right">
                    <div className="row-actions-group">
                      <button type="button" className="btn-action-open" onClick={() => onOpen(inv)} title="Visualizar (somente leitura)">
                        <Eye size={14} />
                        <span>Visualizar</span>
                      </button>
                      {onApprove && (
                        <button
                          type="button"
                          className="btn-action-approve"
                          onClick={() => approve(inv)}
                          disabled={busyId !== null}
                          title="Aprovar inventário"
                        >
                          <CheckCircle2 size={14} />
                          <span>{busyId === inv.id ? 'Aprovando...' : 'Aprovar'}</span>
                        </button>
                      )}
                      {onReturn && (
                        <button
                          type="button"
                          className="btn-action-return"
                          onClick={() => {
                            setReturning(inv)
                            setMessage('')
                          }}
                          disabled={busyId !== null}
                          title="Devolver ao Ponto Focal com uma mensagem"
                        >
                          <Undo2 size={14} />
                          <span>Devolver</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {returning && (
        <div className="modal-backdrop-overlay" onClick={() => (busyId ? null : setReturning(null))}>
          <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge modal-icon-badge-warning">
                <Undo2 size={22} />
              </div>
              <div className="flex-1">
                <h3>Devolver inventário</h3>
                <p>
                  <strong>{returning.title || 'Sem título'}</strong> volta para rascunho e o Ponto Focal recebe sua mensagem.
                </p>
              </div>
            </div>
            <div className="modal-body margin-top">
              <div className="form-field">
                <label htmlFor="queue-return-message">Mensagem para o Ponto Focal</label>
                <textarea
                  id="queue-return-message"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Ex.: Faltou preencher o prazo de retenção e a base legal do tratamento."
                  className="custom-select-large"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer margin-top">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setReturning(null)} disabled={busyId !== null}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary btn-sm shadow-emerald"
                onClick={confirmReturn}
                disabled={busyId !== null || !message.trim()}
              >
                <Undo2 size={16} />
                <span>{busyId ? 'Devolvendo...' : 'Devolver'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

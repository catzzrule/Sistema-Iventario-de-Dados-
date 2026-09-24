import React from 'react'
import { TransferRow } from '../../types/inventory'
import { Plus, Trash2, Globe } from 'lucide-react'

interface TransferTableProps {
  transfers: TransferRow[]
  onChange: (newList: TransferRow[]) => void
}

export const TransferTable: React.FC<TransferTableProps> = ({ transfers, onChange }) => {
  const addRow = () => {
    onChange([...transfers, { country: '', data: '', guarantee: '' }])
  }

  const updateRow = (index: number, key: keyof TransferRow, value: string) => {
    const updated = transfers.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    onChange(updated)
  }

  const removeRow = (index: number) => {
    onChange(transfers.filter((_, i) => i !== index))
  }

  return (
    <div className="sharing-section">
      <div className="sharing-header">
        <div>
          <h3 className="section-subtitle">Organizações que recebem dados no exterior</h3>
          <p className="help-text">
            Deixe em branco se não houver transferência internacional. Se houver, registre cada organização/país de destino.
          </p>
        </div>
        <button type="button" onClick={addRow} className="btn-secondary btn-sm">
          <Plus size={16} />
          <span>Adicionar Organização</span>
        </button>
      </div>

      {transfers.length > 0 ? (
        <div className="sharing-list">
          {transfers.map((row, idx) => (
            <div key={idx} className="sharing-card">
              <div className="sharing-card-header">
                <span className="sharing-number">
                  <Globe size={15} /> Organização #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="btn-danger-ghost"
                  title="Remover organização"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="sharing-grid">
                <div className="form-field">
                  <label>13.1 — País de destino</label>
                  <input
                    type="text"
                    value={row.country}
                    onChange={e => updateRow(idx, 'country', e.target.value)}
                    placeholder="Ex.: Estados Unidos"
                  />
                </div>

                <div className="form-field">
                  <label>Dados pessoais transferidos</label>
                  <input
                    type="text"
                    value={row.data}
                    onChange={e => updateRow(idx, 'data', e.target.value)}
                    placeholder="Ex.: Nome completo, e-mail, passaporte"
                  />
                </div>

                <div className="form-field full-width">
                  <label>Tipo de garantia para a transferência</label>
                  <input
                    type="text"
                    value={row.guarantee}
                    onChange={e => updateRow(idx, 'guarantee', e.target.value)}
                    placeholder="Ex.: Cláusulas contratuais padrão, decisão de adequação (Art. 33 da LGPD)"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <p>Nenhuma transferência internacional registrada até o momento.</p>
          <button type="button" onClick={addRow} className="btn-link">
            + Adicionar primeira organização
          </button>
        </div>
      )}
    </div>
  )
}

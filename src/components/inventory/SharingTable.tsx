import React from 'react'
import { TableRow } from '../../types/inventory'
import { Plus, Trash2, Building2 } from 'lucide-react'

interface SharingTableProps {
  sharing: TableRow[]
  onChange: (newList: TableRow[]) => void
}

export const SharingTable: React.FC<SharingTableProps> = ({ sharing, onChange }) => {
  const addRow = () => {
    onChange([...sharing, { institution: '', data: '', purpose: '' }])
  }

  const updateRow = (index: number, key: keyof TableRow, value: string) => {
    const updated = sharing.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    onChange(updated)
  }

  const removeRow = (index: number) => {
    onChange(sharing.filter((_, i) => i !== index))
  }

  return (
    <div className="sharing-section">
      <div className="sharing-header">
        <div>
          <h3 className="section-subtitle">Tabela de Compartilhamento com Terceiros</h3>
          <p className="help-text">
            Registre os destinatários (órgãos públicos, parceiros ou operadores), os dados pessoais compartilhados e as finalidades específicas.
          </p>
        </div>
        <button type="button" onClick={addRow} className="btn-secondary btn-sm">
          <Plus size={16} />
          <span>Adicionar Destinatário</span>
        </button>
      </div>

      {sharing.length > 0 ? (
        <div className="sharing-list">
          {sharing.map((row, idx) => (
            <div key={idx} className="sharing-card">
              <div className="sharing-card-header">
                <span className="sharing-number">
                  <Building2 size={15} /> Destinatário #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="btn-danger-ghost"
                  title="Remover destinatário"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="sharing-grid">
                <div className="form-field">
                  <label>11.1 — Nome do órgão / empresa pública ou privada</label>
                  <input
                    type="text"
                    value={row.institution}
                    onChange={e => updateRow(idx, 'institution', e.target.value)}
                    placeholder="Ex.: Serpro, Receita Federal, Ministério da Saúde"
                  />
                </div>

                <div className="form-field">
                  <label>11.2 — Dados pessoais compartilhados</label>
                  <input
                    type="text"
                    value={row.data}
                    onChange={e => updateRow(idx, 'data', e.target.value)}
                    placeholder="Ex.: CPF, Nome completo, Rendimentos"
                  />
                </div>

                <div className="form-field full-width">
                  <label>11.3 — Finalidade específica do compartilhamento</label>
                  <input
                    type="text"
                    value={row.purpose}
                    onChange={e => updateRow(idx, 'purpose', e.target.value)}
                    placeholder="Ex.: Cumprimento de obrigação legal de prestação de contas"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <p>Nenhum compartilhamento de dados registrado até o momento.</p>
          <button type="button" onClick={addRow} className="btn-link">
            + Adicionar primeira instituição receptora
          </button>
        </div>
      )}
    </div>
  )
}

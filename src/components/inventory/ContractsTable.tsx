import React from 'react'
import { ContractRow } from '../../types/inventory'
import { Plus, Trash2, FileSignature } from 'lucide-react'

interface ContractsTableProps {
  contracts: ContractRow[]
  onChange: (newList: ContractRow[]) => void
}

export const ContractsTable: React.FC<ContractsTableProps> = ({ contracts, onChange }) => {
  const addRow = () => {
    onChange([...contracts, { number: '', object: '', managerEmail: '' }])
  }

  const updateRow = (index: number, key: keyof ContractRow, value: string) => {
    const updated = contracts.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    onChange(updated)
  }

  const removeRow = (index: number) => {
    onChange(contracts.filter((_, i) => i !== index))
  }

  return (
    <div className="sharing-section">
      <div className="sharing-header">
        <div>
          <h3 className="section-subtitle">Contratos de TI que tratam dados pessoais</h3>
          <p className="help-text">
            Registre contratos de sistemas, fornecedores ou soluções terceirizadas que tratam dados pessoais deste processo.
          </p>
        </div>
        <button type="button" onClick={addRow} className="btn-secondary btn-sm">
          <Plus size={16} />
          <span>Adicionar Contrato</span>
        </button>
      </div>

      {contracts.length > 0 ? (
        <div className="sharing-list">
          {contracts.map((row, idx) => (
            <div key={idx} className="sharing-card">
              <div className="sharing-card-header">
                <span className="sharing-number">
                  <FileSignature size={15} /> Contrato #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="btn-danger-ghost"
                  title="Remover contrato"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="sharing-grid">
                <div className="form-field">
                  <label>Nº do Processo de Contratação</label>
                  <input
                    type="text"
                    value={row.number}
                    onChange={e => updateRow(idx, 'number', e.target.value)}
                    placeholder="Ex.: 23000.012345/2026-11"
                  />
                </div>

                <div className="form-field">
                  <label>E-mail do Gestor do Contrato</label>
                  <input
                    type="email"
                    value={row.managerEmail}
                    onChange={e => updateRow(idx, 'managerEmail', e.target.value)}
                    placeholder="gestor.contrato@orgao.gov.br"
                  />
                </div>

                <div className="form-field full-width">
                  <label>Objeto do Contrato</label>
                  <input
                    type="text"
                    value={row.object}
                    onChange={e => updateRow(idx, 'object', e.target.value)}
                    placeholder="Ex.: Prestação de serviços de hospedagem e manutenção do sistema X"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <p>Nenhum contrato de TI registrado até o momento.</p>
          <button type="button" onClick={addRow} className="btn-link">
            + Adicionar primeiro contrato
          </button>
        </div>
      )}
    </div>
  )
}

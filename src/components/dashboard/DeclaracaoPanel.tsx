import React, { useState } from 'react'
import {
  Plus,
  ArrowUpRight,
  Undo2,
  Database,
  Share2,
  ClipboardList,
  AlertTriangle,
  Send,
  CheckCircle2
} from 'lucide-react'
import { Cycle, DataSource, Inventory, Sharing, UnitDeclaration, UserProfile } from '../../types/inventory'

type CloseKind = 'inventory' | 'data_source' | 'sharing'

interface DeclaracaoPanelProps {
  user: UserProfile
  cycle: Cycle | null
  inventories: Inventory[]
  dataSources: DataSource[]
  sharings: Sharing[]
  declaration?: UnitDeclaration | null
  onNewInventory: () => void
  onEditInventory: (inventory: Inventory) => void
  onCreateDataSource: (params: { name: string; type: DataSource['type']; criticality: DataSource['criticality'] }) => Promise<void>
  onCreateSharing: (params: { recipient_name: string; legal_instrument: string; operation_id: string | null }) => Promise<void>
  onCloseItem: (kind: CloseKind, id: string, reason: string, destination: string) => Promise<void>
  onSubmitDeclaration?: () => Promise<void>
}

const dataSourceTypeLabels: Record<DataSource['type'], string> = {
  banco_de_dados: 'Base de dados',
  planilha: 'Planilha',
  arquivo_fisico: 'Arquivo físico',
  outro: 'Outro'
}

const criticalityLabels: Record<DataSource['criticality'], string> = {
  alta: 'criticidade alta',
  media: 'criticidade média',
  baixa: 'criticidade baixa'
}

export const DeclaracaoPanel: React.FC<DeclaracaoPanelProps> = ({
  user,
  cycle,
  inventories,
  dataSources,
  sharings,
  declaration = null,
  onNewInventory,
  onEditInventory,
  onCreateDataSource,
  onCreateSharing,
  onCloseItem,
  onSubmitDeclaration
}) => {
  const [closing, setClosing] = useState<{ kind: CloseKind; id: string; label: string } | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [closeDestination, setCloseDestination] = useState('')
  const [closingBusy, setClosingBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState<DataSource['type']>('banco_de_dados')
  const [sourceCriticality, setSourceCriticality] = useState<DataSource['criticality']>('media')
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceError, setSourceError] = useState('')

  const [sharingModalOpen, setSharingModalOpen] = useState(false)
  const [sharingRecipient, setSharingRecipient] = useState('')
  const [sharingInstrument, setSharingInstrument] = useState('')
  const [sharingOperationId, setSharingOperationId] = useState('')
  const [sharingBusy, setSharingBusy] = useState(false)
  const [sharingError, setSharingError] = useState('')

  const activeInventories = inventories.filter(i => i.item_status !== 'encerrado')
  const closedInventories = inventories.filter(i => i.item_status === 'encerrado')
  const activeSources = dataSources.filter(d => d.item_status !== 'encerrado')
  const closedSources = dataSources.filter(d => d.item_status === 'encerrado')
  const activeSharings = sharings.filter(s => s.item_status !== 'encerrado')
  const closedSharings = sharings.filter(s => s.item_status === 'encerrado')

  const totalItems = activeInventories.length + activeSources.length + activeSharings.length
  const resolvedItems =
    activeInventories.filter(i => i.status === 'concluido').length + activeSources.length + activeSharings.length

  const noUnit = !user.unit_id

  async function handleConfirmClose() {
    if (!closing || !closeReason.trim() || !closeDestination.trim()) return
    setClosingBusy(true)
    try {
      await onCloseItem(closing.kind, closing.id, closeReason.trim(), closeDestination.trim())
      setClosing(null)
      setCloseReason('')
      setCloseDestination('')
    } finally {
      setClosingBusy(false)
    }
  }

  async function handleCreateSource(e: React.FormEvent) {
    e.preventDefault()
    setSourceError('')
    if (!sourceName.trim()) return
    setSourceBusy(true)
    try {
      await onCreateDataSource({ name: sourceName.trim(), type: sourceType, criticality: sourceCriticality })
      setSourceModalOpen(false)
      setSourceName('')
      setSourceType('banco_de_dados')
      setSourceCriticality('media')
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Erro ao cadastrar fonte de dados.')
    } finally {
      setSourceBusy(false)
    }
  }

  async function handleCreateSharingSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSharingError('')
    if (!sharingRecipient.trim()) return
    setSharingBusy(true)
    try {
      await onCreateSharing({
        recipient_name: sharingRecipient.trim(),
        legal_instrument: sharingInstrument.trim(),
        operation_id: sharingOperationId || null
      })
      setSharingModalOpen(false)
      setSharingRecipient('')
      setSharingInstrument('')
      setSharingOperationId('')
    } catch (err) {
      setSharingError(err instanceof Error ? err.message : 'Erro ao cadastrar compartilhamento.')
    } finally {
      setSharingBusy(false)
    }
  }

  async function handleSubmitDeclarationClick() {
    if (!onSubmitDeclaration) return
    setSubmitting(true)
    try {
      await onSubmitDeclaration()
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitted = Boolean(declaration?.submitted_at) && declaration?.status === 'em_preenchimento'
  const isBeyondSubmission = declaration?.status === 'em_homologacao' || declaration?.status === 'homologada'

  return (
    <div className="declaracao-panel">
      <div className="declaracao-header">
        <div>
          <span className="declaracao-eyebrow">
            REVISÃO {cycle ? `DO ${cycle.label.toUpperCase()}` : ''} {user.unit ? `· ${user.unit.toUpperCase()}` : ''}
          </span>
          <h1>Confirme o que já foi declarado</h1>
          <p>Acompanhe os itens da sua unidade e mantenha cada um atualizado — operações, fontes de dados e compartilhamentos.</p>
        </div>
        {totalItems > 0 && (
          <div className="declaracao-progress-chip">
            <strong>{resolvedItems}</strong> de {totalItems} itens resolvidos
          </div>
        )}
      </div>

      {noUnit && (
        <div className="alert-box alert-error flex-center-gap margin-top-xs">
          <AlertTriangle size={16} />
          <span>Você ainda não tem uma unidade definida. Peça ao Master para vincular seu usuário a uma unidade antes de cadastrar fontes de dados ou compartilhamentos.</span>
        </div>
      )}

      <section className="declaracao-section">
        <div className="declaracao-section-header">
          <h2><ClipboardList size={16} /> Operações de Tratamento</h2>
          <button type="button" className="btn-primary btn-sm shadow-emerald" onClick={onNewInventory}>
            <Plus size={15} />
            <span>Acrescentar tratamento</span>
          </button>
        </div>

        <div className="declaracao-list">
          {activeInventories.length === 0 && closedInventories.length === 0 && (
            <p className="declaracao-empty">Nenhuma operação cadastrada ainda.</p>
          )}
          {activeInventories.map(inv => (
            <div key={inv.id} className="declaracao-item">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Operação de Tratamento</span>
                <strong>{inv.title || 'Sem título'}</strong>
                <span className="declaracao-item-meta">
                  <span className={`status-pill status-${inv.status}`}>{inv.status === 'concluido' ? 'Concluído' : 'Rascunho'}</span>
                  {inv.reference_id && <span className="code-badge">{inv.reference_id}</span>}
                </span>
              </div>
              <div className="declaracao-item-actions">
                <button type="button" className="btn-action-open" onClick={() => onEditInventory(inv)}>
                  <span>Abrir</span>
                  <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  className="btn-action-return"
                  onClick={() => setClosing({ kind: 'inventory', id: inv.id, label: inv.title || 'Sem título' })}
                >
                  <Undo2 size={13} />
                  <span>Encerrar</span>
                </button>
              </div>
            </div>
          ))}
          {closedInventories.map(inv => (
            <div key={inv.id} className="declaracao-item declaracao-item-closed">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Operação de Tratamento</span>
                <strong>{inv.title || 'Sem título'}</strong>
                <span className="declaracao-item-meta">
                  <span className="status-pill status-encerrado">Encerrado</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="declaracao-section">
        <div className="declaracao-section-header">
          <h2><Database size={16} /> Fontes de Dados</h2>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSourceModalOpen(true)}
            disabled={noUnit}
            title={noUnit ? 'Peça ao Master para definir sua unidade' : undefined}
          >
            <Plus size={15} />
            <span>Nova fonte</span>
          </button>
        </div>

        <div className="declaracao-list">
          {activeSources.length === 0 && closedSources.length === 0 && (
            <p className="declaracao-empty">Nenhuma fonte de dados cadastrada ainda.</p>
          )}
          {activeSources.map(ds => (
            <div key={ds.id} className="declaracao-item">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Fonte de Dados</span>
                <strong>{ds.name}</strong>
                <span className="declaracao-item-meta">
                  <span className="unit-pill">{dataSourceTypeLabels[ds.type]}</span>
                  <span className="system-pill">{criticalityLabels[ds.criticality]}</span>
                </span>
              </div>
              <div className="declaracao-item-actions">
                <button
                  type="button"
                  className="btn-action-return"
                  onClick={() => setClosing({ kind: 'data_source', id: ds.id, label: ds.name })}
                >
                  <Undo2 size={13} />
                  <span>Encerrar</span>
                </button>
              </div>
            </div>
          ))}
          {closedSources.map(ds => (
            <div key={ds.id} className="declaracao-item declaracao-item-closed">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Fonte de Dados</span>
                <strong>{ds.name}</strong>
                <span className="declaracao-item-meta">
                  <span className="status-pill status-encerrado">Encerrado</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="declaracao-section">
        <div className="declaracao-section-header">
          <h2><Share2 size={16} /> Compartilhamentos</h2>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSharingModalOpen(true)}
            disabled={noUnit}
            title={noUnit ? 'Peça ao Master para definir sua unidade' : undefined}
          >
            <Plus size={15} />
            <span>Novo compartilhamento</span>
          </button>
        </div>

        <div className="declaracao-list">
          {activeSharings.length === 0 && closedSharings.length === 0 && (
            <p className="declaracao-empty">Nenhum compartilhamento cadastrado ainda.</p>
          )}
          {activeSharings.map(sh => (
            <div key={sh.id} className="declaracao-item">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Compartilhamento</span>
                <strong>{sh.recipient_name}</strong>
                {sh.legal_instrument && <span className="declaracao-item-meta">{sh.legal_instrument}</span>}
              </div>
              <div className="declaracao-item-actions">
                <button
                  type="button"
                  className="btn-action-return"
                  onClick={() => setClosing({ kind: 'sharing', id: sh.id, label: sh.recipient_name })}
                >
                  <Undo2 size={13} />
                  <span>Encerrar</span>
                </button>
              </div>
            </div>
          ))}
          {closedSharings.map(sh => (
            <div key={sh.id} className="declaracao-item declaracao-item-closed">
              <div className="declaracao-item-body">
                <span className="declaracao-item-kind">Compartilhamento</span>
                <strong>{sh.recipient_name}</strong>
                <span className="declaracao-item-meta">
                  <span className="status-pill status-encerrado">Encerrado</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="declaracao-submit-footer">
        {isBeyondSubmission ? (
          <span className="declaracao-submit-status declaracao-submit-status-done">
            <CheckCircle2 size={15} />
            {declaration?.status === 'homologada' ? 'Declaração homologada para este ciclo.' : 'Declaração aprovada — aguardando homologação do Encarregado.'}
          </span>
        ) : isSubmitted ? (
          <span className="declaracao-submit-status">
            <CheckCircle2 size={15} />
            Enviada para aprovação do gestor{declaration?.submitted_at ? ` em ${new Date(declaration.submitted_at).toLocaleDateString('pt-BR')}` : ''}.
          </span>
        ) : (
          <span className="declaracao-submit-status declaracao-submit-status-pending">
            Quando terminar de revisar, envie a declaração para o seu gestor aprovar.
          </span>
        )}
        <button
          type="button"
          className="btn-primary shadow-emerald"
          onClick={handleSubmitDeclarationClick}
          disabled={submitting || isSubmitted || isBeyondSubmission || !onSubmitDeclaration}
        >
          <Send size={16} />
          <span>{submitting ? 'Enviando...' : 'Enviar para aprovação do gestor'}</span>
        </button>
      </div>

      {/* Modal: Nova Fonte de Dados */}
      {sourceModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => (!sourceBusy ? setSourceModalOpen(false) : null)}>
          <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Database size={22} />
              </div>
              <div>
                <h3>Nova Fonte de Dados</h3>
                <p>Bancos, planilhas ou arquivos físicos que guardam dados pessoais da sua unidade.</p>
              </div>
            </div>
            <form onSubmit={handleCreateSource}>
              <div className="modal-body margin-top">
                <div className="form-field">
                  <label htmlFor="source-name">Nome da fonte *</label>
                  <input
                    id="source-name"
                    type="text"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder="Ex.: bolsa_atleta_prd"
                    className="custom-select-large"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-grid-2 margin-top-xs">
                  <div className="form-field">
                    <label htmlFor="source-type">Tipo</label>
                    <select
                      id="source-type"
                      value={sourceType}
                      onChange={e => setSourceType(e.target.value as DataSource['type'])}
                      className="custom-select-large select-compact"
                    >
                      <option value="banco_de_dados">Base de dados</option>
                      <option value="planilha">Planilha</option>
                      <option value="arquivo_fisico">Arquivo físico</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="source-criticality">Criticidade</label>
                    <select
                      id="source-criticality"
                      value={sourceCriticality}
                      onChange={e => setSourceCriticality(e.target.value as DataSource['criticality'])}
                      className="custom-select-large select-compact"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                </div>
                {sourceError && <div className="alert-box alert-error margin-top-xs">{sourceError}</div>}
              </div>
              <div className="modal-footer margin-top">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setSourceModalOpen(false)} disabled={sourceBusy}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary btn-sm shadow-emerald" disabled={sourceBusy}>
                  {sourceBusy ? 'Salvando...' : 'Cadastrar Fonte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Compartilhamento */}
      {sharingModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => (!sharingBusy ? setSharingModalOpen(false) : null)}>
          <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Share2 size={22} />
              </div>
              <div>
                <h3>Novo Compartilhamento</h3>
                <p>Terceiros que recebem dados pessoais da sua unidade.</p>
              </div>
            </div>
            <form onSubmit={handleCreateSharingSubmit}>
              <div className="modal-body margin-top">
                <div className="form-field">
                  <label htmlFor="sharing-recipient">Destinatário *</label>
                  <input
                    id="sharing-recipient"
                    type="text"
                    value={sharingRecipient}
                    onChange={e => setSharingRecipient(e.target.value)}
                    placeholder="Ex.: Comitê Olímpico do Brasil"
                    className="custom-select-large"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-field margin-top-xs">
                  <label htmlFor="sharing-instrument">Instrumento jurídico</label>
                  <input
                    id="sharing-instrument"
                    type="text"
                    value={sharingInstrument}
                    onChange={e => setSharingInstrument(e.target.value)}
                    placeholder="Ex.: Acordo de Cooperação nº 14/2024"
                    className="custom-select-large"
                  />
                </div>
                <div className="form-field margin-top-xs">
                  <label htmlFor="sharing-operation">Vincular a uma operação (opcional)</label>
                  <select
                    id="sharing-operation"
                    value={sharingOperationId}
                    onChange={e => setSharingOperationId(e.target.value)}
                    className="custom-select-large select-compact"
                  >
                    <option value="">Nenhuma operação específica</option>
                    {inventories.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.title || 'Sem título'}</option>
                    ))}
                  </select>
                </div>
                {sharingError && <div className="alert-box alert-error margin-top-xs">{sharingError}</div>}
              </div>
              <div className="modal-footer margin-top">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setSharingModalOpen(false)} disabled={sharingBusy}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary btn-sm shadow-emerald" disabled={sharingBusy}>
                  {sharingBusy ? 'Salvando...' : 'Cadastrar Compartilhamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Encerrar item */}
      {closing && (
        <div className="modal-backdrop-overlay" onClick={() => (!closingBusy ? setClosing(null) : null)}>
          <div className="modal-card-custom glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge modal-icon-badge-warning">
                <Undo2 size={22} />
              </div>
              <div>
                <h3>Encerrar Item</h3>
                <p>Explique por que <strong>{closing.label}</strong> deixou de existir e o que aconteceu com os dados.</p>
              </div>
            </div>
            <div className="modal-body margin-top">
              <div className="form-field">
                <label htmlFor="close-reason">Motivo do encerramento *</label>
                <textarea
                  id="close-reason"
                  rows={3}
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  placeholder="Ex.: Planilha substituída pelo novo sistema."
                  className="custom-select-large"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  autoFocus
                />
              </div>
              <div className="form-field margin-top-xs">
                <label htmlFor="close-destination">Destino dos dados *</label>
                <input
                  id="close-destination"
                  type="text"
                  value={closeDestination}
                  onChange={e => setCloseDestination(e.target.value)}
                  placeholder="Ex.: Eliminada em 15/08/2026 (termo SEI 000012)"
                  className="custom-select-large"
                />
              </div>
            </div>
            <div className="modal-footer margin-top">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setClosing(null)} disabled={closingBusy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary btn-sm shadow-emerald"
                onClick={handleConfirmClose}
                disabled={closingBusy || !closeReason.trim() || !closeDestination.trim()}
              >
                {closingBusy ? 'Encerrando...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

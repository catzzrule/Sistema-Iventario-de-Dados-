import React, { useMemo, useState } from 'react'
import { CheckCircle2, Undo2, Inbox } from 'lucide-react'
import {
  Cycle,
  DataSource,
  Inventory,
  ItemStatus,
  ManagedProfile,
  Sharing,
  Unit,
  UnitDeclaration,
  UserProfile
} from '../../types/inventory'
import { riskReport } from '../../utils/lgpdRisk'
import { isMasterRole } from '../../utils/roles'

interface AprovacoesPanelProps {
  user: UserProfile
  cycle: Cycle | null
  inventories: Inventory[]
  dataSources: DataSource[]
  sharings: Sharing[]
  unitDeclarations: UnitDeclaration[]
  allUsers: ManagedProfile[]
  units: Unit[]
  onApprove: (declaration: UnitDeclaration) => Promise<void>
  onReturn: (declaration: UnitDeclaration, observation: string) => Promise<void>
  onOpenInventory: (inventory: Inventory) => void
}

type FeedKind = 'inventory' | 'data_source' | 'sharing'

const kindLabels: Record<FeedKind, string> = {
  inventory: 'Operação de Tratamento',
  data_source: 'Fonte de Dados',
  sharing: 'Compartilhamento'
}

const statusLabels: Record<ItemStatus, string> = {
  novo: 'Novo',
  alterado: 'Alterado',
  encerrado: 'Encerrado',
  mantido: 'Mantido'
}

export const AprovacoesPanel: React.FC<AprovacoesPanelProps> = ({
  user,
  cycle,
  inventories,
  dataSources,
  sharings,
  unitDeclarations,
  allUsers,
  units,
  onApprove,
  onReturn,
  onOpenInventory
}) => {
  const [observation, setObservation] = useState('')
  const [busy, setBusy] = useState<'approve' | 'return' | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // O banco (RLS) já limita o que cada perfil enxerga; aqui só reforçamos o
  // recorte: Gestor com unidade vê apenas a própria, Master vê todas.
  const scopedDeclarations = useMemo(
    () =>
      unitDeclarations.filter(
        d =>
          d.cycle_id === cycle?.id &&
          (isMasterRole(user.role) || !user.unit_id || d.unit_id === user.unit_id)
      ),
    [unitDeclarations, cycle, user.role, user.unit_id]
  )

  const pendingDeclarations = useMemo(
    () => scopedDeclarations.filter(d => d.submitted_at && d.status === 'em_preenchimento'),
    [scopedDeclarations]
  )

  const unitName = (unitId?: string | null) => units.find(u => u.id === unitId)?.name || 'Unidade'

  const declaration =
    pendingDeclarations.find(d => d.id === selectedId) ||
    pendingDeclarations[0] ||
    scopedDeclarations.find(d => d.unit_id === user.unit_id) ||
    null

  const isPending = Boolean(declaration && declaration.submitted_at && declaration.status === 'em_preenchimento')

  const unitInventories = useMemo(
    () => inventories.filter(i => declaration && i.unit_id === declaration.unit_id),
    [inventories, declaration]
  )
  const unitDataSources = useMemo(
    () => dataSources.filter(d => declaration && d.unit_id === declaration.unit_id),
    [dataSources, declaration]
  )
  const unitSharings = useMemo(
    () => sharings.filter(s => declaration && s.unit_id === declaration.unit_id),
    [sharings, declaration]
  )

  const counts = useMemo(() => {
    const items: { item_status?: ItemStatus }[] = [...unitInventories, ...unitDataSources, ...unitSharings]
    const tally: Record<ItemStatus, number> = { mantido: 0, alterado: 0, encerrado: 0, novo: 0 }
    items.forEach(i => {
      const status = (i.item_status || 'novo') as ItemStatus
      tally[status] = (tally[status] || 0) + 1
    })
    return tally
  }, [unitInventories, unitDataSources, unitSharings])

  const changedFeed = useMemo(() => {
    const feed: { kind: FeedKind; id: string; title: string; status: ItemStatus; detail: string }[] = []
    unitInventories.forEach(i => {
      const status = (i.item_status || 'novo') as ItemStatus
      if (status === 'mantido') return
      feed.push({
        kind: 'inventory',
        id: i.id,
        title: i.title || 'Sem título',
        status,
        detail:
          status === 'alterado'
            ? i.change_description || ''
            : status === 'encerrado'
            ? `Motivo: ${i.closure_reason || '—'} — Destino: ${i.closure_destination || '—'}`
            : 'Cadastrado neste ciclo.'
      })
    })
    unitDataSources.forEach(d => {
      const status = (d.item_status || 'novo') as ItemStatus
      if (status === 'mantido') return
      feed.push({
        kind: 'data_source',
        id: d.id,
        title: d.name,
        status,
        detail:
          status === 'alterado'
            ? d.change_description || ''
            : status === 'encerrado'
            ? `Motivo: ${d.closure_reason || '—'} — Destino: ${d.closure_destination || '—'}`
            : 'Cadastrada neste ciclo.'
      })
    })
    unitSharings.forEach(s => {
      const status = (s.item_status || 'novo') as ItemStatus
      if (status === 'mantido') return
      feed.push({
        kind: 'sharing',
        id: s.id,
        title: s.recipient_name,
        status,
        detail:
          status === 'alterado'
            ? s.change_description || ''
            : status === 'encerrado'
            ? `Motivo: ${s.closure_reason || '—'} — Destino: ${s.closure_destination || '—'}`
            : 'Cadastrado neste ciclo.'
      })
    })
    return feed
  }, [unitInventories, unitDataSources, unitSharings])

  const riskFeed = useMemo(() => {
    return unitInventories.flatMap(inv =>
      riskReport(inv.form_data).map(r => ({ ...r, title: inv.title || 'Sem título', inventory: inv }))
    )
  }, [unitInventories])

  const submitterName = declaration?.submitted_by
    ? allUsers.find(u => u.id === declaration.submitted_by)?.full_name || 'Ponto focal'
    : 'Ponto focal'

  async function handleApprove() {
    if (!declaration) return
    setBusy('approve')
    try {
      await onApprove(declaration)
      setObservation('')
    } finally {
      setBusy(null)
    }
  }

  async function handleReturn() {
    if (!declaration || !observation.trim()) return
    setBusy('return')
    try {
      await onReturn(declaration, observation.trim())
      setObservation('')
    } finally {
      setBusy(null)
    }
  }

  if (!isPending) {
    return (
      <div className="aprovacoes-panel">
        <span className="declaracao-eyebrow">APROVAÇÃO {user.unit ? `· ${user.unit.toUpperCase()}` : ''}</span>
        <h1 className="aprovacoes-title">Nenhuma declaração aguardando você</h1>
        <div className="aprovacoes-empty-card">
          <Inbox size={32} className="text-muted" />
          <p>
            {declaration?.status === 'em_homologacao'
              ? 'A declaração já foi aprovada e aguarda homologação.'
              : declaration?.status === 'homologada'
              ? 'A declaração deste ciclo já foi homologada.'
              : 'Assim que o ponto focal enviar a declaração da unidade, ela aparece aqui para sua análise.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="aprovacoes-panel">
      <span className="declaracao-eyebrow">APROVAÇÃO · {unitName(declaration?.unit_id).toUpperCase()}</span>
      {pendingDeclarations.length > 1 && (
        <div className="aprovacoes-unit-picker">
          <label htmlFor="aprovacoes-unit">
            {pendingDeclarations.length} declarações aguardando análise — escolha a área:
          </label>
          <select
            id="aprovacoes-unit"
            className="custom-select-large select-compact"
            value={declaration?.id || ''}
            onChange={e => {
              setSelectedId(e.target.value)
              setObservation('')
            }}
          >
            {pendingDeclarations.map(d => (
              <option key={d.id} value={d.id}>
                {unitName(d.unit_id)}
                {d.submitted_at ? ` — enviada em ${new Date(d.submitted_at).toLocaleDateString('pt-BR')}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <h1 className="aprovacoes-title">
        Declaração {cycle ? `do ${cycle.label}` : ''} aguardando você
      </h1>
      <p className="aprovacoes-subtitle">
        Enviada por <strong>{submitterName}</strong> (ponto focal){declaration?.submitted_at ? ` em ${new Date(declaration.submitted_at).toLocaleString('pt-BR')}` : ''}.
        Revise as mudanças e o diagnóstico antes de aprovar ou devolver.
      </p>

      <div className="aprovacoes-grid">
        <div className="aprovacoes-main">
          <div className="aprovacoes-stats-row">
            <div className="aprovacoes-stat aprovacoes-stat-neutral">
              <strong>{counts.mantido}</strong>
              <span>mantidos</span>
            </div>
            <div className="aprovacoes-stat aprovacoes-stat-warning">
              <strong>{counts.alterado}</strong>
              <span>alterado{counts.alterado !== 1 ? 's' : ''}</span>
            </div>
            <div className="aprovacoes-stat aprovacoes-stat-danger">
              <strong>{counts.encerrado}</strong>
              <span>encerrado{counts.encerrado !== 1 ? 's' : ''}</span>
            </div>
            <div className="aprovacoes-stat aprovacoes-stat-success">
              <strong>{counts.novo}</strong>
              <span>novo{counts.novo !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <section className="table-card glass-card aprovacoes-card">
            <div className="aprovacoes-card-header">
              <h2>O que a unidade declarou</h2>
            </div>
            <div className="declaracao-list">
              {changedFeed.length === 0 && <p className="declaracao-empty">Nenhuma mudança registrada neste ciclo.</p>}
              {changedFeed.map(item => (
                <div key={`${item.kind}-${item.id}`} className="declaracao-item">
                  <div className="declaracao-item-body">
                    <span className="declaracao-item-meta">
                      <span className={`status-pill status-${item.status === 'novo' ? 'concluido' : item.status === 'encerrado' ? 'encerrado' : 'rascunho'}`}>
                        {statusLabels[item.status]}
                      </span>
                      <span className="declaracao-item-kind">{kindLabels[item.kind]}</span>
                    </span>
                    <strong>{item.title}</strong>
                    {item.detail && <p className="aprovacoes-feed-detail">{item.detail}</p>}
                    <span className="aprovacoes-feed-author">por {submitterName}, ponto focal</span>
                  </div>
                  {item.kind === 'inventory' && (
                    <div className="declaracao-item-actions">
                      <button
                        type="button"
                        className="btn-action-open"
                        onClick={() => onOpenInventory(unitInventories.find(i => i.id === item.id)!)}
                      >
                        Abrir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="table-card glass-card aprovacoes-card">
            <div className="aprovacoes-card-header">
              <h2>Diagnóstico do motor de risco</h2>
              <span className="aprovacoes-card-subtitle">Triagem automática — não substitui o parecer do Encarregado (DPO).</span>
            </div>
            <div className="aprovacoes-risk-grid">
              {riskFeed.length === 0 && <p className="declaracao-empty">Nenhum risco identificado nas operações desta unidade.</p>}
              {riskFeed.map((r, idx) => (
                <div key={idx} className={`aprovacoes-risk-card risk-${r.level}`}>
                  <span className="aprovacoes-risk-level">{r.level.toUpperCase()}</span>
                  <p><strong>{r.title}:</strong> {r.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="aprovacoes-decision-card">
          <h3>Sua decisão</h3>
          <div className="form-field">
            <label htmlFor="aprovacoes-obs">Observação para o ponto focal</label>
            <textarea
              id="aprovacoes-obs"
              rows={4}
              value={observation}
              onChange={e => setObservation(e.target.value)}
              placeholder="Obrigatória ao devolver. Diga o que precisa ser corrigido."
              className="custom-select-large"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="button"
            className="btn-primary shadow-emerald aprovacoes-decision-btn"
            onClick={handleApprove}
            disabled={busy !== null}
          >
            <CheckCircle2 size={17} />
            <span>{busy === 'approve' ? 'Aprovando...' : 'Aprovar declaração'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary aprovacoes-decision-btn"
            onClick={handleReturn}
            disabled={busy !== null || !observation.trim()}
          >
            <Undo2 size={16} />
            <span>{busy === 'return' ? 'Devolvendo...' : 'Devolver ao ponto focal'}</span>
          </button>

          <p className="aprovacoes-decision-note">
            Ao aprovar, a unidade passa a "Em homologação" e o ponto focal é notificado.
          </p>
        </aside>
      </div>
    </div>
  )
}

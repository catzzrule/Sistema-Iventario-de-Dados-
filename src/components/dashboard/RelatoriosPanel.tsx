import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FilterX,
  BarChart3
} from 'lucide-react'
import {
  AuditLogEntry,
  Cycle,
  Inventory,
  ManagedProfile,
  RiskLevel,
  Unit,
  UnitDeclaration,
  UserProfile
} from '../../types/inventory'
import { getHighestRisk, getInputValue, isNotApplicable } from '../../utils/lgpdRisk'
import { isMasterRole, ROLE_LABELS } from '../../utils/roles'

// Tudo aqui é calculado a partir do que veio do Supabase (inventories,
// unit_declarations, units, cycles, audit_log, profiles). A RLS do banco já
// limita o que cada perfil recebe; o painel só agrega e filtra.

interface RelatoriosPanelProps {
  user: UserProfile
  inventories: Inventory[]
  units: Unit[]
  cycles: Cycle[]
  currentCycle: Cycle | null
  unitDeclarations: UnitDeclaration[]
  auditLog: AuditLogEntry[]
  allUsers: ManagedProfile[]
  onRefresh?: () => Promise<void>
}

type AreaStatus = 'homologada' | 'aprovada' | 'enviada' | 'em_preenchimento' | 'nao_iniciada'

const AREA_STATUS_ORDER: AreaStatus[] = ['homologada', 'aprovada', 'enviada', 'em_preenchimento', 'nao_iniciada']

const AREA_STATUS_LABELS: Record<AreaStatus, string> = {
  homologada: 'Homologada',
  aprovada: 'Aprovada',
  enviada: 'Enviada (aguarda aprovação)',
  em_preenchimento: 'Em preenchimento',
  nao_iniciada: 'Não iniciada'
}

const FILLED_STATUSES: AreaStatus[] = ['homologada', 'aprovada', 'enviada']

const FREQUENCY_BUCKETS = [
  'Contínua / diária',
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual',
  'Sob demanda / eventual',
  'Outras',
  'Não informada',
  'Não se aplica'
] as const

type FrequencyBucket = (typeof FREQUENCY_BUCKETS)[number]

const ALL = 'todas'
const NO_UNIT = 'sem-unidade'

const RISK_META: Record<RiskLevel, { label: string; color: string; Icon: typeof AlertOctagon }> = {
  alto: { label: 'Alto', color: '#d03b3b', Icon: AlertOctagon },
  medio: { label: 'Médio', color: '#fab219', Icon: AlertTriangle },
  baixo: { label: 'Baixo', color: '#0ca30c', Icon: CheckCircle2 }
}

const AUDIT_LABELS: Record<string, string> = {
  submitted: 'Declaração enviada',
  approved: 'Declaração aprovada',
  returned: 'Declaração devolvida',
  inventory_returned: 'Inventário devolvido para ajuste',
  user_created: 'Usuário cadastrado',
  user_updated: 'Usuário alterado'
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function frequencyBucket(inv: Inventory): FrequencyBucket {
  if (isNotApplicable(inv.form_data, 'frequency')) return 'Não se aplica'
  const t = normalizeText(getInputValue(inv.form_data, 'frequency'))
  if (!t) return 'Não informada'
  if (/contin|diari|tempo real|todo dia|24 ?h/.test(t)) return 'Contínua / diária'
  if (/quinzen/.test(t)) return 'Quinzenal'
  if (/bimestr/.test(t)) return 'Bimestral'
  if (/trimestr/.test(t)) return 'Trimestral'
  if (/semestr/.test(t)) return 'Semestral'
  if (/seman/.test(t)) return 'Semanal'
  if (/mensal|por mes|todo mes|mensalmente/.test(t)) return 'Mensal'
  if (/anual|por ano|todo ano|anualmente/.test(t)) return 'Anual'
  if (/demanda|eventual|esporad|necessari|pontual|quando/.test(t)) return 'Sob demanda / eventual'
  return 'Outras'
}

function inventoryDate(inv: Inventory) {
  return new Date(inv.created_at || inv.updated_at)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/* ------------------------------------------------------------------------ */
/* Peças de gráfico (HTML + CSS, sem biblioteca)                            */
/* ------------------------------------------------------------------------ */

type BarRow = { key: string; label: string; value: number; suffix?: string; color?: string; icon?: React.ReactNode }

const HBarChart: React.FC<{ rows: BarRow[]; unit: string; emptyText: string }> = ({ rows, unit, emptyText }) => {
  const max = Math.max(0, ...rows.map(r => r.value))
  if (rows.length === 0 || max === 0) return <p className="rel-empty">{emptyText}</p>
  return (
    <div className="rel-hbar-list">
      {rows.map(r => (
        <div
          key={r.key}
          className="rel-hbar-row"
          tabIndex={0}
          aria-label={`${r.label}: ${r.value} ${unit}${r.suffix ? ` (${r.suffix})` : ''}`}
        >
          <span className="rel-hbar-label">
            {r.icon}
            {r.label}
          </span>
          <div className="rel-hbar-track">
            <div
              className="rel-hbar-fill"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color }}
            />
            <span className="rel-hbar-value">
              {r.value}
              {r.suffix && <span className="rel-hbar-suffix"> · {r.suffix}</span>}
            </span>
          </div>
          <span className="rel-tip" role="presentation">
            <strong>{r.label}</strong>
            {r.value} {unit}
            {r.suffix ? ` · ${r.suffix}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

type StackRow = { key: string; label: string; done: number; draft: number }

const StackedBarChart: React.FC<{ rows: StackRow[]; emptyText: string }> = ({ rows, emptyText }) => {
  const max = Math.max(0, ...rows.map(r => r.done + r.draft))
  if (rows.length === 0 || max === 0) return <p className="rel-empty">{emptyText}</p>
  return (
    <>
      <div className="rel-legend" aria-hidden="true">
        <span><i className="rel-swatch rel-swatch-done" /> Concluídos</span>
        <span><i className="rel-swatch rel-swatch-draft" /> Rascunhos</span>
      </div>
      <div className="rel-hbar-list">
        {rows.map(r => {
          const total = r.done + r.draft
          return (
            <div
              key={r.key}
              className="rel-hbar-row"
              tabIndex={0}
              aria-label={`${r.label}: ${total} formulários, ${r.done} concluídos e ${r.draft} rascunhos`}
            >
              <span className="rel-hbar-label">{r.label}</span>
              <div className="rel-hbar-track">
                <div className="rel-stack" style={{ width: `${(total / max) * 100}%` }}>
                  {r.done > 0 && <div className="rel-stack-seg rel-seg-done" style={{ flexGrow: r.done }} />}
                  {r.draft > 0 && <div className="rel-stack-seg rel-seg-draft" style={{ flexGrow: r.draft }} />}
                </div>
                <span className="rel-hbar-value">{total}</span>
              </div>
              <span className="rel-tip" role="presentation">
                <strong>{r.label}</strong>
                {r.done} concluído{r.done !== 1 ? 's' : ''} · {r.draft} rascunho{r.draft !== 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

const ColumnChart: React.FC<{ rows: { key: string; label: string; value: number }[]; emptyText: string }> = ({
  rows,
  emptyText
}) => {
  const max = Math.max(0, ...rows.map(r => r.value))
  if (rows.length === 0 || max === 0) return <p className="rel-empty">{emptyText}</p>
  return (
    <div className="rel-columns" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
      {rows.map(r => (
        <div
          key={r.key}
          className="rel-column"
          tabIndex={0}
          aria-label={`${r.label}: ${r.value} formulário${r.value !== 1 ? 's' : ''}`}
        >
          <div className="rel-column-plot">
            {r.value > 0 && <span className="rel-column-value">{r.value}</span>}
            <div className="rel-column-bar" style={{ height: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="rel-column-label">{r.label}</span>
          <span className="rel-tip" role="presentation">
            <strong>{r.label}</strong>
            {r.value} formulário{r.value !== 1 ? 's' : ''} criado{r.value !== 1 ? 's' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}


/* Pizza: situação do preenchimento por área -------------------------------- */

type PieSlice = { key: string; label: string; value: number; color: string; detail?: string }

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const point = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const [x1, y1] = point(start)
  const [x2, y2] = point(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

const PieChart: React.FC<{ slices: PieSlice[]; total: number; totalLabel: string }> = ({ slices, total, totalLabel }) => {
  const [active, setActive] = useState<string | null>(null)
  if (total === 0) return <p className="rel-empty">Nenhuma área cadastrada para os filtros escolhidos.</p>

  const size = 200
  const c = size / 2
  const r = c - 4
  let angle = 0
  const drawn = slices
    .filter(sl => sl.value > 0)
    .map(sl => {
      const start = angle
      angle += (sl.value / total) * Math.PI * 2
      return { ...sl, start, end: angle }
    })
  const current = drawn.find(d => d.key === active)

  return (
    <div className="rel-pie">
      <div className="rel-pie-figure">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Situação do preenchimento de ${total} áreas`}>
          {drawn.map(d =>
            drawn.length === 1 ? (
              <circle
                key={d.key}
                cx={c}
                cy={c}
                r={r}
                fill={d.color}
                className="rel-pie-slice"
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} de ${total} (100%)`}
                onMouseEnter={() => setActive(d.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.key)}
                onBlur={() => setActive(null)}
              />
            ) : (
              <path
                key={d.key}
                d={arcPath(c, c, r, d.start, d.end)}
                fill={d.color}
                className={`rel-pie-slice ${active && active !== d.key ? 'is-dimmed' : ''}`}
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} de ${total} (${pct(d.value, total)}%)`}
                onMouseEnter={() => setActive(d.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.key)}
                onBlur={() => setActive(null)}
              />
            )
          )}
        </svg>
        {current && (
          <span className="rel-pie-tip" role="presentation">
            <strong>{current.label}</strong>
            {current.value} de {total} áreas · {pct(current.value, total)}%
          </span>
        )}
      </div>
      <div className="rel-pie-side">
        <ul className="rel-pie-legend">
          {slices.map(sl => (
            <li key={sl.key} className={active === sl.key ? 'is-active' : ''}>
              <i className="rel-swatch" style={{ background: sl.color }} aria-hidden="true" />
              <span className="rel-pie-legend-label">
                {sl.label}
                {sl.detail && <small>{sl.detail}</small>}
              </span>
              <strong>{sl.value}</strong>
              <span className="rel-pie-legend-pct">{pct(sl.value, total)}%</span>
            </li>
          ))}
        </ul>
        <p className="rel-pie-total">
          Total considerado: <strong>{total}</strong> {totalLabel}
        </p>
      </div>
    </div>
  )
}

const DataTable: React.FC<{ headers: string[]; rows: (string | number)[][] }> = ({ headers, rows }) => (
  <details className="rel-table-toggle">
    <summary>Ver dados em tabela</summary>
    <div className="table-container">
      <table className="custom-table rel-mini-table">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
)

/* ------------------------------------------------------------------------ */

export const RelatoriosPanel: React.FC<RelatoriosPanelProps> = ({
  user,
  inventories,
  units,
  cycles,
  currentCycle,
  unitDeclarations,
  auditLog,
  allUsers,
  onRefresh
}) => {
  const isMaster = isMasterRole(user.role)

  const cycleOptions = useMemo(() => {
    const list = [...cycles]
    if (currentCycle && !list.some(c => c.id === currentCycle.id)) list.unshift(currentCycle)
    return list.sort((a, b) => b.year - a.year)
  }, [cycles, currentCycle])

  const [cycleId, setCycleId] = useState<string>(currentCycle?.id || ALL)
  const [areaId, setAreaId] = useState<string>(ALL)
  const [frequency, setFrequency] = useState<string>(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Áreas que este perfil pode ver: Master e Gestor sem unidade veem todas;
  // Gestor com unidade vê só a própria.
  const scopedUnits = useMemo(
    () => (isMaster || !user.unit_id ? units : units.filter(u => u.id === user.unit_id)),
    [isMaster, units, user.unit_id]
  )

  const selectedCycle = cycleOptions.find(c => c.id === cycleId) || null

  const hasFilters = cycleId !== (currentCycle?.id || ALL) || areaId !== ALL || frequency !== ALL || dateFrom || dateTo

  function clearFilters() {
    setCycleId(currentCycle?.id || ALL)
    setAreaId(ALL)
    setFrequency(ALL)
    setDateFrom('')
    setDateTo('')
  }

  // Atualiza sozinho ao voltar para a aba e a cada 2 minutos com a aba
  // visível, para o painel acompanhar envios e aprovações feitos por outros.
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') refreshRef.current?.().catch(() => {})
    }
    const timer = window.setInterval(run, 120000)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
    }
  }, [])

  async function handleRefresh() {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const inPeriod = (date: Date) => {
    if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false
    if (dateTo && date > new Date(`${dateTo}T23:59:59`)) return false
    return true
  }

  const inCycle = (inv: Inventory) => {
    if (cycleId === ALL) return true
    if (inv.cycle_id) return inv.cycle_id === cycleId
    // Inventários antigos sem ciclo contam para o ciclo aberto.
    return cycleId === currentCycle?.id
  }

  const areaUnits = useMemo(
    () => (areaId === ALL ? scopedUnits : scopedUnits.filter(u => u.id === areaId)),
    [areaId, scopedUnits]
  )

  const filteredInventories = useMemo(
    () =>
      inventories.filter(inv => {
        if (!inCycle(inv)) return false
        if (areaId === NO_UNIT ? Boolean(inv.unit_id) : areaId !== ALL && inv.unit_id !== areaId) return false
        if (areaId === ALL && !isMaster && user.unit_id && inv.unit_id !== user.unit_id) return false
        if (frequency !== ALL && frequencyBucket(inv) !== frequency) return false
        if (!inPeriod(inventoryDate(inv))) return false
        return true
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventories, cycleId, areaId, frequency, dateFrom, dateTo, isMaster, user.unit_id, currentCycle]
  )

  // Situação de cada área no ciclo escolhido (ou na declaração mais recente,
  // quando "Todos os ciclos" está selecionado).
  const areaRows = useMemo(() => {
    const cycleYear = (id: string) => cycleOptions.find(c => c.id === id)?.year ?? 0
    return areaUnits.map(unit => {
      const decls = unitDeclarations
        .filter(d => d.unit_id === unit.id && (cycleId === ALL || d.cycle_id === cycleId))
        .sort((a, b) => cycleYear(b.cycle_id) - cycleYear(a.cycle_id))
      const decl = decls[0] || null
      const invs = filteredInventories.filter(i => i.unit_id === unit.id)
      let status: AreaStatus
      if (decl?.status === 'homologada') status = 'homologada'
      else if (decl?.status === 'em_homologacao') status = 'aprovada'
      else if (decl?.status === 'em_preenchimento' && decl.submitted_at) status = 'enviada'
      else if (invs.length > 0 || decl) status = 'em_preenchimento'
      else status = 'nao_iniciada'

      // Prazo: o do ciclo da declaração da área; sem declaração, o do ciclo
      // filtrado (ou do ciclo aberto quando "Todos os ciclos").
      const deadlineCycle =
        (decl && cycleOptions.find(c => c.id === decl.cycle_id)) ||
        (cycleId === ALL ? currentCycle : cycleOptions.find(c => c.id === cycleId)) ||
        null
      const deadline = deadlineCycle?.deadline || null
      const overdue = Boolean(deadline && new Date() > new Date(`${deadline}T23:59:59`))

      const done = invs.filter(i => i.status === 'concluido').length
      const lastUpdate = [
        ...invs.map(i => i.updated_at),
        decl?.submitted_at,
        decl?.approved_at,
        decl?.homologated_at
      ]
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop()

      return {
        unit,
        status,
        deadline,
        overdue,
        submittedAt: decl?.submitted_at || null,
        total: invs.length,
        done,
        draft: invs.length - done,
        highRisk: invs.filter(i => getHighestRisk(i.form_data) === 'alto').length,
        lastUpdate: lastUpdate || null
      }
    })
  }, [areaUnits, unitDeclarations, cycleId, filteredInventories, cycleOptions, currentCycle])

  const totalAreas = areaRows.length
  const filledAreas = areaRows.filter(r => FILLED_STATUSES.includes(r.status)).length
  const pendingAreas = totalAreas - filledAreas
  const inProgressAreas = areaRows.filter(r => r.status === 'em_preenchimento').length
  const notStartedAreas = areaRows.filter(r => r.status === 'nao_iniciada').length

  const totalForms = filteredInventories.length
  const doneForms = filteredInventories.filter(i => i.status === 'concluido').length
  const highRiskForms = filteredInventories.filter(i => getHighestRisk(i.form_data) === 'alto').length
  const naForms = filteredInventories.filter(i => (i.form_data.not_applicable || []).length > 0).length

  const focalPoints = allUsers.filter(
    u => u.role === 'ponto_focal' && (areaId === ALL ? isMaster || !user.unit_id || u.unit_id === user.unit_id : u.unit_id === areaId)
  ).length

  const unassignedForms = areaId === ALL ? filteredInventories.filter(i => !i.unit_id).length : 0

  // Pizza: mesma situação por área usada no resto do painel (unit_declarations)
  // + prazo do ciclo (cycles.deadline). Cada área entra em uma única fatia.
  const pieFilled = areaRows.filter(r => FILLED_STATUSES.includes(r.status)).length
  const pieInProgress = areaRows.filter(r => r.status === 'em_preenchimento' && !r.overdue).length
  const pieLateInProgress = areaRows.filter(r => r.status === 'em_preenchimento' && r.overdue).length
  const pieNotStarted = areaRows.filter(r => r.status === 'nao_iniciada').length
  const pieLateNotStarted = areaRows.filter(r => r.status === 'nao_iniciada' && r.overdue).length
  const pieLate = pieLateInProgress + pieLateNotStarted
  const pieDeadlines = Array.from(new Set(areaRows.map(r => r.deadline).filter((d): d is string => Boolean(d))))
  const pieSlices: PieSlice[] = [
    { key: 'preenchido', label: 'Preenchido', value: pieFilled, color: '#0ca30c', detail: 'declaração enviada, aprovada ou homologada' },
    { key: 'em_preenchimento', label: 'Em preenchimento', value: pieInProgress, color: '#fab219', detail: 'iniciado, ainda dentro do prazo' },
    {
      key: 'pendente',
      label: 'Pendente / Atrasado',
      value: pieNotStarted + pieLateInProgress,
      color: '#d03b3b',
      detail: `${pieNotStarted} não iniciada${pieNotStarted !== 1 ? 's' : ''} · ${pieLate} com prazo vencido`
    }
  ]

  const statusRows: BarRow[] = AREA_STATUS_ORDER.map(s => {
    const count = areaRows.filter(r => r.status === s).length
    return { key: s, label: AREA_STATUS_LABELS[s], value: count, suffix: `${pct(count, totalAreas)}%` }
  })

  const byAreaRows: StackRow[] = [...areaRows]
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(r => ({ key: r.unit.id, label: r.unit.name, done: r.done, draft: r.draft }))
  if (unassignedForms > 0) {
    const noUnitInvs = filteredInventories.filter(i => !i.unit_id)
    const done = noUnitInvs.filter(i => i.status === 'concluido').length
    byAreaRows.push({ key: NO_UNIT, label: 'Sem unidade vinculada', done, draft: noUnitInvs.length - done })
  }

  const monthRows = useMemo(() => {
    const counts = new Map<string, number>()
    filteredInventories.forEach(i => {
      const k = monthKey(inventoryDate(i))
      counts.set(k, (counts.get(k) || 0) + 1)
    })
    // Eixo contínuo: do período filtrado, ou dos últimos 12 meses.
    const end = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date()
    let start: Date
    if (dateFrom) start = new Date(`${dateFrom}T00:00:00`)
    else start = new Date(end.getFullYear(), end.getMonth() - 11, 1)
    const keys: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end && keys.length < 36) {
      keys.push(monthKey(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return keys.map(k => ({ key: k, label: monthLabel(k), value: counts.get(k) || 0 }))
  }, [filteredInventories, dateFrom, dateTo])

  const frequencyRows: BarRow[] = FREQUENCY_BUCKETS.map(b => ({
    key: b,
    label: b,
    value: filteredInventories.filter(i => frequencyBucket(i) === b).length
  }))
    .filter(r => r.value > 0)
    .map(r => ({ ...r, suffix: `${pct(r.value, totalForms)}%` }))

  const riskRows: BarRow[] = (['alto', 'medio', 'baixo'] as RiskLevel[]).map(level => {
    const count = filteredInventories.filter(i => getHighestRisk(i.form_data) === level).length
    const meta = RISK_META[level]
    return {
      key: level,
      label: meta.label,
      value: count,
      suffix: `${pct(count, totalForms)}%`,
      color: meta.color,
      icon: <meta.Icon size={13} style={{ color: meta.color }} aria-hidden="true" />
    }
  })

  const unitName = (id: string | null | undefined) => units.find(u => u.id === id)?.name || '—'
  const userName = (id: string | null | undefined) => {
    const u = allUsers.find(x => x.id === id)
    return u ? u.full_name || u.email || 'Usuário' : 'Usuário'
  }

  const history = useMemo(() => {
    const visibleUnitIds = new Set(areaUnits.map(u => u.id))
    const events: { id: string; date: string; title: string; detail: string; who: string; area: string }[] = []
    auditLog.forEach(a => {
      if (a.unit_id && !visibleUnitIds.has(a.unit_id)) return
      if (!a.unit_id && areaId !== ALL) return
      if (cycleId !== ALL && a.cycle_id && a.cycle_id !== cycleId) return
      if (!inPeriod(new Date(a.created_at))) return
      events.push({
        id: `a-${a.id}`,
        date: a.created_at,
        title: AUDIT_LABELS[a.action] || a.action,
        detail: a.detail || '',
        who: userName(a.actor_id),
        area: a.unit_id ? unitName(a.unit_id) : 'Geral'
      })
    })
    filteredInventories.forEach(i => {
      if (!i.created_at) return
      events.push({
        id: `i-${i.id}`,
        date: i.created_at,
        title: 'Formulário criado',
        detail: i.title || 'Sem título',
        who: userName(i.owner_id),
        area: i.unit_id ? unitName(i.unit_id) : 'Sem unidade'
      })
    })
    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditLog, filteredInventories, areaUnits, areaId, cycleId, dateFrom, dateTo, allUsers, units])

  const filledPct = pct(filledAreas, totalAreas)

  return (
    <div className="relatorios-panel">
      <div className="rel-header">
        <div>
          <span className="declaracao-eyebrow">RELATÓRIOS · {ROLE_LABELS[user.role].toUpperCase()}</span>
          <h1 className="aprovacoes-title">Painel de acompanhamento</h1>
          <p className="aprovacoes-subtitle">
            Situação do preenchimento do inventário por área, com os dados gravados no sistema.
            {!isMaster && user.unit_id ? ' Você está vendo apenas a sua unidade.' : ''}
          </p>
        </div>
        {onRefresh && (
          <button type="button" className="btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'rel-spin' : ''} />
            <span>{refreshing ? 'Atualizando...' : 'Atualizar dados'}</span>
          </button>
        )}
      </div>

      <div className="rel-filters" role="group" aria-label="Filtros do relatório">
        <div className="rel-filter">
          <label htmlFor="rel-cycle">Ciclo</label>
          <select id="rel-cycle" value={cycleId} onChange={e => setCycleId(e.target.value)}>
            <option value={ALL}>Todos os ciclos</option>
            {cycleOptions.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.status === 'aberto' ? ' (aberto)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="rel-filter">
          <label htmlFor="rel-area">Área</label>
          <select id="rel-area" value={areaId} onChange={e => setAreaId(e.target.value)}>
            <option value={ALL}>{scopedUnits.length === 1 ? scopedUnits[0].name : 'Todas as áreas'}</option>
            {scopedUnits.length > 1 &&
              scopedUnits.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </div>
        <div className="rel-filter">
          <label htmlFor="rel-frequency">Periodicidade</label>
          <select id="rel-frequency" value={frequency} onChange={e => setFrequency(e.target.value)}>
            <option value={ALL}>Todas</option>
            {FREQUENCY_BUCKETS.map(b => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="rel-filter">
          <label htmlFor="rel-from">De</label>
          <input id="rel-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="rel-filter">
          <label htmlFor="rel-to">Até</label>
          <input id="rel-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} />
        </div>
        {hasFilters && (
          <button type="button" className="btn-text-action rel-clear" onClick={clearFilters}>
            <FilterX size={14} />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      <div className="rel-tiles">
        <div className="rel-tile rel-tile-hero">
          <span className="rel-tile-label">Áreas que concluíram o preenchimento</span>
          <strong className="rel-hero-value">{totalAreas > 0 ? `${filledPct}%` : '—'}</strong>
          <span className="rel-tile-detail">
            {filledAreas} de {totalAreas} área{totalAreas !== 1 ? 's' : ''} enviaram a declaração
            {selectedCycle ? ` do ${selectedCycle.label}` : ''}
          </span>
          <div
            className="rel-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={filledPct}
            aria-label="Percentual de áreas que concluíram o preenchimento"
          >
            <div className="rel-progress-fill" style={{ width: `${filledPct}%` }} />
          </div>
        </div>
        <div className="rel-tile">
          <span className="rel-tile-label">Áreas pendentes</span>
          <strong className="rel-tile-value">{pendingAreas}</strong>
          <span className="rel-tile-detail">
            {inProgressAreas} em preenchimento · {notStartedAreas} não iniciada{notStartedAreas !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="rel-tile">
          <span className="rel-tile-label">Formulários registrados</span>
          <strong className="rel-tile-value">{totalForms}</strong>
          <span className="rel-tile-detail">
            {doneForms} concluído{doneForms !== 1 ? 's' : ''} · {totalForms - doneForms} rascunho{totalForms - doneForms !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="rel-tile">
          <span className="rel-tile-label">Risco LGPD alto</span>
          <strong className="rel-tile-value">{highRiskForms}</strong>
          <span className="rel-tile-detail">
            {pct(highRiskForms, totalForms)}% dos formulários filtrados
          </span>
        </div>
        <div className="rel-tile">
          <span className="rel-tile-label">Pontos Focais</span>
          <strong className="rel-tile-value">{focalPoints}</strong>
          <span className="rel-tile-detail">
            {naForms} formulário{naForms !== 1 ? 's' : ''} com campo{naForms !== 1 ? 's' : ''} “Não se aplica”
          </span>
        </div>
      </div>

      {totalAreas === 0 && totalForms === 0 ? (
        <section className="table-card glass-card rel-card rel-card-empty">
          <BarChart3 size={30} className="text-muted" />
          <p>Nenhum dado encontrado para os filtros escolhidos.</p>
        </section>
      ) : (
        <>
          <div className="rel-grid">
            <section className="table-card glass-card rel-card rel-card-wide">
              <header className="rel-card-header">
                <h2>Situação do preenchimento das áreas</h2>
                <span>
                  {selectedCycle ? `${selectedCycle.label} · ` : ''}
                  {pieDeadlines.length === 1
                    ? `prazo ${new Date(`${pieDeadlines[0]}T00:00:00`).toLocaleDateString('pt-BR')}`
                    : pieDeadlines.length > 1
                    ? 'prazo de cada ciclo'
                    : 'ciclo sem prazo definido — nada é considerado atrasado'}
                </span>
              </header>
              <PieChart slices={pieSlices} total={totalAreas} totalLabel={`área${totalAreas !== 1 ? 's' : ''}`} />
              <DataTable
                headers={['Situação', 'Áreas', '%']}
                rows={pieSlices.map(sl => [sl.label, sl.value, `${pct(sl.value, totalAreas)}%`])}
              />
            </section>

            <section className="table-card glass-card rel-card">
              <header className="rel-card-header">
                <h2>Situação das áreas</h2>
                <span>Quantidade de áreas em cada etapa{selectedCycle ? ` · ${selectedCycle.label}` : ''}</span>
              </header>
              <HBarChart rows={statusRows} unit="área(s)" emptyText="Nenhuma área cadastrada." />
              <DataTable
                headers={['Situação', 'Áreas', '%']}
                rows={statusRows.map(r => [r.label, r.value, r.suffix || ''])}
              />
            </section>

            <section className="table-card glass-card rel-card">
              <header className="rel-card-header">
                <h2>Formulários por área</h2>
                <span>Concluídos e rascunhos em cada área</span>
              </header>
              <StackedBarChart rows={byAreaRows} emptyText="Nenhum formulário registrado nos filtros escolhidos." />
              <DataTable
                headers={['Área', 'Concluídos', 'Rascunhos', 'Total']}
                rows={byAreaRows.map(r => [r.label, r.done, r.draft, r.done + r.draft])}
              />
            </section>

            <section className="table-card glass-card rel-card rel-card-wide">
              <header className="rel-card-header">
                <h2>Respostas por período</h2>
                <span>Formulários criados por mês{dateFrom || dateTo ? ' no período filtrado' : ' — últimos 12 meses'}</span>
              </header>
              <ColumnChart rows={monthRows} emptyText="Nenhum formulário criado no período." />
              <DataTable headers={['Mês', 'Formulários criados']} rows={monthRows.map(r => [r.label, r.value])} />
            </section>

            <section className="table-card glass-card rel-card">
              <header className="rel-card-header">
                <h2>Periodicidade do tratamento</h2>
                <span>Campo 9.1 — frequência informada nos formulários</span>
              </header>
              <HBarChart rows={frequencyRows} unit="formulário(s)" emptyText="Nenhum formulário nos filtros escolhidos." />
              <DataTable
                headers={['Periodicidade', 'Formulários', '%']}
                rows={frequencyRows.map(r => [r.label, r.value, r.suffix || ''])}
              />
            </section>

            <section className="table-card glass-card rel-card">
              <header className="rel-card-header">
                <h2>Nível de risco LGPD</h2>
                <span>Maior risco apontado pelo motor de triagem em cada formulário</span>
              </header>
              <HBarChart rows={riskRows} unit="formulário(s)" emptyText="Nenhum formulário nos filtros escolhidos." />
              <DataTable
                headers={['Risco', 'Formulários', '%']}
                rows={riskRows.map(r => [r.label, r.value, r.suffix || ''])}
              />
            </section>
          </div>

          <section className="table-card glass-card rel-card">
            <header className="rel-card-header">
              <h2>Dados por área</h2>
              <span>
                Situação da declaração e dos formulários de cada área
                {unassignedForms > 0 ? ` · ${unassignedForms} formulário(s) sem unidade vinculada não aparecem aqui` : ''}
              </span>
            </header>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ÁREA</th>
                    <th>SITUAÇÃO</th>
                    <th className="text-right">FORMULÁRIOS</th>
                    <th className="text-right">CONCLUÍDOS</th>
                    <th className="text-right">% CONCLUÍDO</th>
                    <th className="text-right">RISCO ALTO</th>
                    <th>ÚLTIMA ATUALIZAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {areaRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        <p>Nenhuma área cadastrada.</p>
                      </td>
                    </tr>
                  )}
                  {[...areaRows]
                    .sort((a, b) => AREA_STATUS_ORDER.indexOf(a.status) - AREA_STATUS_ORDER.indexOf(b.status) || a.unit.name.localeCompare(b.unit.name))
                    .map(r => (
                      <tr key={r.unit.id} className="table-row-hover">
                        <td className="cell-main">
                          <span className="process-title">{r.unit.name}</span>
                        </td>
                        <td>
                          <span className={`rel-status rel-status-${r.status}`}>{AREA_STATUS_LABELS[r.status]}</span>
                        </td>
                        <td className="text-right">{r.total}</td>
                        <td className="text-right">{r.done}</td>
                        <td className="text-right">{r.total > 0 ? `${pct(r.done, r.total)}%` : '—'}</td>
                        <td className="text-right">{r.highRisk}</td>
                        <td className="cell-date">{r.lastUpdate ? formatDateTime(r.lastUpdate) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card glass-card rel-card">
            <header className="rel-card-header">
              <h2>Histórico</h2>
              <span>Últimos 15 eventos registrados (envios, aprovações, devoluções e formulários criados)</span>
            </header>
            {history.length === 0 ? (
              <p className="rel-empty">Nenhum evento registrado nos filtros escolhidos.</p>
            ) : (
              <ol className="rel-history">
                {history.map(ev => (
                  <li key={ev.id}>
                    <span className="rel-history-date">{formatDateTime(ev.date)}</span>
                    <div>
                      <strong>{ev.title}</strong>
                      <span className="rel-history-meta">
                        {ev.area} · por {ev.who}
                      </span>
                      {ev.detail && <p>{ev.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}

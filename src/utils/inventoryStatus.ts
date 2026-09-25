import { Inventory } from '../types/inventory'

// Status do inventário (coluna inventories.status):
//   rascunho  -> em preenchimento pelo Ponto Focal (o Master não vê)
//   concluido -> enviado, aguardando aprovação do Master
//   aprovado  -> aprovado pelo Master
export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  concluido: 'Aguardando aprovação',
  aprovado: 'Aprovado'
}

export const inventoryStatusLabel = (status: string) => INVENTORY_STATUS_LABELS[status] || 'Rascunho'

/** Enviado pelo Ponto Focal (aguardando aprovação ou já aprovado). */
export const isSubmittedStatus = (status: string) => status === 'concluido' || status === 'aprovado'
export const isAwaitingApproval = (status: string) => status === 'concluido'
export const isApproved = (status: string) => status === 'aprovado'
export const isDraftStatus = (status: string) => !isSubmittedStatus(status)

export type DraftSummaryRow = {
  unit_id: string | null
  cycle_id: string | null
  drafts: number
  last_update: string | null
}

/**
 * Contagem única usada pela Visão Geral e pelos Relatórios. O Master não
 * recebe os rascunhos (RLS); para ele, os rascunhos vêm do resumo agregado
 * do banco (inventory_draft_summary), só com números.
 */
export function inventoryCounts(inventories: Inventory[], draftSummary?: DraftSummaryRow[] | null) {
  const submitted = inventories.filter(i => isSubmittedStatus(i.status))
  const awaiting = submitted.filter(i => isAwaitingApproval(i.status)).length
  const approved = submitted.filter(i => isApproved(i.status)).length
  const drafts = draftSummary
    ? draftSummary.reduce((sum, r) => sum + Number(r.drafts || 0), 0)
    : inventories.filter(i => isDraftStatus(i.status)).length
  return {
    submitted: submitted.length,
    awaiting,
    approved,
    drafts,
    total: submitted.length + drafts
  }
}

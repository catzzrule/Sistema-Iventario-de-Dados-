import { Inventory, TableRow, TransferRow, ContractRow } from '../types/inventory'
import {
  displayValue,
  getHighestRisk,
  getInputValue,
  isNotApplicable,
  NOT_APPLICABLE_LABEL,
  riskReport
} from './lgpdRisk'

export function exportInventoriesToCsv(inventories: Inventory[], unitFilter?: string) {
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`

  // Filter by unit if specified
  const filteredList = unitFilter && unitFilter !== 'todas'
    ? inventories.filter(i => (getInputValue(i.form_data, 'unit') || 'Não informada').toLowerCase() === unitFilter.toLowerCase())
    : inventories

  // Complete 28-column LGPD Governance Report (Guia 3 SGD/MGI)
  const header = [
    'Unidade / Departamento',
    'Processo / Serviço',
    'Nº Referência (ID)',
    'Sistema / Plataforma',
    'Status',
    'Data de Atualização',
    '1. Controladora',
    'E-mail Controladora',
    'Telefone Controladora',
    '2. Encarregado (DPO)',
    'E-mail Encarregado',
    'Operador de Dados',
    '3. Ciclo de Vida',
    '4. Descrição do Fluxo',
    '5. Geografia & Fonte',
    '6. Base Legal (Art. 7º/11º)',
    'Finalidade Específica',
    '7. Categorias de Dados Pessoais',
    '8. Dados Pessoais Sensíveis',
    'Prazo de Retenção',
    'Nome da Base / Tabela',
    '9. Frequência & Quantidade Titulares',
    '10. Titulares de Dados & Grupos Vulneráveis',
    '11. Compartilhamento com Terceiros',
    '12. Medidas de Segurança & Criptografia',
    '13. Transferência Internacional',
    '14. Contratos de TI Relacionados',
    'Nível de Risco LGPD',
    'Diagnóstico de Riscos & Recomendações'
  ]

  const rows = filteredList.map(i => {
    const d = i.form_data
    const riskAnalysis = riskReport(d)
    const highestRisk = getHighestRisk(d)
    const riskSummaryText = riskAnalysis.map(r => `[${r.level.toUpperCase()}] ${r.text}`).join(' | ')

    // Campo a campo: "Não se aplica" aparece escrito, nunca como célula vazia.
    const v = (key: string) => displayValue(d, key)
    const join = (parts: string[], sep: string) => parts.filter(Boolean).join(sep)

    const sharingList = isNotApplicable(d, 'sharing')
      ? NOT_APPLICABLE_LABEL
      : ((d.sharing as TableRow[]) || [])
          .map(s => `${s.institution || 'Terceiro'} (Dados: ${s.data || 'N/A'}, Finalidade: ${s.purpose || 'N/A'})`)
          .join('; ')

    const sensitiveList = ((d.sensitive_categories as string[]) || []).join('; ')
    const categoriesList = ((d.data_categories as string[]) || []).join('; ')
    const lifecycleList = join([((d.lifecycle as string[]) || []).join('; '), v('lifecycle_description')], ' — ')
    const vulnerableList = ((d.vulnerable_groups as string[]) || []).join('; ')

    const geoAndSource = join([v('geography'), v('data_source')], ' | ')
    const freqAndVol = join([v('frequency'), v('data_volume')], ' | ')

    const legalProvision = v('legal_provision')
    const legalBasisFull = join([v('legal_basis'), legalProvision ? `Previsão legal: ${legalProvision}` : ''], ' | ')
    const purposeFull = join([v('purpose'), v('expected_results'), v('expected_benefits')], ' | ')

    const categoriesFull = join([categoriesList, v('data_categories_description')], ' — ')
    const sensitiveFull = join([sensitiveList, v('sensitive_categories_description')], ' — ')

    const securityFull = join([v('security_type'), v('security')], ': ')

    const transfersList = (d.international_transfers as TransferRow[]) || []
    const transferText = isNotApplicable(d, 'international_transfers')
      ? NOT_APPLICABLE_LABEL
      : transfersList.length
      ? transfersList
          .map(t => `${t.country || 'País N/A'} (Dados: ${t.data || 'N/A'}, Garantia: ${t.guarantee || 'N/A'})`)
          .join('; ')
      : getInputValue(d, 'international_transfer')

    const contractsListValues = (d.contracts_list as ContractRow[]) || []
    const contractsText = isNotApplicable(d, 'contracts_list')
      ? NOT_APPLICABLE_LABEL
      : contractsListValues.length
      ? contractsListValues
          .map(c => `${c.number || 'Processo N/A'} — ${c.object || 'Objeto N/A'} (Gestor: ${c.managerEmail || 'N/A'})`)
          .join('; ')
      : getInputValue(d, 'contracts')

    return [
      getInputValue(d, 'unit') || 'Não informada',
      i.title || 'Sem título',
      isNotApplicable(d, 'reference_id') ? NOT_APPLICABLE_LABEL : i.reference_id || '—',
      v('system_name') || 'Não informado',
      i.status === 'concluido' ? 'Concluído' : 'Rascunho',
      new Date(i.updated_at).toLocaleDateString('pt-BR'),
      v('controller_name'),
      v('controller_email'),
      v('controller_phone'),
      v('dpo_name'),
      v('dpo_email'),
      v('operator_name'),
      lifecycleList || 'Não especificado',
      v('flow'),
      geoAndSource || 'Não especificado',
      legalBasisFull,
      purposeFull,
      categoriesFull || 'Nenhuma selecionada',
      sensitiveFull || 'Nenhum dado sensível marcado',
      v('retention_period'),
      v('database'),
      freqAndVol || 'Não informado',
      join([v('data_subjects'), vulnerableList ? `(Vulneráveis: ${vulnerableList})` : ''], ' '),
      sharingList || 'Sem compartilhamento registrado',
      securityFull,
      transferText || 'Não há transferência internacional',
      contractsText || 'Sem contratos registrados',
      highestRisk.toUpperCase(),
      riskSummaryText
    ]
  })

  // UTF-8 BOM (\uFEFF) ensures Microsoft Excel opens special characters (Ã, Ç, É) perfectly
  const csvContent = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

  const unitSlug = unitFilter && unitFilter !== 'todas'
    ? `unidade-${unitFilter.toLowerCase().replace(/[^a-z0-9]/g, '_')}-`
    : 'consolidado-'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-inventario-lgpd-${unitSlug}${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


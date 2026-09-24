import { Inventory, TableRow, TransferRow, ContractRow } from '../types/inventory'
import { getInputValue, riskReport } from './lgpdRisk'

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
    const highestRisk = riskAnalysis[0]?.level || 'baixo'
    const riskSummaryText = riskAnalysis.map(r => `[${r.level.toUpperCase()}] ${r.text}`).join(' | ')

    // Format sharing items
    const sharingList = (d.sharing as TableRow[] || [])
      .map(s => `${s.institution || 'Terceiro'} (Dados: ${s.data || 'N/A'}, Finalidade: ${s.purpose || 'N/A'})`)
      .join('; ')

    // Format sensitive categories
    const sensitiveList = ((d.sensitive_categories as string[]) || []).join('; ')
    const categoriesList = ((d.data_categories as string[]) || []).join('; ')
    const lifecycleList = [
      ((d.lifecycle as string[]) || []).join('; '),
      getInputValue(d, 'lifecycle_description')
    ].filter(Boolean).join(' — ')
    const vulnerableList = ((d.vulnerable_groups as string[]) || []).join('; ')

    const geoAndSource = [getInputValue(d, 'geography'), getInputValue(d, 'data_source')].filter(Boolean).join(' | ')
    const freqAndVol = [getInputValue(d, 'frequency'), getInputValue(d, 'data_volume')].filter(Boolean).join(' | ')

    const legalBasisFull = [getInputValue(d, 'legal_basis'), getInputValue(d, 'legal_provision')].filter(Boolean).join(' | Previsão legal: ')
    const purposeFull = [getInputValue(d, 'purpose'), getInputValue(d, 'expected_results'), getInputValue(d, 'expected_benefits')]
      .filter(Boolean)
      .join(' | ')

    const categoriesFull = [categoriesList, getInputValue(d, 'data_categories_description')].filter(Boolean).join(' — ')
    const sensitiveFull = [sensitiveList, getInputValue(d, 'sensitive_categories_description')].filter(Boolean).join(' — ')

    const securityFull = [getInputValue(d, 'security_type'), getInputValue(d, 'security')].filter(Boolean).join(': ')

    const transfersList = (d.international_transfers as TransferRow[]) || []
    const transferText = transfersList.length
      ? transfersList
          .map(t => `${t.country || 'País N/A'} (Dados: ${t.data || 'N/A'}, Garantia: ${t.guarantee || 'N/A'})`)
          .join('; ')
      : getInputValue(d, 'international_transfer')

    const contractsListValues = (d.contracts_list as ContractRow[]) || []
    const contractsText = contractsListValues.length
      ? contractsListValues
          .map(c => `${c.number || 'Processo N/A'} — ${c.object || 'Objeto N/A'} (Gestor: ${c.managerEmail || 'N/A'})`)
          .join('; ')
      : getInputValue(d, 'contracts')

    return [
      getInputValue(d, 'unit') || 'Não informada',
      i.title || 'Sem título',
      i.reference_id || '—',
      getInputValue(d, 'system_name') || 'Não informado',
      i.status === 'concluido' ? 'Concluído' : 'Rascunho',
      new Date(i.updated_at).toLocaleDateString('pt-BR'),
      getInputValue(d, 'controller_name'),
      getInputValue(d, 'controller_email'),
      getInputValue(d, 'controller_phone'),
      getInputValue(d, 'dpo_name'),
      getInputValue(d, 'dpo_email'),
      getInputValue(d, 'operator_name'),
      lifecycleList || 'Não especificado',
      getInputValue(d, 'flow'),
      geoAndSource || 'Não especificado',
      legalBasisFull,
      purposeFull,
      categoriesFull || 'Nenhuma selecionada',
      sensitiveFull || 'Nenhum dado sensível marcado',
      getInputValue(d, 'retention_period'),
      getInputValue(d, 'database'),
      freqAndVol || 'Não informado',
      getInputValue(d, 'data_subjects') + (vulnerableList ? ` (Vulneráveis: ${vulnerableList})` : ''),
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


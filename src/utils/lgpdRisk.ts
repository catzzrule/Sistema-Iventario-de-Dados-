import { FormData, Inventory, RiskItem } from '../types/inventory'

export const categoryGroups = [
  ['Identificação pessoal', 'Informações governamentais', 'Identificação eletrônica', 'Localização eletrônica'],
  ['Dados financeiros', 'Recursos financeiros', 'Dívidas e despesas', 'Transações financeiras', 'Atividades profissionais'],
  ['Características pessoais', 'Hábitos e estilo de vida', 'Composição familiar', 'Educação e treinamento', 'Profissão e emprego'],
  ['Vídeo, imagem e voz', 'Processo judicial, administrativo ou criminal', 'Outros dados pessoais']
]

export const sensitiveCategories = [
  'Origem racial ou étnica',
  'Convicção religiosa',
  'Opinião política',
  'Filiação sindical',
  'Saúde ou vida sexual',
  'Dados genéticos',
  'Dados biométricos'
]

export const initialForm = (): FormData => ({
  lifecycle: [],
  data_categories: [],
  sensitive_categories: [],
  sharing: [],
  security: 'Controles de acesso, criptografia, backups e registros de auditoria.'
})

export const getInputValue = (data: FormData, key: string): string => {
  const val = data[key]
  if (Array.isArray(val)) return val.join(', ')
  return String(val || '')
}

export const NOT_APPLICABLE_LABEL = 'Não se aplica'

export const getNotApplicable = (data: FormData): string[] =>
  Array.isArray(data.not_applicable) ? (data.not_applicable as string[]) : []

export const isNotApplicable = (data: FormData, key: string): boolean => getNotApplicable(data).includes(key)

// Para exibição (relatórios, CSV, tabelas): distingue "Não se aplica" de
// campo vazio. Não use nos inputs do formulário — lá o valor real é vazio.
export const displayValue = (data: FormData, key: string, emptyLabel = ''): string => {
  if (isNotApplicable(data, key)) return NOT_APPLICABLE_LABEL
  return getInputValue(data, key) || emptyLabel
}

const hasTransfers = (data: FormData): boolean => {
  if (isNotApplicable(data, 'international_transfers')) return false
  const rows = (data.international_transfers as { country?: string; data?: string; guarantee?: string }[]) || []
  if (rows.some(r => (r.country || r.data || r.guarantee || '').trim())) return true
  return Boolean(getInputValue(data, 'international_transfer').trim())
}

export function riskReport(data: FormData): RiskItem[] {
  const risks: RiskItem[] = []
  const sensitiveData = (data.sensitive_categories as string[]) || []
  const lifecycle = (data.lifecycle as string[]) || []
  const sharingList = (data.sharing as unknown[]) || []

  if (sensitiveData.length) {
    risks.push({
      level: 'alto',
      text: 'Há dados pessoais sensíveis (Art. 5º, II da LGPD). Confirme a hipótese legal específica, controles de acesso restrito e criptografia.'
    })
  }

  if (hasTransfers(data)) {
    risks.push({
      level: 'alto',
      text: 'Há transferência internacional declarada. Documente o país de destino, garantias exigidas e base legal aplicável (Art. 33).'
    })
  }

  if (lifecycle.includes('Compartilhamento') && !sharingList.length && !isNotApplicable(data, 'sharing')) {
    risks.push({
      level: 'medio',
      text: 'Compartilhamento marcado no ciclo de vida, mas sem destinatários, dados e finalidades registrados.'
    })
  }

  if (isNotApplicable(data, 'retention_period')) {
    risks.push({
      level: 'medio',
      text: 'O prazo de retenção foi marcado como "Não se aplica". Confirme com o Encarregado como os dados serão eliminados.'
    })
  } else if (!getInputValue(data, 'retention_period')) {
    risks.push({
      level: 'medio',
      text: 'O prazo de retenção e hipótese de eliminação ainda não foram definidos.'
    })
  }

  if (isNotApplicable(data, 'legal_basis')) {
    risks.push({
      level: 'medio',
      text: 'A hipótese legal foi marcada como "Não se aplica". Todo tratamento de dados pessoais precisa de base legal (Art. 7º ou 11) — revise.'
    })
  } else if (!getInputValue(data, 'legal_basis')) {
    risks.push({
      level: 'medio',
      text: 'A hipótese legal de tratamento (Art. 7º ou 11) é obrigatória para a conformidade.'
    })
  }

  if (isNotApplicable(data, 'security')) {
    risks.push({
      level: 'medio',
      text: 'As medidas de segurança foram marcadas como "Não se aplica". Confirme com o Encarregado (Art. 46).'
    })
  } else if (!getInputValue(data, 'security') || getInputValue(data, 'security').length < 20) {
    risks.push({
      level: 'medio',
      text: 'Descreva detalhadamente as medidas técnicas e administrativas de segurança (Art. 46).'
    })
  }

  if (!risks.length) {
    risks.push({
      level: 'baixo',
      text: 'Nenhuma lacuna crítica identificada pelas regras automáticas. Mantenha a revisão periódica pelo Encarregado (DPO).'
    })
  }

  return risks
}

export function getHighestRisk(data: FormData): 'alto' | 'medio' | 'baixo' {
  const report = riskReport(data)
  if (report.some(r => r.level === 'alto')) return 'alto'
  if (report.some(r => r.level === 'medio')) return 'medio'
  return 'baixo'
}

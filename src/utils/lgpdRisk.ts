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

  if (getInputValue(data, 'international_transfer')) {
    risks.push({
      level: 'alto',
      text: 'Há transferência internacional declarada. Documente o país de destino, garantias exigidas e base legal aplicável (Art. 33).'
    })
  }

  if (lifecycle.includes('Compartilhamento') && !sharingList.length) {
    risks.push({
      level: 'medio',
      text: 'Compartilhamento marcado no ciclo de vida, mas sem destinatários, dados e finalidades registrados.'
    })
  }

  if (!getInputValue(data, 'retention_period')) {
    risks.push({
      level: 'medio',
      text: 'O prazo de retenção e hipótese de eliminação ainda não foram definidos.'
    })
  }

  if (!getInputValue(data, 'legal_basis')) {
    risks.push({
      level: 'medio',
      text: 'A hipótese legal de tratamento (Art. 7º ou 11) é obrigatória para a conformidade.'
    })
  }

  if (!getInputValue(data, 'security') || getInputValue(data, 'security').length < 20) {
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

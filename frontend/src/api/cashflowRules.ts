import { apiGet, apiPostJson } from './client'
import type { CashflowRule, CashflowType, Direction } from '../types/api'

export type CashflowRuleCreatePayload = {
  name: string
  cashflow_type: CashflowType
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction?: Direction | null
  source?: string | null
  is_active: boolean
}

export function listCashflowRules() {
  return apiGet<CashflowRule[]>('/api/cashflow-rules')
}

export function createCashflowRule(payload: CashflowRuleCreatePayload) {
  return apiPostJson<CashflowRule>('/api/cashflow-rules', payload)
}

export function applyCashflowRules() {
  return apiPostJson<unknown>('/api/cashflow-rules/apply', {})
}

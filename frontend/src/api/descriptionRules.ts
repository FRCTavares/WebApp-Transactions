import { apiGet, apiPostJson } from './client'
import type { DescriptionRule, DescriptionRuleSuggestion, Direction } from '../types/api'

export type DescriptionRuleCreatePayload = {
  name: string
  cleaned_description: string
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction?: Direction | null
  source?: string | null
  is_active: boolean
}

export function listDescriptionRules() {
  return apiGet<DescriptionRule[]>('/api/description-rules')
}

export function listDescriptionRuleSuggestions(direction?: Direction) {
  const query = direction ? `?direction=${direction}` : ''
  return apiGet<DescriptionRuleSuggestion[]>(`/api/description-rules/suggestions${query}`)
}

export function createDescriptionRule(payload: DescriptionRuleCreatePayload) {
  return apiPostJson<DescriptionRule>('/api/description-rules', payload)
}

export function applyDescriptionRules() {
  return apiPostJson<unknown>('/api/description-rules/apply', {})
}

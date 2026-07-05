import { apiDelete, apiGet, apiPatchJson, apiPostJson } from './client'
import type { CategoryRule, CategoryRuleSuggestion, Direction } from '../types/api'

export type CategoryRuleCreatePayload = {
  name: string
  category: string
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction?: Direction | null
  source?: string | null
  is_active: boolean
}

export type CategoryRuleUpdatePayload = {
  name?: string
  category?: string
  match_text?: string
  match_field?: 'description' | 'raw_description' | 'merchant'
  direction?: Direction | null
  source?: string | null
  is_active?: boolean
}

export function listCategoryRules() {
  return apiGet<CategoryRule[]>('/api/category-rules')
}

export function listCategoryRuleSuggestions(direction?: Direction) {
  const query = direction ? `?direction=${direction}` : ''
  return apiGet<CategoryRuleSuggestion[]>(`/api/category-rules/suggestions${query}`)
}

export function createCategoryRule(payload: CategoryRuleCreatePayload) {
  return apiPostJson<CategoryRule>('/api/category-rules', payload)
}

export function updateCategoryRule(ruleId: number, payload: CategoryRuleUpdatePayload) {
  return apiPatchJson<CategoryRule>(`/api/category-rules/${ruleId}`, payload)
}

export function deleteCategoryRule(ruleId: number) {
  return apiDelete(`/api/category-rules/${ruleId}`)
}

export function applyCategoryRules() {
  return apiPostJson<unknown>('/api/category-rules/apply', {})
}

import {
  EXPENSE_CATEGORY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  TRANSFER_CATEGORY_OPTIONS,
} from '../constants/categories'
import type { CashflowType, Direction, TransactionCategory } from '../types/api'

/**
 * Pure helpers and form-state types for `TransactionCategoriesPanel`.
 * Split out of that component (which was approaching the project's
 * 900-line soft limit) — none of this touches component state.
 */

export type CategoryGroup =
  | 'expense'
  | 'income'
  | 'transfer_in'
  | 'transfer_out'

export type CategoryFormState = {
  name: string
  group: CategoryGroup
}

export type DisplayGroup = {
  key: 'expense' | 'income' | 'transfer'
  title: string
  description: string
  categories: TransactionCategory[]
}

export const INITIAL_FORM: CategoryFormState = {
  name: '',
  group: 'expense',
}

export function getCategoryIdentity(
  name: string,
  direction: Direction,
  cashflowType: CashflowType,
) {
  return `${name.trim().toLowerCase()}|${direction}|${cashflowType}`
}

export function getGroupValues(group: CategoryGroup): {
  direction: Direction
  cashflowType: CashflowType
} {
  if (group === 'income') {
    return {
      direction: 'in',
      cashflowType: 'income',
    }
  }

  if (group === 'transfer_in') {
    return {
      direction: 'in',
      cashflowType: 'transfer',
    }
  }

  if (group === 'transfer_out') {
    return {
      direction: 'out',
      cashflowType: 'transfer',
    }
  }

  return {
    direction: 'out',
    cashflowType: 'expense',
  }
}

export function getRecommendedCategories() {
  return [
    ...EXPENSE_CATEGORY_OPTIONS.map((name, index) => ({
      name,
      direction: 'out' as const,
      cashflow_type: 'expense' as const,
      sort_order: index,
    })),
    ...INCOME_CATEGORY_OPTIONS.map((name, index) => ({
      name,
      direction: 'in' as const,
      cashflow_type: 'income' as const,
      sort_order: index,
    })),
    ...TRANSFER_CATEGORY_OPTIONS.flatMap((name, index) => [
      {
        name,
        direction: 'in' as const,
        cashflow_type: 'transfer' as const,
        sort_order: index,
      },
      {
        name,
        direction: 'out' as const,
        cashflow_type: 'transfer' as const,
        sort_order: index,
      },
    ]),
  ]
}

export function sortCategories(categories: TransactionCategory[]) {
  return [...categories].sort(
    (first, second) =>
      Number(second.is_active) - Number(first.is_active) ||
      first.sort_order - second.sort_order ||
      first.name.localeCompare(second.name),
  )
}

export function getTransferDirectionLabel(category: TransactionCategory) {
  return category.direction === 'in' ? 'Into account' : 'Out of account'
}

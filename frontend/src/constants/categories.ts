import type {
  CashflowType,
  Direction,
  TransactionCategory,
} from '../types/api'

export const EXPENSE_CATEGORY_OPTIONS = [
  'Food',
  'Groceries',
  'Restaurants',
  'Transport',
  'Fuel',
  'Rent',
  'Utilities',
  'Subscriptions',
  'Shopping',
  'Health',
  'Fitness',
  'Travel',
  'Education',
  'Entertainment',
  'Fees',
  'Taxes',
  'Gifts',
  'Other',
]

export const INCOME_CATEGORY_OPTIONS = [
  'Salary',
  'Refund',
  'Gifts',
  'Other',
]

export const TRANSFER_CATEGORY_OPTIONS = [
  'Transfer',
  'Investment',
  'Other',
]

export const CATEGORY_OPTIONS = Array.from(
  new Set([
    ...EXPENSE_CATEGORY_OPTIONS,
    ...INCOME_CATEGORY_OPTIONS,
    ...TRANSFER_CATEGORY_OPTIONS,
  ]),
)

export type CashflowTypeOption = {
  value: CashflowType
  label: string
}

export function getCashflowTypeOptions(
  direction?: Direction,
): CashflowTypeOption[] {
  if (direction === 'in') {
    return [
      { value: 'income', label: 'Income' },
      { value: 'transfer', label: 'Transfer' },
    ]
  }

  if (direction === 'out') {
    return [
      { value: 'expense', label: 'Expense' },
      { value: 'transfer', label: 'Transfer' },
    ]
  }

  return [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
  ]
}

function normaliseCategory(value: string) {
  return value.trim().toLowerCase()
}

function getUniqueCategories(categories: string[]) {
  const seen = new Set<string>()

  return categories.filter((category) => {
    const trimmedCategory = category.trim()

    if (!trimmedCategory) {
      return false
    }

    const key = normaliseCategory(trimmedCategory)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function getTransactionCategoryOptions(
  direction: Direction,
  cashflowType: CashflowType,
  categories: TransactionCategory[] = [],
  currentCategory = '',
) {
  const managedOptions = categories
    .filter(
      (category) =>
        category.is_active &&
        category.direction === direction &&
        category.cashflow_type === cashflowType,
    )
    .sort(
      (first, second) =>
        first.sort_order - second.sort_order ||
        first.name.localeCompare(second.name),
    )
    .map((category) => category.name)

  return getUniqueCategories([
    ...managedOptions,
    currentCategory,
  ])
}

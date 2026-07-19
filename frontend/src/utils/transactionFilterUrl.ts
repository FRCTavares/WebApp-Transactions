import type { TransactionFilterState } from '../components/TransactionFilters'
import type { Direction } from '../types/api'

export function getFiltersFromUrl(searchParams: URLSearchParams) {
  const initial: TransactionFilterState = {
    search: '',
    category: '',
    source: '',
    cashflowType: '',
    month: '',
    dateFrom: '',
    dateTo: '',
    showFullyOwed: false,
  }
  const cashflowType = searchParams.get('type')
  return {
    ...initial,
    search: searchParams.get('q') ?? '',
    category: searchParams.get('category') ?? '',
    source: searchParams.get('source') ?? '',
    cashflowType:
      cashflowType === 'income' || cashflowType === 'expense' || cashflowType === 'transfer'
        ? cashflowType
        : '',
    month: searchParams.get('month') ?? '',
    dateFrom: searchParams.get('from') ?? '',
    dateTo: searchParams.get('to') ?? '',
    showFullyOwed: searchParams.get('fully_owed') === 'true',
  } satisfies TransactionFilterState
}

export function buildTransactionFilterUrl(
  filters: TransactionFilterState,
  direction: Direction,
) {
  const params = new URLSearchParams()
  if (direction === 'in') params.set('direction', direction)
  if (filters.search) params.set('q', filters.search)
  if (filters.category) params.set('category', filters.category)
  if (filters.source) params.set('source', filters.source)
  if (filters.cashflowType) params.set('type', filters.cashflowType)
  if (filters.month) params.set('month', filters.month)
  if (filters.dateFrom) params.set('from', filters.dateFrom)
  if (filters.dateTo) params.set('to', filters.dateTo)
  if (filters.showFullyOwed) params.set('fully_owed', 'true')
  return params
}

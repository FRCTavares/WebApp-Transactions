import type { CashflowType } from '../types/api'
import { CategorySelect } from './CategorySelect'

export type TransactionFilterState = {
  search: string
  category: string
  source: string
  cashflowType: CashflowType | ''
  month: string
  dateFrom: string
  dateTo: string
}

const sourceOptions = [
  { value: '', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'activobank', label: 'ActivoBank' },
  { value: 'trading212', label: 'Trading 212' },
]

const cashflowTypeOptions = [
  { value: '', label: 'All cashflow types' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'internal_transfer', label: 'Internal transfer' },
  { value: 'investment', label: 'Investment' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'reimbursed_expense', label: 'Reimbursed expense' },
]

type TransactionFiltersProps = {
  filters: TransactionFilterState
  onChange: (field: keyof TransactionFilterState, value: string) => void
  onApply: () => void
  onClear: () => void
}

export function TransactionFilters({
  filters,
  onChange,
  onApply,
  onClear,
}: TransactionFiltersProps) {
  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.source,
    filters.cashflowType,
    filters.month,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length

  return (
    <details className="filter-panel compact-filter-panel">
      <summary>
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount} active</span>
        )}
      </summary>

      <div className="form-row">
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
            placeholder="Search description"
          />
        </label>

        <CategorySelect
          label="Category"
          value={filters.category}
          onChange={(value) => onChange('category', value)}
        />

        <label>
          Source
          <select
            value={filters.source}
            onChange={(event) => onChange('source', event.target.value)}
          >
            {sourceOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cashflow Type
          <select
            value={filters.cashflowType}
            onChange={(event) => onChange('cashflowType', event.target.value)}
          >
            {cashflowTypeOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Month
          <input
            type="month"
            value={filters.month}
            onChange={(event) => onChange('month', event.target.value)}
          />
        </label>

        <label>
          Date From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange('dateFrom', event.target.value)}
          />
        </label>

        <label>
          Date To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => onChange('dateTo', event.target.value)}
          />
        </label>
      </div>

      <div className="action-group">
        <button type="button" onClick={onApply}>
          Apply Filters
        </button>
        <button type="button" onClick={onClear}>
          Clear Filters
        </button>
      </div>
    </details>
  )
}

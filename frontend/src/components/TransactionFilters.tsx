import { useState } from 'react'
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
  showFullyOwed: boolean
}

const sourceOptions = [
  { value: '', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'activobank', label: 'ActivoBank' },
  { value: 'trading212', label: 'Trading 212' },
]

const cashflowTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
]

type TransactionFiltersProps = {
  filters: TransactionFilterState
  onChange: (field: keyof TransactionFilterState, value: string | boolean) => void
  onApply: () => void
  onClear: () => void
}

export function TransactionFilters({
  filters,
  onChange,
  onApply,
  onClear,
}: TransactionFiltersProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.source,
    filters.cashflowType,
    filters.month,
    filters.dateFrom,
    filters.dateTo,
    filters.showFullyOwed,
  ].filter(Boolean).length

  return (
    <section
      className={`transaction-filter-card ${isMobileOpen ? 'transaction-filter-card-open' : ''}`}
      aria-label="Transaction filters"
    >
      <div className="transaction-filter-mobile-header">
        <div>
          <strong>Filters</strong>
          <span>
            {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Current month'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen((isOpen) => !isOpen)}
        >
          {isMobileOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className="transaction-filter-body">
        <div className="transaction-filter-main">
        <label className="transaction-search-field">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
            placeholder="Search transactions..."
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
          Type
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

      <div className="transaction-filter-footer">
        <details className="transaction-advanced-filters">
          <summary>More filters</summary>

          <div className="transaction-filter-dates">
            <label>
              Month
              <input
                type="month"
                value={filters.month}
                onChange={(event) => onChange('month', event.target.value)}
              />
            </label>

            <label>
              Date from
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => onChange('dateFrom', event.target.value)}
              />
            </label>

            <label>
              Date to
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => onChange('dateTo', event.target.value)}
              />
            </label>
          </div>
        </details>

        <div className="transaction-filter-actions">
          <label className="transaction-filter-checkbox">
            <input
              type="checkbox"
              checked={filters.showFullyOwed}
              onChange={(event) => onChange('showFullyOwed', event.target.checked)}
            />
            <span>Show fully owed</span>
          </label>

          {activeFilterCount > 0 && (
            <span className="transaction-filter-count">
              {activeFilterCount} active
            </span>
          )}

          <button type="button" onClick={onApply}>
            Apply
          </button>

          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      </div>
    </section>
  )
}
